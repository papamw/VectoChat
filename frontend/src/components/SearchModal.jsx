import { useState } from 'react'
import { X, Search, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import * as api from '../api/client'

export default function SearchModal({ domain, onClose }) {
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.search(domain, query, topK)
      setResults(res.data)
      setExpanded({})
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors de la recherche')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (s) => {
    if (s >= 0.8) return 'text-emerald-600 bg-emerald-50'
    if (s >= 0.6) return 'text-blue-600 bg-blue-50'
    return 'text-gray-500 bg-gray-100'
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <Search className="w-4 h-4 text-blue-600" />
            Recherche sémantique —{' '}
            <span className="text-blue-600">{domain}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="px-6 pt-5 pb-4 shrink-0 space-y-3">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Votre question ou requête…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <select
              className="input w-24"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
            >
              {[3, 5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={loading || !query.trim()}>
              {loading ? <span className="spinner" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          {results !== null && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Aucun résultat trouvé.</p>
          )}

          {results &&
            results.map((r, i) => (
              <div key={r.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
                >
                  <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  <span className={`badge ${scoreColor(r.score)}`}>
                    {(r.score * 100).toFixed(1)}%
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <FileText className="w-3 h-3" />
                    {r.source}
                  </div>
                  <div className="ml-auto text-gray-400">
                    {expanded[i] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
                {expanded[i] && (
                  <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed bg-white">
                    {r.text}
                  </div>
                )}
                {!expanded[i] && (
                  <div className="px-4 py-2 text-sm text-gray-500 truncate bg-white">
                    {r.text}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
