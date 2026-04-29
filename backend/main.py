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

BASE_DIR   = Path(__file__).parent.parent
DATA_DIR   = BASE_DIR / "data"
CHROMA_DIR = BASE_DIR / "BV"
JSON_DB_DIR = BASE_DIR / "vector_db"
CONFIG_PATH = BASE_DIR / "config.json"

DATA_DIR.mkdir(exist_ok=True)
CHROMA_DIR.mkdir(exist_ok=True)
JSON_DB_DIR.mkdir(exist_ok=True)

# Migrate old chroma_db/ → BV/ if needed
_old_chroma = BASE_DIR / "chroma_db"
if _old_chroma.exists() and not any(CHROMA_DIR.iterdir()):
    import shutil as _shutil
    for item in _old_chroma.iterdir():
        _shutil.move(str(item), str(CHROMA_DIR / item.name))
    _old_chroma.rmdir()

IMAGE_EXTENSIONS  = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp", ".gif"}
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".md"} | IMAGE_EXTENSIONS
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
OCR_LANG    = "fra+eng"   # langues Tesseract par défaut

_chroma_client = None
_embedding_fn  = None
_sentence_transformer = None


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


def get_sentence_transformer():
    """SentenceTransformer direct (pour générer des embeddings JSON)."""
    global _sentence_transformer
    if _sentence_transformer is None:
        from sentence_transformers import SentenceTransformer
        _sentence_transformer = SentenceTransformer(EMBED_MODEL)
    return _sentence_transformer


def collection_name(domain: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9_-]", "_", domain)
    if len(name) < 3:
        name = name + "_db"
    return name[:63]


def collection_exists(domain: str) -> bool:
    return collection_name(domain) in get_chroma_client().list_collections()


def get_collection(domain: str):
    try:
        return get_chroma_client().get_collection(
            name=collection_name(domain), embedding_function=get_embedding_fn()
        )
    except Exception:
        raise HTTPException(404, f"Aucune base ChromaDB pour le domaine '{domain}'")


def get_or_create_collection(domain: str):
    return get_chroma_client().get_or_create_collection(
        name=collection_name(domain),
        embedding_function=get_embedding_fn(),
        metadata={"hnsw:space": "cosine", "model": EMBED_MODEL, "domain": domain},
    )


# ── JSON DB helpers ────────────────────────────────────────────────────────────

def json_db_path(domain: str) -> Path:
    return JSON_DB_DIR / f"{domain}.json"


def json_db_exists(domain: str) -> bool:
    return json_db_path(domain).exists()


def load_json_db(domain: str) -> dict:
    path = json_db_path(domain)
    if not path.exists():
        raise HTTPException(404, f"Aucune base JSON pour le domaine '{domain}'")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def search_json_db(domain: str, query: str, top_k: int = 5) -> list[dict]:
    """Recherche par similarité cosinus dans une base JSON."""
    import numpy as np

    data = load_json_db(domain)
    chunks = data.get("chunks", [])
    if not chunks:
        raise HTTPException(400, "La base JSON est vide")
    if "embedding" not in chunks[0]:
        raise HTTPException(400, "La base JSON ne contient pas d'embeddings")

    model = get_sentence_transformer()
    query_emb = model.encode([query])[0]          # (dim,)
    query_emb = query_emb / (np.linalg.norm(query_emb) + 1e-10)

    texts = [c["text"] for c in chunks]
    matrix = np.array([c["embedding"] for c in chunks], dtype=np.float32)
    # normalise rows
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    matrix = matrix / (norms + 1e-10)

    scores = matrix @ query_emb                   # cosine similarity
    top_idx = np.argsort(scores)[::-1][:top_k]

    return [
        {
            "score": float(scores[i]),
            "text":  chunks[i]["text"],
            "source": chunks[i].get("source", ""),
            "id":    chunks[i].get("id", str(i)),
        }
        for i in top_idx
    ]


# ── OCR helpers ────────────────────────────────────────────────────────────────

def _ocr_image_file(file_path: Path) -> str:
    """Extrait le texte d'une image via Tesseract OCR."""
    import pytesseract
    from PIL import Image
    img = Image.open(str(file_path))
    # Convertir en RGB si nécessaire (ex: PNG RGBA)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return pytesseract.image_to_string(img, lang=OCR_LANG)


def _ocr_pdf(file_path: Path) -> str:
    """OCR sur un PDF scanné : chaque page → image → Tesseract."""
    from pdf2image import convert_from_path
    import pytesseract
    pages = convert_from_path(str(file_path), dpi=200)
    texts = []
    for page_img in pages:
        texts.append(pytesseract.image_to_string(page_img, lang=OCR_LANG))
    return "\n\n".join(t for t in texts if t.strip())


# ── Text helpers ───────────────────────────────────────────────────────────────

def extract_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    try:
        if suffix in (".txt", ".md"):
            return file_path.read_text(encoding="utf-8", errors="ignore")

        elif suffix == ".pdf":
            import pypdf
            reader = pypdf.PdfReader(str(file_path))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            if not text.strip():
                # PDF scanné → OCR automatique
                print(f"[OCR] PDF texte vide, lancement OCR sur {file_path.name}")
                text = _ocr_pdf(file_path)
            return text

        elif suffix == ".docx":
            from docx import Document
            doc = Document(str(file_path))
            return "\n".join(para.text for para in doc.paragraphs)

        elif suffix in IMAGE_EXTENSIONS:
            return _ocr_image_file(file_path)

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


# ── Core generation helpers ────────────────────────────────────────────────────

def _file_info(file_path: Path) -> dict:
    """Extrait texte + indique si OCR utilisé."""
    suffix = file_path.suffix.lower()
    ocr_used = suffix in IMAGE_EXTENSIONS
    text = ""
    try:
        if suffix == ".pdf":
            import pypdf
            reader = pypdf.PdfReader(str(file_path))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            if not text.strip():
                print(f"[OCR] PDF scanné détecté : {file_path.name}")
                text = _ocr_pdf(file_path)
                ocr_used = True
        else:
            text = extract_text(file_path)
    except Exception as e:
        print(f"Error extracting {file_path}: {e}")
    return {"text": text, "ocr": ocr_used}


def _do_generate_chroma(domain: str, files: list[Path]) -> tuple[int, list[dict]]:
    """Génère (ou recrée) la base ChromaDB. Retourne (total_chunks, per_file_stats)."""
    if collection_exists(domain):
        get_chroma_client().delete_collection(name=collection_name(domain))
    col = get_or_create_collection(domain)
    total = 0
    stats = []
    for file_path in sorted(files):
        info = _file_info(file_path)
        text = info["text"]
        if not text.strip():
            stats.append({"file": file_path.name, "chunks": 0, "ocr": info["ocr"],
                          "warning": "texte vide ou illisible"})
            continue
        chunks = chunk_text(text)
        add_chunks_to_collection(col, chunks, file_path.name, domain, total)
        total += len(chunks)
        stats.append({"file": file_path.name, "chunks": len(chunks), "ocr": info["ocr"]})
    return total, stats


def _do_generate_json(domain: str, files: list[Path]) -> tuple[int, list[dict]]:
    """Génère la base JSON avec embeddings. Retourne (total_chunks, per_file_stats)."""
    model = get_sentence_transformer()
    all_chunks = []
    total = 0
    stats = []

    for file_path in sorted(files):
        info = _file_info(file_path)
        text = info["text"]
        if not text.strip():
            stats.append({"file": file_path.name, "chunks": 0, "ocr": info["ocr"],
                          "warning": "texte vide ou illisible"})
            continue
        chunks = chunk_text(text)
        if not chunks:
            stats.append({"file": file_path.name, "chunks": 0, "ocr": info["ocr"],
                          "warning": "aucun chunk généré"})
            continue
        embeddings = model.encode(chunks, show_progress_bar=False)
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            all_chunks.append({
                "id": f"{file_path.name}::{total + i}",
                "text": chunk,
                "source": file_path.name,
                "chunk_idx": total + i,
                "embedding": emb.tolist(),
            })
        total += len(chunks)
        stats.append({"file": file_path.name, "chunks": len(chunks), "ocr": info["ocr"]})

    payload = {
        "domain": domain,
        "model": EMBED_MODEL,
        "total_chunks": len(all_chunks),
        "chunks": all_chunks,
    }
    with open(json_db_path(domain), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    return len(all_chunks), stats


# ── Config endpoints ───────────────────────────────────────────────────────────

@app.get("/config")
def get_config():
    cfg = load_config()
    return {
        "has_anthropic": bool(cfg.get("anthropic_api_key")),
        "has_openai":    bool(cfg.get("openai_api_key")),
        "ollama_url":    cfg.get("ollama_url", "http://localhost:11434"),
        "anthropic_api_key": "••••••••" if cfg.get("anthropic_api_key") else "",
        "openai_api_key":    "••••••••" if cfg.get("openai_api_key") else "",
    }


@app.post("/config")
def update_config(
    anthropic_api_key: str = Form(""),
    openai_api_key: str    = Form(""),
    ollama_url: str        = Form("http://localhost:11434"),
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

    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{cfg.get('ollama_url', 'http://localhost:11434')}/api/tags")
            if resp.status_code == 200:
                for m in resp.json().get("models", []):
                    models.append({"id": m["name"], "name": m["name"], "provider": "Ollama (local)"})
    except Exception:
        pass

    if cfg.get("anthropic_api_key"):
        for m in [
            {"id": "claude-sonnet-4-6",            "name": "Claude Sonnet 4.6"},
            {"id": "claude-opus-4-7",              "name": "Claude Opus 4.7"},
            {"id": "claude-haiku-4-5-20251001",    "name": "Claude Haiku 4.5"},
        ]:
            models.append({**m, "provider": "Anthropic"})

    if cfg.get("openai_api_key"):
        for m in [
            {"id": "gpt-4o",        "name": "GPT-4o"},
            {"id": "gpt-4-turbo",   "name": "GPT-4 Turbo"},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
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
    domain: str    = Form(...),
    query: str     = Form(...),
    model_id: str  = Form(...),
    history: str   = Form("[]"),
):
    cfg = load_config()

    # 1. Vector search — préfère ChromaDB, fallback JSON
    if collection_exists(domain):
        collection = get_collection(domain)
        n = min(5, collection.count())
        if n == 0:
            raise HTTPException(400, "La base ChromaDB est vide")
        results = collection.query(
            query_texts=[query],
            n_results=n,
            include=["documents", "metadatas", "distances"],
        )
        docs  = results["documents"][0]
        metas = results["metadatas"][0]
        dists = results["distances"][0]
        sources = [
            {"file": m["source"], "score": round(1 - d, 4), "excerpt": doc[:150]}
            for m, d, doc in zip(metas, dists, docs)
        ]

    elif json_db_exists(domain):
        hits = search_json_db(domain, query, top_k=5)
        docs    = [h["text"] for h in hits]
        sources = [{"file": h["source"], "score": round(h["score"], 4), "excerpt": h["text"][:150]} for h in hits]

    else:
        raise HTTPException(404, f"Aucune base vectorielle pour le domaine '{domain}'")

    context       = "\n---\n".join(docs)
    system_prompt = RAG_SYSTEM.format(context=context)

    # 2. History
    conv     = json.loads(history)[-8:]
    messages = [{"role": m["role"], "content": m["content"]} for m in conv]
    messages.append({"role": "user", "content": query})

    # 3. Stream
    async def generate():
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

        # ChromaDB status
        has_chroma  = collection_exists(d.name)
        chroma_count = 0
        if has_chroma:
            try:
                chroma_count = get_collection(d.name).count()
            except Exception:
                has_chroma = False

        # JSON DB status
        has_json     = json_db_exists(d.name)
        json_count   = 0
        if has_json:
            try:
                with open(json_db_path(d.name), encoding="utf-8") as f:
                    jdata = json.load(f)
                json_count = jdata.get("total_chunks", len(jdata.get("chunks", [])))
            except Exception:
                has_json = False

        result.append({
            "name":           d.name,
            "files":          files,
            # legacy field (true if any db exists)
            "has_vector_db":  has_chroma or has_json,
            "chunk_count":    chroma_count or json_count,
            # detailed
            "has_chroma_db":  has_chroma,
            "chroma_count":   chroma_count,
            "has_json_db":    has_json,
            "json_count":     json_count,
        })
    return result


@app.delete("/domain/{name}")
def delete_domain(name: str):
    domain_path = DATA_DIR / name
    if not domain_path.exists():
        raise HTTPException(404, "Domaine introuvable")
    shutil.rmtree(domain_path)
    if collection_exists(name):
        get_chroma_client().delete_collection(name=collection_name(name))
    if json_db_exists(name):
        json_db_path(name).unlink(missing_ok=True)
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


# ── Vector DB generation ───────────────────────────────────────────────────────

@app.post("/generate-vector-db")
def generate_vector_db(
    domain:    str = Form(...),
    db_format: str = Form("chroma"),   # "chroma" | "json" | "both"
):
    """
    Génère la base vectorielle dans le format choisi.
    db_format : "chroma" | "json" | "both"
    """
    domain_path = DATA_DIR / domain
    if not domain_path.exists():
        raise HTTPException(404, "Domaine introuvable")

    files = [f for f in domain_path.iterdir() if f.is_file()]
    if not files:
        raise HTTPException(400, "Aucun fichier dans ce domaine")

    db_format = db_format.lower().strip()
    if db_format not in ("chroma", "json", "both"):
        raise HTTPException(400, "Format invalide. Valeurs acceptées : chroma, json, both")

    chroma_chunks, chroma_stats = 0, []
    json_chunks,   json_stats   = 0, []

    if db_format in ("chroma", "both"):
        chroma_chunks, chroma_stats = _do_generate_chroma(domain, files)

    if db_format in ("json", "both"):
        json_chunks, json_stats = _do_generate_json(domain, files)

    total     = chroma_chunks or json_chunks
    all_stats = chroma_stats or json_stats
    warnings  = [s for s in all_stats if "warning" in s]

    msg_parts = []
    if chroma_chunks:
        msg_parts.append(f"ChromaDB ({chroma_chunks} chunks)")
    if json_chunks:
        msg_parts.append(f"JSON ({json_chunks} chunks)")

    if not msg_parts:
        msg = f"Aucun chunk généré pour '{domain}'. Vérifiez que vos fichiers contiennent du texte lisible."
    else:
        msg = f"Base vectorielle créée pour '{domain}' : {' + '.join(msg_parts)}"

    return {
        "message":       msg,
        "format":        db_format,
        "chunks":        total,
        "chroma_chunks": chroma_chunks,
        "json_chunks":   json_chunks,
        "files":         all_stats,
        "warnings":      warnings,
    }


@app.delete("/vector-db/{domain}/chroma")
def delete_chroma_db(domain: str):
    """Supprime uniquement la base ChromaDB d'un domaine."""
    if not collection_exists(domain):
        raise HTTPException(404, f"Aucune base ChromaDB pour '{domain}'")
    get_chroma_client().delete_collection(name=collection_name(domain))
    return {"message": f"Base ChromaDB '{domain}' supprimée"}


@app.delete("/vector-db/{domain}/json")
def delete_json_db_endpoint(domain: str):
    """Supprime uniquement la base JSON d'un domaine."""
    if not json_db_exists(domain):
        raise HTTPException(404, f"Aucune base JSON pour '{domain}'")
    json_db_path(domain).unlink()
    return {"message": f"Base JSON '{domain}' supprimée"}


@app.get("/json-db/{domain}")
def get_json_db(domain: str):
    """Retourne le contenu de la base JSON (sans les embeddings pour alléger)."""
    data = load_json_db(domain)
    chunks = data.get("chunks", [])
    sources: dict[str, int] = {}
    chunks_light = []
    for c in chunks:
        src = c.get("source", "")
        sources[src] = sources.get(src, 0) + 1
        chunks_light.append({
            "id":     c.get("id", ""),
            "text":   c.get("text", ""),
            "source": src,
            "has_embedding": "embedding" in c,
        })
    return {
        "domain":       domain,
        "model":        data.get("model", ""),
        "total_chunks": data.get("total_chunks", len(chunks)),
        "sources":      sources,
        "chunks":       chunks_light,
    }


@app.post("/update-vector-db")
def update_vector_db(domain: str = Form(...)):
    """Met à jour la base ChromaDB avec les nouveaux fichiers."""
    domain_path = DATA_DIR / domain
    if not domain_path.exists():
        raise HTTPException(404, "Domaine introuvable")
    if not collection_exists(domain):
        chunks, stats = _do_generate_chroma(domain, list(domain_path.iterdir()))
        return {"message": f"Base créée ({chunks} chunks)", "new_chunks": chunks, "total_chunks": chunks}

    col = get_or_create_collection(domain)
    existing = col.get(include=["metadatas"])
    existing_sources = {m["source"] for m in existing["metadatas"]} if existing["metadatas"] else set()
    new_files = [f for f in sorted(domain_path.iterdir()) if f.is_file() and f.name not in existing_sources]

    if not new_files:
        return {"message": "Aucun nouveau fichier détecté", "new_chunks": 0}

    offset     = col.count()
    new_chunks = 0
    for file_path in new_files:
        text = extract_text(file_path)
        if not text.strip():
            continue
        chunks = chunk_text(text)
        add_chunks_to_collection(col, chunks, file_path.name, domain, offset + new_chunks)
        new_chunks += len(chunks)

    return {"message": "Base mise à jour", "new_chunks": new_chunks, "total_chunks": col.count()}


# ── Search endpoints ───────────────────────────────────────────────────────────

@app.post("/search")
def search(domain: str = Form(...), query: str = Form(...), top_k: int = Form(5)):
    """Recherche sémantique — ChromaDB en priorité, JSON en fallback."""
    if collection_exists(domain):
        col = get_collection(domain)
        n   = min(top_k, col.count())
        results = col.query(query_texts=[query], n_results=n, include=["documents", "metadatas", "distances"])
        return [
            {"score": round(1 - d, 4), "id": i + 1, "text": doc, "source": m["source"], "domaine": m["domaine"]}
            for i, (doc, m, d) in enumerate(zip(
                results["documents"][0], results["metadatas"][0], results["distances"][0]
            ))
        ]

    if json_db_exists(domain):
        hits = search_json_db(domain, query, top_k=top_k)
        return [
            {"score": round(h["score"], 4), "id": i + 1, "text": h["text"], "source": h["source"], "domaine": domain}
            for i, h in enumerate(hits)
        ]

    raise HTTPException(404, f"Aucune base vectorielle pour '{domain}'")


@app.get("/vector-db/{domain}")
def get_vector_db(domain: str):
    col  = get_collection(domain)
    data = col.get(include=["documents", "metadatas"])
    sources: dict[str, int] = {}
    chunks = []
    for i, (doc, meta) in enumerate(zip(data["documents"], data["metadatas"])):
        src = meta["source"]
        sources[src] = sources.get(src, 0) + 1
        chunks.append({"id": i + 1, "text": doc, "source": src})
    return {"domain": domain, "total_chunks": col.count(), "model": EMBED_MODEL, "sources": sources, "chunks": chunks}


# ── Export / Import JSON ───────────────────────────────────────────────────────

@app.get("/export-json/{domain}")
def export_json_db(domain: str, embeddings: bool = True):
    """Exporte la base ChromaDB d'un domaine au format JSON — déclenche un téléchargement."""
    from fastapi.responses import Response as FastResponse

    col      = get_collection(domain)
    includes = ["documents", "metadatas"]
    if embeddings:
        includes.append("embeddings")

    data      = col.get(include=includes)
    emb_list  = data.get("embeddings")                  # liste ou None
    has_emb   = embeddings and emb_list is not None and len(emb_list) > 0

    chunks = []
    for i, (doc_id, doc, meta) in enumerate(zip(data["ids"], data["documents"], data["metadatas"])):
        chunk = {
            "id":        doc_id,
            "text":      doc,
            "source":    meta.get("source", ""),
            "chunk_idx": meta.get("chunk_idx", i),
        }
        if has_emb:
            emb = emb_list[i]
            # Convertir numpy array → liste Python si nécessaire
            chunk["embedding"] = emb.tolist() if hasattr(emb, "tolist") else list(emb)
        chunks.append(chunk)

    payload = {"domain": domain, "model": EMBED_MODEL, "total_chunks": len(chunks), "chunks": chunks}
    content = json.dumps(payload, ensure_ascii=False, indent=2)
    safe_name = re.sub(r'[^\w\-.]', '_', domain)
    return FastResponse(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.json"'},
    )


@app.get("/download-json-db/{domain}")
def download_json_db(domain: str):
    """Télécharge directement le fichier JSON DB depuis le disque."""
    from fastapi.responses import FileResponse
    path = json_db_path(domain)
    if not path.exists():
        raise HTTPException(404, f"Aucune base JSON pour '{domain}'")
    safe_name = re.sub(r'[^\w\-.]', '_', domain)
    return FileResponse(
        path=str(path),
        media_type="application/json",
        filename=f"{safe_name}.json",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.json"'},
    )


@app.post("/import-json")
async def import_json_db(
    file: UploadFile = File(...),
    domain_name: str = Form(""),
):
    """Importe une base vectorielle depuis un fichier JSON."""
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(400, "Fichier JSON invalide")

    if "chunks" not in data or not isinstance(data["chunks"], list):
        raise HTTPException(400, "Format invalide : clé 'chunks' (liste) manquante")

    chunks = data["chunks"]
    if not chunks:
        raise HTTPException(400, "Le fichier JSON ne contient aucun chunk")

    name = (
        domain_name.strip()
        or data.get("domain", "").strip()
        or Path(file.filename).stem
    )
    name = re.sub(r"[^a-zA-Z0-9_-]", "_", name).strip("_")
    if not name:
        raise HTTPException(400, "Nom de domaine invalide")

    (DATA_DIR / name).mkdir(parents=True, exist_ok=True)

    if collection_exists(name):
        get_chroma_client().delete_collection(name=collection_name(name))

    has_embeddings = "embedding" in chunks[0]

    if has_embeddings:
        col = get_chroma_client().get_or_create_collection(
            name=collection_name(name),
            metadata={"hnsw:space": "cosine", "model": data.get("model", EMBED_MODEL), "domain": name},
        )
        batch_size = 200
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start: start + batch_size]
            col.add(
                ids=[c.get("id", f"chunk_{start + j}") for j, c in enumerate(batch)],
                documents=[c["text"] for c in batch],
                embeddings=[c["embedding"] for c in batch],
                metadatas=[{
                    "source":    c.get("source", file.filename),
                    "domaine":   name,
                    "chunk_idx": c.get("chunk_idx", start + j),
                } for j, c in enumerate(batch)],
            )
    else:
        col = get_or_create_collection(name)
        batch_size = 200
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start: start + batch_size]
            col.add(
                ids=[c.get("id", f"chunk_{start + j}") for j, c in enumerate(batch)],
                documents=[c["text"] for c in batch],
                metadatas=[{
                    "source":    c.get("source", file.filename),
                    "domaine":   name,
                    "chunk_idx": c.get("chunk_idx", start + j),
                } for j, c in enumerate(batch)],
            )

    return {
        "message":          f"Base JSON importée sous le domaine '{name}'",
        "domain":           name,
        "chunks":           len(chunks),
        "embeddings_reused": has_embeddings,
    }


@app.get("/health")
def health():
    return {"status": "ok"}
