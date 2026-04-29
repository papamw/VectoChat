# VectoChat — Guide de reprise pour Claude

> Lis ce fichier en ENTIER au début de chaque session. Il remplace la lecture des archives.

---

## Projet en une phrase

Application RAG full-stack : upload de documents → génération de bases vectorielles (ChromaDB et/ou JSON) → chat avec un LLM qui répond en citant les sources.

---

## Stack technique

| Couche | Détail |
|---|---|
| Backend | FastAPI + Uvicorn, Python 3.11 |
| Embeddings | `paraphrase-multilingual-MiniLM-L12-v2` (384 dims, 50+ langues) |
| Vector DB | ChromaDB 0.6.3 (dossier `BV/`) + JSON maison (dossier `vector_db/`) |
| OCR | Tesseract 5.5 via pytesseract + pdf2image + Pillow |
| Frontend | React 18 + Vite + Tailwind CSS |
| LLM | Claude (Anthropic), GPT (OpenAI), modèles Ollama locaux |

---

## Arborescence critique

```
AppBv1/
├── backend/
│   ├── main.py              # TOUTE la logique backend (API + helpers)
│   └── llm.py               # Streamers LLM (Anthropic / OpenAI / Ollama)
├── frontend/src/
│   ├── App.jsx              # Routeur : 'chat' | 'vectordb' — persisté dans localStorage
│   ├── api/client.js        # Tous les appels HTTP (Axios, base /api)
│   ├── views/
│   │   ├── ChatView.jsx     # Interface de chat RAG
│   │   └── VectorDBView.jsx # Gestionnaire de bases vectorielles
│   └── components/
│       ├── DomainList.jsx         # Panneau gauche (liste domaines + boutons créer/importer)
│       ├── DomainContent.jsx      # Zone principale (fichiers, DB cards, actions)
│       ├── GenerateFormatModal.jsx # Choix du format : chroma | json | both
│       ├── JsonDBModal.jsx         # Exploration d'une base JSON
│       ├── ImportJsonModal.jsx     # Import d'un fichier JSON
│       ├── VectorDBModal.jsx       # Exploration d'une base ChromaDB
│       ├── FileUpload.jsx          # Upload drag&drop
│       ├── SearchModal.jsx         # Recherche sémantique
│       ├── CreateDomainModal.jsx   # Créer un domaine
│       ├── SettingsModal.jsx       # Clés API
│       └── Notification.jsx       # Toast notifications
├── data/                    # Documents uploadés (un sous-dossier par domaine)
├── BV/                      # Bases ChromaDB persistantes (chroma.sqlite3 + segments)
├── vector_db/               # Bases JSON (un fichier {domain}.json par domaine)
├── venv/                    # Python venv (Python 3.11)
├── config.json              # Clés API (NON versionné)
├── start.command            # Lance uvicorn (double-clic macOS)
└── CLAUDE.md                # CE FICHIER
```

---

## Commandes essentielles

```bash
# Démarrer le backend (depuis la racine)
/Users/papamamadouwade/AppBv1/venv/bin/uvicorn main:app \
  --host 0.0.0.0 --port 8000 --reload --app-dir backend

# Démarrer le frontend (dev)
cd frontend && npm run dev        # → http://localhost:5173

# Build de production
cd frontend && npm run build      # → frontend/dist/

# Vérifier syntaxe Python sans démarrer
python3 -c "import ast; ast.parse(open('backend/main.py').read()); print('OK')"

# Tuer le backend si port occupé
kill $(lsof -t -i:8000)
```

---

## Tous les endpoints API

### Config & modèles
| Méthode | URL | Description |
|---|---|---|
| GET | `/config` | Lire la config (clés masquées) |
| POST | `/config` | Sauvegarder clés API + URL Ollama |
| GET | `/models` | Lister modèles dispo (Ollama + Anthropic + OpenAI) |

### Chat RAG
| Méthode | URL | Description |
|---|---|---|
| POST | `/chat` | Stream SSE — cherche dans ChromaDB ou JSON selon dispo |

### Domaines
| Méthode | URL | Description |
|---|---|---|
| GET | `/domains` | Liste domaines avec status `has_chroma_db`, `has_json_db`, counts |
| POST | `/domain` | Créer un domaine (form: `name`) |
| DELETE | `/domain/{name}` | Supprimer domaine + ses deux BDs |

### Fichiers
| Méthode | URL | Description |
|---|---|---|
| POST | `/upload` | Uploader un fichier (form: `domain`, `file`) |
| DELETE | `/file` | Supprimer un fichier (params: `domain`, `filename`) |

### Génération & mise à jour
| Méthode | URL | Description |
|---|---|---|
| POST | `/generate-vector-db` | Générer (form: `domain`, `db_format`: `chroma`/`json`/`both`) |
| POST | `/update-vector-db` | Mise à jour incrémentale ChromaDB |

### Suppression sélective
| Méthode | URL | Description |
|---|---|---|
| DELETE | `/vector-db/{domain}/chroma` | Supprimer uniquement la base ChromaDB |
| DELETE | `/vector-db/{domain}/json` | Supprimer uniquement la base JSON |

### Exploration & recherche
| Méthode | URL | Description |
|---|---|---|
| GET | `/vector-db/{domain}` | Contenu ChromaDB (sans embeddings) |
| GET | `/json-db/{domain}` | Contenu JSON DB (sans embeddings) |
| POST | `/search` | Recherche sémantique (ChromaDB prioritaire, JSON fallback) |

### Export / Import JSON
| Méthode | URL | Description |
|---|---|---|
| GET | `/export-json/{domain}` | Exporte ChromaDB → JSON avec embeddings (Content-Disposition: attachment) |
| GET | `/download-json-db/{domain}` | Télécharge le fichier JSON DB existant sur disque |
| POST | `/import-json` | Importe un JSON → recrée la base ChromaDB |

### Santé
| Méthode | URL | Description |
|---|---|---|
| GET | `/health` | `{"status": "ok"}` |

---

## Format JSON des bases vectorielles

```json
{
  "domain": "nom_domaine",
  "model": "paraphrase-multilingual-MiniLM-L12-v2",
  "total_chunks": 42,
  "chunks": [
    {
      "id": "fichier.pdf::0",
      "text": "Texte du chunk...",
      "source": "fichier.pdf",
      "chunk_idx": 0,
      "embedding": [0.123, -0.456, ...]  // 384 floats
    }
  ]
}
```

---

## Formats de fichiers supportés

| Extension | Méthode d'extraction |
|---|---|
| `.txt`, `.md` | Lecture directe UTF-8 |
| `.docx` | python-docx |
| `.pdf` (texte) | pypdf |
| `.pdf` (scanné) | pypdf → si vide → OCR automatique (pdf2image + Tesseract) |
| `.jpg`, `.jpeg`, `.png`, `.tiff`, `.tif`, `.bmp`, `.webp`, `.gif` | Tesseract OCR |

**OCR** : Tesseract 5.5 installé via Homebrew (`/usr/local/bin/tesseract`), langues `fra+eng`.

---

## Comportements importants à connaître

### Chat RAG — priorité des BDs
Le `/chat` cherche d'abord dans ChromaDB. Si la collection n'existe pas, il utilise la base JSON (recherche cosinus numpy).

### Refresh de l'UI
Tous les `onRefresh()` dans `DomainContent.jsx` sont `await`-és. `fetchDomains` utilise `setSelectedDomain(prev => ...)` (forme fonctionnelle) pour éviter les stale closures.

### Persistance de la vue
`App.jsx` lit/écrit `localStorage.getItem('vectochat_view')` → F5 garde la page active.

### Export JSON
Le bouton "Exporter JSON" utilise un lien `<a>` direct vers `/api/export-json/{domain}`. Le backend envoie `Content-Disposition: attachment` pour forcer le téléchargement (contourne le problème numpy `truth value ambiguous`).

### collection_name()
ChromaDB exige des noms alphanumériques. `collection_name(domain)` remplace les caractères spéciaux par `_`. Ex : `Code-marchés-publiques` → `Code-march_s-publiques`.

---

## Contraintes techniques importantes

| Contrainte | Détail |
|---|---|
| `numpy<2` obligatoire | sentence-transformers 2.7.0 requiert numpy 1.x |
| `sentence-transformers==2.7.0` | Version fixée pour compatibilité PyTorch 2.2.2 |
| `chromadb==0.6.3` | Version exacte — les collections retournent des strings (pas des objets) |
| OCR = Tesseract système | `pytesseract` appelle `/usr/local/bin/tesseract` — doit être installé via Homebrew |
| pdf2image = poppler | `pdf2image` appelle `pdftoppm` de Poppler — installé via Homebrew |

---

## Ce qui a déjà été fait (historique des sessions)

### Session 1 — Base de l'application
- Application RAG initiale (ChromaDB uniquement)
- Upload fichiers, génération BDs, chat avec SSE streaming

### Session 2 — Support JSON
- Génération en 3 formats : `chroma` | `json` | `both`
- Modal `GenerateFormatModal` avec sélection du format
- Export JSON depuis ChromaDB (`/export-json`)
- Import JSON → recrée ChromaDB (`/import-json`)
- `JsonDBModal` pour explorer les bases JSON
- Boutons de suppression individuelle (ChromaDB seule / JSON seule)

### Session 3 — OCR + corrections bugs
- Support images (jpg, png, tiff, bmp, webp, gif) via Tesseract
- PDF scannés → OCR automatique si pypdf retourne vide
- Fix export JSON : `ValueError` numpy → `emb.tolist()` + `len(emb_list) > 0`
- Fix refresh : `await onRefresh()` partout dans `DomainContent.jsx`
- Fix persistance vue : `localStorage` dans `App.jsx`
- Fix `useCallback` stale closure → `setSelectedDomain(prev => ...)`
- Rapport de génération par fichier avec badge `OCR` et avertissements

---

## Points ouverts / à améliorer (si le client demande)

- **PDF scannés lents** : OCR sur 43 pages prend ~1-2 min — envisager une file d'attente ou un endpoint async
- **Chunking PDF multi-pages** : actuellement tout le texte en un seul passage — possibilité de chunker par page
- **Modèles OCR** : Tesseract est passable sur texte imprimé, médiocre sur texte manuscrit — envisager EasyOCR ou PaddleOCR pour améliorer
- **Mise à jour JSON incrémentale** : `/update-vector-db` ne met à jour que ChromaDB, pas le JSON
- **Authentification** : aucune — l'app est ouverte à tous sur le réseau local
- **Taille max upload** : 50 Mo côté frontend, pas de limite côté backend (à ajouter si besoin)
