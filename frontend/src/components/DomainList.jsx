import { FolderOpen, Folder, Trash2, Plus, Database } from 'lucide-react'

export default function DomainList({ domains, selectedDomain, onSelect, onDelete, onCreateNew, headerSlot }) {
  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-100">
        {headerSlot && <div className="mb-3">{headerSlot}</div>}
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-blue-600" />
          <h1 className="font-bold text-gray-800 text-base leading-tight">Vector DB Generator</h1>
        </div>
        <button onClick={onCreateNew} className="btn-primary w-full justify-center text-sm">
          <Plus className="w-4 h-4" />
          Nouveau domaine
        </button>
      </div>

      {/* Domain list */}
      <div className="flex-1 overflow-y-auto py-2">
        {domains.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Folder className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Aucun domaine encore</p>
          </div>
        )}

        {domains.map((domain) => {
          const isSelected = selectedDomain?.name === domain.name
          return (
            <div
              key={domain.name}
              className={`group flex items-center gap-2 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => onSelect(domain)}
            >
              {isSelected ? (
                <FolderOpen className="w-4 h-4 shrink-0 text-blue-500" />
              ) : (
                <Folder className="w-4 h-4 shrink-0 text-gray-400" />
              )}

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{domain.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-gray-400">
                    {domain.files.length} fichier{domain.files.length !== 1 ? 's' : ''}
                  </span>
                  {domain.has_vector_db && (
                    <span className="badge bg-emerald-50 text-emerald-600 text-[10px]">
                      ✓ VDB
                    </span>
                  )}
                </div>
              </div>

              <button
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(domain.name)
                }}
                title="Supprimer le domaine"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
        {domains.length} domaine{domains.length !== 1 ? 's' : ''}
      </div>
    </aside>
  )
}
