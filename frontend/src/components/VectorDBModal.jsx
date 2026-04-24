import { useState, useEffect, useMemo } from 'react'
import { X, Database, FileText, ChevronDown, ChevronUp, Search, Hash } from 'lucide-react'
import * as api from '../api/client'

export default function VectorDBModal({ domain, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterSource, setFilterSource] = useState('all')
  const [filterText, setFilterText] = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    api.getVectorDB(domain)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.detail || 'Erreur chargement'))
      .finally(() => setLoading(false))
  }, [domain])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.chunks.filter((c) => {
      const matchSource = filterSource === 'all' || c.source === filterSource
      const matchText = !filterText || c.text.toLowerCase().includes(filterText.toLowerCase())
      return matchSource && matchText
    })
  }, [data, filterSource, filterText])

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-3xl max-h-[90vh] flex flex-col fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <Database className="w-4 h-4 text-emerald-600" />
            Base vectorielle —{' '}
            <span className="text-emerald-600">{domain}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <span className="spinner spinner-dark" style={{ borderTopColor: '#059669' }} />
            <span className="ml-3 text-sm text-gray-500">Chargement…</span>
          </div>
        )}

        {error && (
          <div className="m-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Stats bar */}
            <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 shrink-0">
              <div className="flex flex-wrap gap-4 text-xs text-emerald-700">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  <strong>{data.total_chunks}</strong> chunks au total
                </span>
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Modèle : <strong>{data.model}</strong>
                </span>
                {Object.entries(data.sources).map(([src, count]) => (
                  <span key={src} className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {src} — <strong>{count}</strong> chunk{count > 1 ? 's' : ''}
                  </span>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-gray-100 shrink-0 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  className="input pl-8 text-sm"
                  placeholder="Filtrer par contenu…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
              </div>
              {Object.keys(data.sources).length > 1 && (
                <select
                  className="input w-48 text-sm"
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                >
                  <option value="all">Tous les fichiers</option>
                  {Object.keys(data.sources).map((src) => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Chunk count after filter */}
            <div className="px-6 pt-3 pb-1 shrink-0 text-xs text-gray-400">
              {filtered.length} chunk{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== data.total_chunks && ` (filtré sur ${data.total_chunks})`}
            </div>

            {/* Chunks list */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Aucun chunk ne correspond au filtre.</p>
              )}
              {filtered.map((chunk) => (
                <div key={chunk.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggle(chunk.id)}
                  >
                    <span className="text-xs font-mono font-bold text-gray-400 min-w-[2.5rem]">
                      #{chunk.id}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 badge bg-white border border-gray-200">
                      <FileText className="w-3 h-3" />
                      {chunk.source}
                    </span>
                    <p className="flex-1 text-sm text-gray-600 truncate">
                      {chunk.text.slice(0, 120)}{chunk.text.length > 120 ? '…' : ''}
                    </p>
                    <span className="text-gray-400 shrink-0">
                      {expanded[chunk.id]
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                  {expanded[chunk.id] && (
                    <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed bg-white whitespace-pre-wrap">
                      {chunk.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
