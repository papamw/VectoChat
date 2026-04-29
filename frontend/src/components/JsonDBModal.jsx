import { useState, useEffect } from 'react'
import { X, FileJson, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import * as api from '../api/client'

export default function JsonDBModal({ domain, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    api.getJsonDB(domain)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [domain])

  const chunks = data?.chunks ?? []
  const filtered = search.trim()
    ? chunks.filter(c =>
        c.text.toLowerCase().includes(search.toLowerCase()) ||
        c.source.toLowerCase().includes(search.toLowerCase())
      )
    : chunks

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-3xl max-h-[85vh] flex flex-col fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <FileJson className="w-4 h-4 text-emerald-600" />
            Base JSON — <span className="text-emerald-600">{domain}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-red-500 text-sm">{error}</div>
        )}

        {data && !loading && (
          <>
            {/* Stats bar */}
            <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 shrink-0">
              <div className="flex items-center gap-6 text-sm flex-wrap">
                <div>
                  <span className="text-gray-500">Total chunks</span>
                  <span className="ml-2 font-bold text-emerald-700">{data.total_chunks}</span>
                </div>
                <div>
                  <span className="text-gray-500">Modèle</span>
                  <span className="ml-2 font-mono text-xs text-gray-600">{data.model}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sources</span>
                  <span className="ml-2 font-semibold text-gray-700">
                    {Object.keys(data.sources).join(', ')}
                  </span>
                </div>
              </div>
              {/* Source breakdown */}
              {Object.keys(data.sources).length > 0 && (
                <div className="flex gap-3 mt-2 flex-wrap">
                  {Object.entries(data.sources).map(([src, count]) => (
                    <span key={src} className="badge bg-white border border-emerald-200 text-emerald-700 text-xs">
                      {src} — {count} chunks
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="text"
                  placeholder="Filtrer les chunks…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              {search && (
                <p className="text-xs text-gray-400 mt-1">
                  {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} sur {chunks.length}
                </p>
              )}
            </div>

            {/* Chunks list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {filtered.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Aucun chunk trouvé.</p>
              )}
              {filtered.map((chunk, i) => {
                const isOpen = !!expanded[chunk.id || i]
                const preview = chunk.text.slice(0, 120)
                const hasMore = chunk.text.length > 120
                return (
                  <div key={chunk.id || i} className="border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                      onClick={() => toggle(chunk.id || i)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              #{i + 1}
                            </span>
                            <span className="badge bg-emerald-50 text-emerald-600 text-[10px]">
                              {chunk.source}
                            </span>
                            {chunk.has_embedding && (
                              <span className="badge bg-blue-50 text-blue-500 text-[10px]">
                                embedding ✓
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {isOpen ? chunk.text : (preview + (hasMore ? '…' : ''))}
                          </p>
                        </div>
                        {hasMore && (
                          isOpen
                            ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                            : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
