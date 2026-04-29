import { useState } from 'react'
import { X, Zap, Database, FileJson, Layers } from 'lucide-react'

const FORMATS = [
  {
    id: 'chroma',
    label: 'ChromaDB',
    icon: Database,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    activeBg: 'bg-blue-600',
    description: 'Base vectorielle locale haute performance. Idéale pour le chat RAG.',
    badge: 'Recommandé pour le chat',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'json',
    label: 'JSON',
    icon: FileJson,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    activeBg: 'bg-emerald-600',
    description: 'Fichier JSON portable avec embeddings inclus. Facile à partager et à réimporter.',
    badge: 'Portable & exportable',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'both',
    label: 'ChromaDB + JSON',
    icon: Layers,
    color: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-200',
    activeBg: 'bg-violet-600',
    description: 'Génère les deux formats simultanément. Offre le chat RAG ET la portabilité JSON.',
    badge: 'Les deux formats',
    badgeColor: 'bg-violet-100 text-violet-700',
  },
]

export default function GenerateFormatModal({ domain, onClose, onGenerate, loading }) {
  const [selected, setSelected] = useState('chroma')

  const fmt = FORMATS.find(f => f.id === selected)

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-md fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <Zap className="w-4 h-4 text-amber-500" />
            Générer la base vectorielle
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={loading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              Domaine : <span className="font-semibold text-gray-800">{domain}</span>
            </p>
            <p className="text-xs text-gray-400">Choisissez le format de la base vectorielle à générer.</p>
          </div>

          {/* Format cards */}
          <div className="space-y-2">
            {FORMATS.map((f) => {
              const Icon = f.icon
              const isSelected = selected === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setSelected(f.id)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
                    isSelected
                      ? 'border-gray-800 bg-gray-50 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Radio dot */}
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-gray-800' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-gray-800" />}
                    </div>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? f.color : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                          {f.label}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${f.badgeColor}`}>
                          {f.badge}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{f.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Info box */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-500 space-y-1">
            {selected === 'chroma' && (
              <p>📦 La base sera stockée dans <code className="bg-gray-100 px-1 rounded">BV/</code>. Utilisable immédiatement dans le chat.</p>
            )}
            {selected === 'json' && (
              <p>📄 Le fichier sera sauvegardé dans <code className="bg-gray-100 px-1 rounded">vector_db/{domain}.json</code>. Le chat fonctionne aussi avec ce format.</p>
            )}
            {selected === 'both' && (
              <p>⚡ Génère <code className="bg-gray-100 px-1 rounded">BV/</code> (ChromaDB) <strong>et</strong> <code className="bg-gray-100 px-1 rounded">vector_db/{domain}.json</code> en une seule opération.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary" disabled={loading}>
              Annuler
            </button>
            <button
              onClick={() => onGenerate(selected)}
              className="btn-success"
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : <Zap className="w-4 h-4" />}
              {loading ? 'Génération…' : `Générer (${FORMATS.find(f => f.id === selected)?.label})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
