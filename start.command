#!/bin/bash
# ============================================================
# Vector DB Generator — Démarrage du backend FastAPI
# Double-cliquez sur ce fichier pour lancer le serveur.
# ============================================================

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======================================"
echo " Vector DB Generator — Backend FastAPI"
echo "======================================"
echo ""
echo " Frontend  → http://localhost/AppBv1/"
echo " API docs  → http://localhost:8000/docs"
echo ""
echo " Démarrage du serveur..."
echo ""

# Lancer uvicorn avec le venv du projet
"$DIR/venv/bin/uvicorn" main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --app-dir "$DIR/backend"
