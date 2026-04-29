import { useState } from 'react'
import {
  Trash2,
  UploadCloud,
  Zap,
  RefreshCw,
  Search,
  Database,
  FileJson,
  ChevronRight,
  Eye,
  Download,
  Layers,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import FileUpload from './FileUpload'
import SearchModal from './SearchModal'
import VectorDBModal from './VectorDBModal'
import JsonDBModal from './JsonDBModal'
import GenerateFormatModal from './GenerateFormatModal'
import * as api from '../api/client'

const FILE_ICONS = {
  pdf: '📄', txt: '📝', docx: '📋', md: '📑',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', tiff: '🖼️',
  tif: '🖼️', bmp: '🖼️', webp: '🖼️', gif: '🖼️',
}
const IMAGE_EXTS = new Set(['jpg','jpeg','png','tiff','tif','bmp','webp','gif'])
const EMBED_MODEL_LABEL = 'paraphrase-multilingual-MiniLM-L12-v2'

function fileIcon(name) {
  return FILE_ICONS[name.split('.').pop()?.toLowerCase()] || '📁'
}
function formatExt(name) {
  return name.split('.').pop()?.toUpperCase() || ''
}
function isImage(name) {
  return IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase())
}

export default function DomainContent({ domain, onRefresh, onNotify }) {
  const [showUpload,    setShowUpload]    = useState(false)
  const [showSearch,    setShowSearch]    = useState(false)
  const [showChromaDB,  setShowChromaDB]  = useState(false)
  const [showJsonDB,    setShowJsonDB]    = useState(false)
  const [showGenFormat, setShowGenFormat] = useState(false)
  const [vectorizing,   setVectorizing]   = useState(false)
  const [updating,      setUpdating]      = useState(false)
  const [deletingChroma,setDeletingChroma]= useState(false)
  const [deletingJson,  setDeletingJson]  = useState(false)
  const [deletingFile,  setDeletingFile]  = useState(null)
  const [genResult,     setGenResult]     = useState(null)  // résultat de la dernière génération

  if (!domain) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12">
        <Database className="w-16 h-16 text-gray-100 mb-4" />
        <h2 className="text-lg font-semibold text-gray-400 mb-1">Sélectionnez un domaine</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Choisissez un domaine dans la colonne de gauche ou créez-en un nouveau.
        </p>
      </div>
    )
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleDeleteFile = async (filename) => {
    if (!confirm(`Supprimer "${filename}" ?`)) return
    setDeletingFile(filename)
    try {
      await api.deleteFile(domain.name, filename)
      onNotify(`Fichier "${filename}" supprimé`)
      await onRefresh()
    } catch {
      onNotify('Erreur suppression fichier', 'error')
    } finally {
      setDeletingFile(null)
    }
  }

  const handleGenerate = async (format) => {
    setVectorizing(true)
    setGenResult(null)
    try {
      const res = await api.generateVectorDB(domain.name, format)
      setGenResult(res.data)
      if (res.data.chunks === 0) {
        onNotify('Génération terminée mais aucun chunk — vérifiez les fichiers', 'error')
      } else {
        onNotify(res.data.message)
      }
      await onRefresh()          // ← attendu avant de fermer le modal
    } catch (e) {
      onNotify(e.response?.data?.detail || 'Erreur génération', 'error')
    } finally {
      setVectorizing(false)
      setShowGenFormat(false)
    }
  }

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      const res = await api.updateVectorDB(domain.name)
      onNotify(res.data.message + (res.data.new_chunks ? ` (${res.data.new_chunks} nouveaux chunks)` : ''))
      await onRefresh()
    } catch (e) {
      onNotify(e.response?.data?.detail || 'Erreur mise à jour', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteChroma = async () => {
    if (!confirm(`Supprimer la base ChromaDB du domaine "${domain.name}" ?`)) return
    setDeletingChroma(true)
    try {
      await api.deleteChromaDB(domain.name)
      onNotify(`Base ChromaDB "${domain.name}" supprimée`)
      await onRefresh()
    } catch (e) {
      onNotify(e.response?.data?.detail || 'Erreur suppression ChromaDB', 'error')
    } finally {
      setDeletingChroma(false)
    }
  }

  const handleDeleteJson = async () => {
    if (!confirm(`Supprimer la base JSON du domaine "${domain.name}" ?`)) return
    setDeletingJson(true)
    try {
      await api.deleteJsonDB(domain.name)
      onNotify(`Base JSON "${domain.name}" supprimée`)
      await onRefresh()
    } catch (e) {
      onNotify(e.response?.data?.detail || 'Erreur suppression JSON', 'error')
    } finally {
      setDeletingJson(false)
    }
  }

  const handleExportJson = () => {
    const a = document.createElement('a')
    a.href = `/api/export-json/${encodeURIComponent(domain.name)}?embeddings=true`
    a.download = `${domain.name}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    onNotify(`Export JSON de "${domain.name}" lancé…`)
  }

  const handleUploadSuccess = async (count, errors) => {
    setShowUpload(false)
    if (count > 0) onNotify(`${count} fichier(s) uploadé(s)`)
    if (errors.length > 0) onNotify(`Échec : ${errors.join(', ')}`, 'error')
    await onRefresh()
  }

  const isProcessing = vectorizing || updating
  const hasAnyDB     = domain.has_chroma_db || domain.has_json_db

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
          <span>Domaines</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium">{domain.name}</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800 capitalize">{domain.name}</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-sm text-gray-400">
                {domain.files.length} fichier{domain.files.length !== 1 ? 's' : ''}
              </span>
              {domain.has_chroma_db && (
                <span className="badge bg-blue-50 text-blue-600 text-xs flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  ChromaDB — {domain.chroma_count} chunks
                </span>
              )}
              {domain.has_json_db && (
                <span className="badge bg-emerald-50 text-emerald-600 text-xs flex items-center gap-1">
                  <FileJson className="w-3 h-3" />
                  JSON — {domain.json_count} chunks
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowUpload(true)} className="btn-secondary" disabled={isProcessing}>
              <UploadCloud className="w-4 h-4" />
              Uploader
            </button>

            <button
              onClick={() => setShowGenFormat(true)}
              className={hasAnyDB ? 'btn-secondary' : 'btn-success'}
              disabled={isProcessing || domain.files.length === 0}
            >
              {vectorizing
                ? <span className={`spinner ${hasAnyDB ? 'spinner-dark' : ''}`} />
                : <Zap className="w-4 h-4" />}
              {vectorizing ? 'Génération…' : hasAnyDB ? 'Recréer' : 'Créer base vectorielle'}
            </button>

            {hasAnyDB && (
              <>
                {domain.has_chroma_db && (
                  <button onClick={handleUpdate} className="btn-amber" disabled={isProcessing}>
                    {updating ? <span className="spinner" /> : <RefreshCw className="w-4 h-4" />}
                    {updating ? 'Mise à jour…' : 'Mettre à jour'}
                  </button>
                )}
                <button onClick={() => setShowSearch(true)} className="btn-primary" disabled={isProcessing}>
                  <Search className="w-4 h-4" />
                  Rechercher
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Processing banner */}
        {isProcessing && (
          <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            <span className="spinner spinner-dark" style={{ borderTopColor: '#2563eb' }} />
            {vectorizing
              ? 'Génération de la base vectorielle en cours…'
              : 'Mise à jour de la base vectorielle…'}
          </div>
        )}

        {/* Génération result banner */}
        {genResult && !isProcessing && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            genResult.chunks === 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : genResult.warnings?.length > 0
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <div className="flex items-start gap-2">
              {genResult.chunks === 0
                ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className="font-medium">{genResult.message}</p>
                {genResult.files?.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {genResult.files.map((f, i) => (
                      <li key={i} className="text-xs flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{f.file}</span>
                        {f.ocr && <span className="badge bg-violet-100 text-violet-700 text-[10px]">OCR</span>}
                        <span>→ {f.chunks} chunk{f.chunks !== 1 ? 's' : ''}</span>
                        {f.warning && <span className="text-amber-600">⚠ {f.warning}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button onClick={() => setGenResult(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {domain.files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UploadCloud className="w-14 h-14 text-gray-200 mb-4" />
            <h3 className="text-base font-medium text-gray-400 mb-1">Aucun fichier</h3>
            <p className="text-sm text-gray-400 mb-4">Uploadez des fichiers PDF, TXT, DOCX ou Markdown.</p>
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              <UploadCloud className="w-4 h-4" /> Uploader des fichiers
            </button>
          </div>
        )}

        {/* File grid */}
        {domain.files.length > 0 && (
          <>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Fichiers</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {domain.files.map((filename) => (
                <div key={filename} className="card p-4 flex flex-col gap-3 group hover:border-blue-100 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{fileIcon(filename)}</span>
                    <button
                      onClick={() => handleDeleteFile(filename)}
                      disabled={deletingFile === filename}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      {deletingFile === filename
                        ? <span className="spinner" style={{ borderTopColor: '#ef4444', borderColor: 'rgba(239,68,68,.2)', width: 14, height: 14 }} />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 truncate" title={filename}>{filename}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="badge bg-gray-100 text-gray-500 text-[10px]">{formatExt(filename)}</span>
                      {isImage(filename) && (
                        <span className="badge bg-violet-50 text-violet-600 text-[10px]">OCR</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* DB cards */}
        {hasAnyDB && (
          <div className="mt-6 space-y-3">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Bases vectorielles</div>

            {/* ChromaDB */}
            {domain.has_chroma_db && (
              <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-0.5">
                      <Database className="w-4 h-4" />
                      ChromaDB
                      <code className="text-xs font-mono text-blue-500">BV/{domain.name}</code>
                    </div>
                    <p className="text-xs text-gray-500">{domain.chroma_count} chunks · {EMBED_MODEL_LABEL}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowChromaDB(true)} className="btn-secondary text-xs">
                      <Eye className="w-3.5 h-3.5" /> Explorer
                    </button>
                    <button onClick={handleExportJson} className="btn-secondary text-xs">
                      <Download className="w-3.5 h-3.5" />
                      Exporter JSON
                    </button>
                    <button
                      onClick={handleDeleteChroma}
                      className="btn-secondary text-xs text-red-500 hover:bg-red-50 hover:border-red-200"
                      disabled={deletingChroma}
                    >
                      {deletingChroma
                        ? <span className="spinner spinner-dark" style={{ width: 14, height: 14, borderTopColor: '#ef4444' }} />
                        : <Trash2 className="w-3.5 h-3.5" />}
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* JSON DB */}
            {domain.has_json_db && (
              <div className="card p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 mb-0.5">
                      <FileJson className="w-4 h-4" />
                      JSON DB
                      <code className="text-xs font-mono text-emerald-500">vector_db/{domain.name}.json</code>
                    </div>
                    <p className="text-xs text-gray-500">{domain.json_count} chunks avec embeddings · {EMBED_MODEL_LABEL}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowJsonDB(true)} className="btn-secondary text-xs">
                      <Eye className="w-3.5 h-3.5" /> Explorer
                    </button>
                    <a
                      href={`/api/download-json-db/${encodeURIComponent(domain.name)}`}
                      download={`${domain.name}.json`}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Télécharger
                    </a>
                    <button
                      onClick={handleDeleteJson}
                      className="btn-secondary text-xs text-red-500 hover:bg-red-50 hover:border-red-200"
                      disabled={deletingJson}
                    >
                      {deletingJson
                        ? <span className="spinner spinner-dark" style={{ width: 14, height: 14, borderTopColor: '#ef4444' }} />
                        : <Trash2 className="w-3.5 h-3.5" />}
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {domain.has_chroma_db && domain.has_json_db && (
              <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1">
                <Layers className="w-3.5 h-3.5" />
                Les deux formats sont actifs — le chat RAG utilise ChromaDB en priorité.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showUpload    && <FileUpload domain={domain.name} onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} />}
      {showSearch    && <SearchModal domain={domain.name} onClose={() => setShowSearch(false)} />}
      {showChromaDB  && <VectorDBModal domain={domain.name} onClose={() => setShowChromaDB(false)} />}
      {showJsonDB    && <JsonDBModal domain={domain.name} onClose={() => setShowJsonDB(false)} />}
      {showGenFormat && (
        <GenerateFormatModal
          domain={domain.name}
          loading={vectorizing}
          onClose={() => setShowGenFormat(false)}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  )
}
