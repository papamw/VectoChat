import { useState, useRef } from 'react'
import { X, Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react'
import * as api from '../api/client'

export default function ImportJsonModal({ onClose, onSuccess }) {
  const [file, setFile]           = useState(null)
  const [domainName, setDomainName] = useState('')
  const [dragging, setDragging]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [preview, setPreview]     = useState(null)
  const inputRef = useRef(null)

  const readPreview = (f) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        setPreview({
          domain: data.domain || '—',
          model: data.model || '—',
          chunks: Array.isArray(data.chunks) ? data.chunks.length : '?',
          hasEmbeddings: Array.isArray(data.chunks) && data.chunks.length > 0 && 'embedding' in data.chunks[0],
        })
        if (data.domain && !domainName) setDomainName(data.domain)
        setError('')
      } catch {
        setPreview(null)
        setError('Fichier JSON invalide ou format non reconnu.')
      }
    }
    reader.readAsText(f)
  }

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.json')) {
      setError('Seuls les fichiers .json sont acceptés.')
      return
    }
    setFile(f)
    setError('')
    readPreview(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const res = await api.importJsonDB(file, domainName.trim())
      onSuccess(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors de l\'importation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <FileJson className="w-4 h-4 text-blue-600" />
            Importer une base JSON
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            className={`drop-zone cursor-pointer ${dragging ? 'dragging' : 'hover:border-blue-300 hover:bg-gray-50'} ${file ? 'border-emerald-300 bg-emerald-50' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} Ko</p>
              </div>
            ) : (
              <>
                <FileJson className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Glisser-déposer ou <span className="text-blue-600 font-medium">parcourir</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Fichier .json exporté depuis cette application</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm space-y-1">
              <p className="font-medium text-blue-800 mb-2">Aperçu du fichier</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-gray-500">Domaine source</span>
                <span className="font-medium text-gray-700">{preview.domain}</span>
                <span className="text-gray-500">Modèle</span>
                <span className="font-medium text-gray-700 truncate">{preview.model}</span>
                <span className="text-gray-500">Chunks</span>
                <span className="font-medium text-gray-700">{preview.chunks}</span>
                <span className="text-gray-500">Embeddings inclus</span>
                <span className={`font-medium ${preview.hasEmbeddings ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {preview.hasEmbeddings ? '✓ Oui (import rapide)' : '✗ Non (recalcul nécessaire)'}
                </span>
              </div>
            </div>
          )}

          {/* Domain name */}
          {file && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nom du domaine cible
              </label>
              <input
                type="text"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                placeholder="Nom du domaine (laisser vide = nom du fichier)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-xs text-gray-400 mt-1">
                Si un domaine du même nom existe, il sera remplacé.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary" disabled={loading}>
              Annuler
            </button>
            <button
              onClick={handleImport}
              className="btn-primary"
              disabled={loading || !file || !!error}
            >
              {loading ? <span className="spinner" /> : <Upload className="w-4 h-4" />}
              {loading ? 'Importation…' : 'Importer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
