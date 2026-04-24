import json
import re
import shutil
from pathlib import Path

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="Vector DB Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
CHROMA_DIR = BASE_DIR / "chroma_db"
CONFIG_PATH = BASE_DIR / "config.json"

DATA_DIR.mkdir(exist_ok=True)
CHROMA_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".md"}
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

_chroma_client = None
_embedding_fn = None

# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    "anthropic_api_key": "",
    "openai_api_key": "",
    "ollama_url": "http://localhost:11434",
}

def load_config() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return {**DEFAULT_CONFIG, **json.load(f)}
    return DEFAULT_CONFIG.copy()

def save_config(cfg: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


# ── Chroma helpers ─────────────────────────────────────────────────────────────

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        import chromadb
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _chroma_client


def get_embedding_fn():
    global _embedding_fn
    if _embedding_fn is None:
        from chromadb.utils import embedding_functions
        _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBED_MODEL
        )
    return _embedding_fn


def collection_name(domain: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9_-]", "_", domain)
    if len(name) < 3:
        name = name + "_db"
    return name[:63]


def collection_exists(domain: str) -> bool:
    names = [c.name for c in get_chroma_client().list_collections()]
    return collection_name(domain) in names


def get_collection(domain: str):
    try:
        return get_chroma_client().get_collection(
            name=collection_name(domain), embedding_function=get_embedding_fn()
        )
    except Exception:
        raise HTTPException(404, f"Aucune base vectorielle pour le domaine '{domain}'")


def get_or_create_collection(domain: str):
    return get_chroma_client().get_or_create_collection(
        name=collection_name(domain),
        embedding_function=get_embedding_fn(),
        metadata={"hnsw:space": "cosine", "model": EMBED_MODEL, "domain": domain},
    )


# ── Text helpers ───────────────────────────────────────────────────────────────

def extract_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    try:
        if suffix in (".txt", ".md"):
            return file_path.read_text(encoding="utf-8", errors="ignore")
        elif suffix == ".pdf":
            import pypdf
            reader = pypdf.PdfReader(str(file_path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        elif suffix == ".docx":
            from docx import Document
            doc = Document(str(file_path))
            return "\n".join(para.text for para in doc.paragraphs)
    except Exception as e:
        print(f"Error extracting {file_path}: {e}")
    return ""


def chunk_text(text: str, max_words: int = 300, overlap_words: int = 30) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if not paragraphs:
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]

    chunks: list[str] = []
    buffer: list[str] = []

    def flush():
        if buffer:
            chunks.append(" ".join(buffer))

    for para in paragraphs:
        words = para.split()
        if not words:
            continue
        if len(words) > max_words:
            flush()
            buffer = buffer[-overlap_words:] if overlap_words else []
            for sent in re.split(r"(?<=[.!?…])\s+", para):
                sw = sent.split()
                if len(buffer) + len(sw) > max_words:
                    flush()
                    buffer = buffer[-overlap_words:] if overlap_words else []
                buffer.extend(sw)
        elif len(buffer) + len(words) > max_words:
            flush()
            buffer = buffer[-overlap_words:] if overlap_words else []
            buffer.extend(words)
        else:
            buffer.extend(words)

    flush()
    return [c for c in chunks if c.strip()]


def add_chunks_to_collection(col, chunks, source, domain, id_offset=0):
    if not chunks:
        return
    col.add(
        ids=[f"{source}::{i + id_offset}" for i in range(len(chunks))],
        documents=chunks,
        metadatas=[{"source": source, "domaine": domain, "chunk_idx": i + id_offset} for i in range(len(chunks))],
    )


# ── Config endpoints ───────────────────────────────────────────────────────────

@app.get("/config")
def get_config():
    cfg = load_config()
    return {
        "has_anthropic": bool(cfg.get("anthropic_api_key")),
        "has_openai": bool(cfg.get("openai_api_key")),
        "ollama_url": cfg.get("ollama_url", "http://localhost:11434"),
        "anthropic_api_key": "••••••••" if cfg.get("anthropic_api_key") else "",
        "openai_api_key": "••••••••" if cfg.get("openai_api_key") else "",
    }


@app.post("/config")
def update_config(
    anthropic_api_key: str = Form(""),
    openai_api_key: str = Form(""),
    ollama_url: str = Form("http://localhost:11434"),
):
    cfg = load_config()
    if anthropic_api_key and "••" not in anthropic_api_key:
        cfg["anthropic_api_key"] = anthropic_api_key
    if openai_api_key and "••" not in openai_api_key:
        cfg["openai_api_key"] = openai_api_key
    cfg["ollama_url"] = ollama_url or "http://localhost:11434"
    save_config(cfg)
    return {"message": "Configuration sauvegardée"}


# ── Models endpoint ────────────────────────────────────────────────────────────

@app.get("/models")
async def list_models():
    cfg = load_config()
    models = []

    # Ollama local models
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{cfg.get('ollama_url', 'http://localhost:11434')}/api/tags")
            if resp.status_code == 200:
                for m in resp.json().get("models", []):
                    models.append({"id": m["name"], "name": m["name"], "provider": "Ollama (local)"})
    except Exception:
        pass

    # Anthropic models
    if cfg.get("anthropic_api_key"):
        for m in [
            {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6"},
            {"id": "claude-opus-4-7",   "name": "Claude Opus 4.7"},
            {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5"},
        ]:
            models.append({**m, "provider": "Anthropic"})

    # OpenAI models
    if cfg.get("openai_api_key"):
        for m in [
            {"id": "gpt-4o",       "name": "GPT-4o"},
            {"id": "gpt-4-turbo",  "name": "GPT-4 Turbo"},
            {"id": "gpt-3.5-turbo","name": "GPT-3.5 Turbo"},
        ]:
            models.append({**m, "provider": "OpenAI"})

    return models


# ── Chat (RAG) endpoint ────────────────────────────────────────────────────────

RAG_SYSTEM = """Tu es un assistant expert. Réponds à la question de l'utilisateur en te basant UNIQUEMENT sur les extraits de documents fournis ci-dessous.
Si la réponse n'est pas dans les documents, indique-le clairement plutôt que d'inventer.
Réponds dans la même langue que la question.

Documents pertinents :
---
{context}
---"""


@app.post("/chat")
async def chat(
    domain: str = Form(...),
    query: str = Form(...),
    model_id: str = Form(...),
    history: str = Form("[]"),
):
    cfg = load_config()
    collection = get_collection(domain)

    # 1. Vector search
    n = min(5, collection.count())
    if n == 0:
        raise HTTPException(400, "La base vectorielle est vide")

    results = collection.query(
        query_texts=[query],
        n_results=n,
        include=["documents", "metadatas", "distances"],
    )

    docs = results["documents"][0]
    metas = results["metadatas"][0]
    dists = results["distances"][0]

    sources = [
        {"file": m["source"], "score": round(1 - d, 4), "excerpt": doc[:150]}
        for m, d, doc in zip(metas, dists, docs)
    ]
    context = "\n---\n".join(docs)
    system_prompt = RAG_SYSTEM.format(context=context)

    # 2. Build message history (last 8 turns)
    conv = json.loads(history)[-8:]
    messages = [{"role": m["role"], "content": m["content"]} for m in conv]
    messages.append({"role": "user", "content": query})

    # 3. Stream response
    async def generate():
        # Send sources first
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        try:
            from llm import stream_anthropic, stream_openai, stream_ollama

            if model_id.startswith("claude"):
                key = cfg.get("anthropic_api_key", "")
                if not key:
                    raise ValueError("Clé API Anthropic non configurée")
                gen = stream_anthropic(model_id, messages, key, system_prompt)

            elif model_id.startswith("gpt"):
                key = cfg.get("openai_api_key", "")
                if not key:
                    raise ValueError("Clé API OpenAI non configurée")
                gen = stream_openai(model_id, [{"role": "system", "content": system_prompt}] + messages, key)

            else:
                # Ollama
                gen = stream_ollama(
                    model_id,
                    [{"role": "system", "content": system_prompt}] + messages,
                    cfg.get("ollama_url", "http://localhost:11434"),
                )

            async for token in gen:
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Domain endpoints ───────────────────────────────────────────────────────────

@app.post("/domain")
def create_domain(name: str = Form(...)):
    name = name.strip()
    if not name or "/" in name or "\\" in name:
        raise HTTPException(400, "Nom de domaine invalide")
    domain_path = DATA_DIR / name
    if domain_path.exists():
        raise HTTPException(400, "Ce domaine existe déjà")
    domain_path.mkdir(parents=True)
    return {"message": f"Domaine '{name}' créé"}


@app.get("/domains")
def list_domains():
    result = []
    for d in sorted(DATA_DIR.iterdir()):
        if not d.is_dir():
            continue
        files = sorted(f.name for f in d.iterdir() if f.is_file())
        has_vdb = collection_exists(d.name)
        chunk_count = 0
        if has_vdb:
            try:
                chunk_count = get_collection(d.name).count()
            except Exception:
                has_vdb = False
        result.append({"name": d.name, "files": files, "has_vector_db": has_vdb, "chunk_count": chunk_count})
    return result


@app.delete("/domain/{name}")
def delete_domain(name: str):
    domain_path = DATA_DIR / name
    if not domain_path.exists():
        raise HTTPException(404, "Domaine introuvable")
    shutil.rmtree(domain_path)
    if collection_exists(name):
        get_chroma_client().delete_collection(name=collection_name(name))
    return {"message": f"Domaine '{name}' supprimé"}


# ── File endpoints ─────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(domain: str = Form(...), file: UploadFile = File(...)):
    domain_path = DATA_DIR / domain
    if not domain_path.exists():
        raise HTTPException(404, "Domaine introuvable")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Format non supporté: {suffix}")
    content = await file.read()
    with open(domain_path / file.filename, "wb") as f:
        f.write(content)
    return {"message": f"Fichier '{file.filename}' uploadé", "filename": file.filename}


@app.delete("/file")
def delete_file(domain: str, filename: str):
    file_path = DATA_DIR / domain / filename
    if not file_path.exists():
        raise HTTPException(404, "Fichier introuvable")
    file_path.unlink()
    return {"message": f"Fichier '{filename}' supprimé"}


# ── Vector DB endpoints ────────────────────────────────────────────────────────

@app.post("/generate-vector-db")
def generate_vector_db(domain: str = Form(...)):
    domain_path = DATA_DIR / domain
    if not domain_path.exists():
        raise HTTPException(404, "Domaine introuvable")
    files = [f for f in domain_path.iterdir() if f.is_file()]
    if not files:
        raise HTTPException(400, "Aucun fichier dans ce domaine")

    if collection_exists(domain):
        get_chroma_client().delete_collection(name=collection_name(domain))
    col = get_or_create_collection(domain)

    total = 0
    for file_path in sorted(files):
        text = extract_text(file_path)
        if not text.strip():
            continue
        chunks = chunk_text(text)
        add_chunks_to_collection(col, chunks, file_path.name, domain, total)
        total += len(chunks)

    return {"message": f"Base vectorielle créée pour '{domain}'", "chunks": total}


@app.post("/update-vector-db")
def update_vector_db(domain: str = Form(...)):
    domain_path = DATA_DIR / domain
    if not domain_path.exists():
        raise HTTPException(404, "Domaine introuvable")
    if not collection_exists(domain):
        return generate_vector_db(domain)

    col = get_or_create_collection(domain)
    existing = col.get(include=["metadatas"])
    existing_sources = {m["source"] for m in existing["metadatas"]} if existing["metadatas"] else set()
    new_files = [f for f in sorted(domain_path.iterdir()) if f.is_file() and f.name not in existing_sources]

    if not new_files:
        return {"message": "Aucun nouveau fichier détecté", "new_chunks": 0}

    offset = col.count()
    new_chunks = 0
    for file_path in new_files:
        text = extract_text(file_path)
        if not text.strip():
            continue
        chunks = chunk_text(text)
        add_chunks_to_collection(col, chunks, file_path.name, domain, offset + new_chunks)
        new_chunks += len(chunks)

    return {"message": f"Base mise à jour", "new_chunks": new_chunks, "total_chunks": col.count()}


@app.post("/search")
def search(domain: str = Form(...), query: str = Form(...), top_k: int = Form(5)):
    col = get_collection(domain)
    n = min(top_k, col.count())
    results = col.query(query_texts=[query], n_results=n, include=["documents", "metadatas", "distances"])
    return [
        {"score": round(1 - d, 4), "id": i + 1, "text": doc, "source": m["source"], "domaine": m["domaine"]}
        for i, (doc, m, d) in enumerate(zip(results["documents"][0], results["metadatas"][0], results["distances"][0]))
    ]


@app.get("/vector-db/{domain}")
def get_vector_db(domain: str):
    col = get_collection(domain)
    data = col.get(include=["documents", "metadatas"])
    sources: dict[str, int] = {}
    chunks = []
    for i, (doc, meta) in enumerate(zip(data["documents"], data["metadatas"])):
        src = meta["source"]
        sources[src] = sources.get(src, 0) + 1
        chunks.append({"id": i + 1, "text": doc, "source": src})
    return {"domain": domain, "total_chunks": col.count(), "model": EMBED_MODEL, "sources": sources, "chunks": chunks}


@app.get("/health")
def health():
    return {"status": "ok"}
