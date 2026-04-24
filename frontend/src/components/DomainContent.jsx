import { useState } from 'react'
import {
  FileText,
  Trash2,
  UploadCloud,
  Zap,
  RefreshCw,
  Search,
  Database,
  ChevronRight,
  Eye,
} from 'lucide-react'
import FileUpload from './FileUpload'
import SearchModal from './SearchModal'
import VectorDBModal from './VectorDBModal'
import * as api from '../api/client'

const FILE_ICONS = {
  pdf: '📄',
  txt: '📝',
  docx: '📋',
  md: '📑',
}

function fileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  return FILE_ICONS[ext] || '📁'
}

function formatExt(name) {
  return name.split('.').pop()?.toUpperCase() || ''
}

export default function DomainContent({ domain, onRefresh, onNotify }) {
  const [showUpload, setShowUpload] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showVectorDB, setShowVectorDB] = useState(false)
  const [vectorizing, setVectorizing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deletingFile, setDeletingFile] = useState(null)

  if (!domain) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12">
        <Database className="w-16 h-16 text-gray-100 mb-4" />
        <h2 className="text-lg font-semibold text-gray-400 mb-1">
          Sélectionnez un domaine
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Choisissez un domaine dans la colonne de gauche ou créez-en un nouveau.
        </p>
      </div>
    )
  }

  const handleDeleteFile = async (filename) => {
    if (!confirm(`Supprimer "${filename}" ?`)) return
    setDeletingFile(filename)
    try {
      await api.deleteFile(domain.name, filename)
      onNotify(`Fichier "${filename}" supprimé`)
      onRefresh()
    } catch (e) {
      onNotify('Erreur suppression fichier', 'error')
    } finally {
      setDeletingFile(null)
    }
  }

  const handleGenerate = async () => {
    setVectorizing(true)
    try {
      const res = await api.generateVectorDB(domain.name)
      onNotify(`Base vectorielle créée — ${res.data.chunks} chunks`)
      onRefresh()
    } catch (e) {
      onNotify(e.response?.data?.detail || 'Erreur génération', 'error')
    } finally {
      setVectorizing(false)
    }
  }

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      const res = await api.updateVectorDB(domain.name)
      onNotify(res.data.message + (res.data.new_chunks ? ` (${res.data.new_chunks} nouveaux chunks)` : ''))
      onRefresh()
    } catch (e) {
      onNotify(e.response?.data?.detail || 'Erreur mise à jour', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const handleUploadSuccess = (count, errors) => {
    setShowUpload(false)
    if (count > 0) onNotify(`${count} fichier(s) uploadé(s)`)
    if (errors.length > 0) onNotify(`Échec: ${errors.join(', ')}`, 'error')
    onRefresh()
  }

  const isProcessing = vectorizing || updating

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
          <span>Domaines</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium">{domain.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800 capitalize">{domain.name}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-sm text-gray-400">
                {domain.files.length} fichier{domain.files.length !== 1 ? 's' : ''}
              </span>
              {domain.has_vector_db && (
                <span className="badge bg-emerald-50 text-emerald-600 text-xs">
                  ✓ Base vectorielle — {domain.chunk_count} chunks
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowUpload(true)}
              className="btn-secondary"
              disabled={isProcessing}
            >
              <UploadCloud className="w-4 h-4" />
              Uploader
            </button>

            {!domain.has_vector_db ? (
              <button
                onClick={handleGenerate}
                className="btn-success"
                disabled={isProcessing || domain.files.length === 0}
              >
                {vectorizing ? <span className="spinner" /> : <Zap className="w-4 h-4" />}
                {vectorizing ? 'Génération…' : 'Créer base vectorielle'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleUpdate}
                  className="btn-amber"
                  disabled={isProcessing}
                >
                  {updating ? <span className="spinner" /> : <RefreshCw className="w-4 h-4" />}
                  {updating ? 'Mise à jour…' : 'Mettre à jour'}
                </button>
                <button
                  onClick={handleGenerate}
                  className="btn-secondary"
                  disabled={isProcessing || domain.files.length === 0}
                >
                  {vectorizing ? <span className="spinner spinner-dark" /> : <Zap className="w-4 h-4" />}
                  Recréer
                </button>
                <button
                  onClick={() => setShowVectorDB(true)}
                  className="btn-secondary"
                  disabled={isProcessing}
                >
                  <Eye className="w-4 h-4" />
                  Explorer
                </button>
                <button
                  onClick={() => setShowSearch(true)}
                  className="btn-primary"
                  disabled={isProcessing}
                >
                  <Search className="w-4 h-4" />
                  Rechercher
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Processing banner */}
        {isProcessing && (
          <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            <span className="spinner spinner-dark" style={{ borderTopColor: '#2563eb' }} />
            {vectorizing
              ? 'Génération de la base vectorielle en cours. Cela peut prendre quelques minutes…'
              : 'Mise à jour de la base vectorielle…'}
          </div>
        )}

        {/* Empty state */}
        {domain.files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UploadCloud className="w-14 h-14 text-gray-200 mb-4" />
            <h3 className="text-base font-medium text-gray-400 mb-1">Aucun fichier</h3>
            <p className="text-sm text-gray-400 mb-4">
              Uploadez des fichiers PDF, TXT, DOCX ou Markdown pour commencer.
            </p>
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              <UploadCloud className="w-4 h-4" />
              Uploader des fichiers
            </button>
          </div>
        )}

        {/* File grid */}
        {domain.files.length > 0 && (
          <>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Fichiers
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {domain.files.map((filename) => (
                <div
                  key={filename}
                  className="card p-4 flex flex-col gap-3 group hover:border-blue-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{fileIcon(filename)}</span>
                    <button
                      onClick={() => handleDeleteFile(filename)}
                      disabled={deletingFile === filename}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Supprimer"
                    >
                      {deletingFile === filename ? (
                        <span
                          className="spinner"
                          style={{ borderTopColor: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', width: 14, height: 14 }}
                        />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 truncate" title={filename}>
                      {filename}
                    </p>
                    <span className="badge bg-gray-100 text-gray-500 text-[10px] mt-1">
                      {formatExt(filename)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VDB info */}
        {domain.has_vector_db && (
          <div className="mt-6 card p-4 bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mb-1">
                  <Database className="w-4 h-4" />
                  Base vectorielle&nbsp;
                  <span className="font-bold text-emerald-800">BV/{domain.name}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {domain.chunk_count} chunks indexés · paraphrase-multilingual-MiniLM-L12-v2
                </p>
              </div>
              <button
                onClick={() => setShowVectorDB(true)}
                className="btn-secondary text-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                Explorer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showUpload && (
        <FileUpload
          domain={domain.name}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
      {showSearch && (
        <SearchModal domain={domain.name} onClose={() => setShowSearch(false)} />
      )}
      {showVectorDB && (
        <VectorDBModal domain={domain.name} onClose={() => setShowVectorDB(false)} />
      )}
    </div>
  )
}
