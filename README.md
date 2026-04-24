# VectoChat

Application RAG (Retrieval-Augmented Generation) full-stack permettant de générer des bases de données vectorielles à partir de documents, puis d'interagir avec un modèle IA qui exploite ces bases pour répondre aux questions.

---

## Présentation

VectoChat se compose de deux modules :

- **Gestionnaire de bases vectorielles** — importez vos documents (PDF, DOCX, TXT, MD), générez des embeddings sémantiques et effectuez des recherches par similarité.
- **Interface de chat** — conversez avec le modèle IA de votre choix (Claude, GPT, Llama via Ollama) en exploitant vos bases vectorielles comme source de connaissance.

**Stack technique**

| Couche | Technologie |
|---|---|
| Backend | FastAPI + Uvicorn |
| Base vectorielle | ChromaDB (index HNSW, similarité cosinus) |
| Embeddings | `paraphrase-multilingual-MiniLM-L12-v2` (50+ langues) |
| Frontend | React 18 + Vite + Tailwind CSS |
| LLM supportés | Anthropic Claude, OpenAI GPT, Ollama (local) |

---

## Prérequis

### Obligatoires

| Outil | Version minimale | Vérification |
|---|---|---|
| Python | 3.10+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Serveur web | Apache ou Nginx | — |

### Optionnels (selon les modèles utilisés)

| Outil | Usage |
|---|---|
| [Ollama](https://ollama.com) | Exécuter des modèles IA en local (Llama, Mistral, Gemma…) |
| Clé API Anthropic | Accéder aux modèles Claude |
| Clé API OpenAI | Accéder aux modèles GPT |

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/papamw/VectoChat.git
cd VectoChat
```

### 2. Backend Python

```bash
# Créer l'environnement virtuel
python3 -m venv venv

# Activer l'environnement
source venv/bin/activate          # macOS / Linux
# venv\Scripts\activate           # Windows

# Installer les dépendances
pip install -r backend/requirements.txt
```

> La première installation télécharge le modèle d'embeddings (~120 Mo). Cela peut prendre quelques minutes.

### 3. Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

Le dossier `frontend/dist/` contient les fichiers statiques prêts à être servis.

### 4. Serveur web — exposer le frontend

#### Apache

Créez ou modifiez votre configuration Apache pour pointer vers le dossier `dist/` :

```apache
Alias /AppBv1 "/chemin/vers/VectoChat/frontend/dist"

<Directory "/chemin/vers/VectoChat/frontend/dist">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
```

Redémarrez Apache :

```bash
sudo apachectl restart        # macOS
sudo systemctl restart apache2  # Linux
```

#### Nginx

```nginx
location /AppBv1/ {
    alias /chemin/vers/VectoChat/frontend/dist/;
    try_files $uri $uri/ /AppBv1/index.html;
}
```

Redémarrez Nginx :

```bash
sudo systemctl restart nginx
```

L'interface sera accessible à l'adresse : **http://localhost/AppBv1/**

---

## Configuration

### Clés API et URL Ollama

Une fois l'application démarrée, ouvrez **Paramètres & clés API** dans la sidebar (bas gauche de l'interface de chat).

Vous pouvez y renseigner :

| Champ | Description |
|---|---|
| Clé API Anthropic | Commence par `sk-ant-…` — pour les modèles Claude |
| Clé API OpenAI | Commence par `sk-…` — pour GPT-4o, GPT-4 Turbo |
| URL Ollama | Par défaut `http://localhost:11434` |

Les clés sont sauvegardées localement dans `config.json` (exclu du dépôt git).

### Modèles locaux avec Ollama

1. [Téléchargez et installez Ollama](https://ollama.com/download)
2. Tirez un modèle :

```bash
ollama pull llama3          # Llama 3 8B
ollama pull mistral         # Mistral 7B
ollama pull gemma3          # Gemma 3
```

3. Ollama démarre automatiquement sur `http://localhost:11434`. Les modèles installés apparaissent automatiquement dans le sélecteur de l'interface.

---

## Démarrage

### macOS — double-clic

Double-cliquez sur **`start.command`** à la racine du projet.

> Si macOS bloque l'exécution : clic droit → **Ouvrir** → Ouvrir quand même.

### Terminal

```bash
./start.command
```

Le backend FastAPI démarre sur le port **8000**.

| URL | Description |
|---|---|
| `http://localhost/AppBv1/` | Interface utilisateur |
| `http://localhost:8000/docs` | Documentation API interactive (Swagger) |

---

## Utilisation

### 1. Créer une base vectorielle

1. Cliquez sur **Gérer les bases vectorielles** (sidebar)
2. Créez un **domaine** (ex : `juridique`, `technique`, `rh`)
3. **Uploadez** vos documents (PDF, DOCX, TXT, MD)
4. Cliquez sur **Générer la base vectorielle**

### 2. Chatter avec vos documents

1. Revenez à l'accueil (VectoChat)
2. Sélectionnez un **modèle IA** dans la barre supérieure
3. Sélectionnez la **base vectorielle** correspondante
4. Posez vos questions — le modèle répond en citant les sources

### Formats de documents supportés

| Format | Extension |
|---|---|
| PDF | `.pdf` |
| Word | `.docx` |
| Texte brut | `.txt` |
| Markdown | `.md` |

---

## Structure du projet

```
VectoChat/
├── backend/
│   ├── main.py              # API FastAPI (endpoints)
│   ├── llm.py               # Adaptateurs LLM (Ollama, Anthropic, OpenAI)
│   └── requirements.txt     # Dépendances Python
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      # Routeur principal (chat ↔ vectorDB)
│   │   ├── api/client.js                # Client HTTP (Axios)
│   │   ├── views/
│   │   │   ├── ChatView.jsx             # Interface de chat RAG
│   │   │   └── VectorDBView.jsx         # Gestionnaire de bases
│   │   └── components/
│   │       ├── SettingsModal.jsx        # Paramètres & clés API
│   │       ├── DomainList.jsx           # Liste des domaines
│   │       ├── DomainContent.jsx        # Contenu d'un domaine
│   │       ├── FileUpload.jsx           # Upload de fichiers
│   │       ├── SearchModal.jsx          # Recherche sémantique
│   │       └── VectorDBModal.jsx        # Inspection de la base
│   ├── dist/                # Build de production (généré par npm run build)
│   └── package.json
├── data/                    # Documents uploadés (exclu du dépôt)
├── chroma_db/               # Bases vectorielles (exclu du dépôt)
├── config.json              # Clés API (exclu du dépôt)
├── start.command            # Script de démarrage macOS
└── README.md
```

---

## Données locales

Les dossiers suivants sont créés automatiquement au premier démarrage et **ne sont pas versionnés** :

| Dossier / Fichier | Contenu |
|---|---|
| `data/` | Documents uploadés par domaine |
| `chroma_db/` | Index vectoriels persistants |
| `config.json` | Clés API et URL Ollama |

---

## Dépannage

**Le backend ne démarre pas**
```bash
# Vérifier que le venv est bien créé
ls venv/bin/uvicorn

# Relancer l'installation
pip install -r backend/requirements.txt
```

**"Aucun modèle disponible" dans l'interface**
- Configurez une clé API dans **Paramètres & clés API**
- Ou vérifiez qu'Ollama est lancé : `ollama list`

**L'interface ne s'affiche pas**
- Vérifiez que le build est à jour : `cd frontend && npm run build`
- Vérifiez la configuration Apache/Nginx et rechargez le serveur web

**Erreur CORS**
- Le backend doit tourner sur `http://localhost:8000`
- Vérifiez que `start.command` est bien exécuté avant d'utiliser l'interface
