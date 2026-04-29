import { FolderOpen, Folder, Trash2, Plus, Database, FileJson, Layers } from 'lucide-react'

export default function DomainList({ domains, selectedDomain, onSelect, onDelete, onCreateNew, onImportJson, headerSlot }) {
  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-100">
        {headerSlot && <div className="mb-3">{headerSlot}</div>}
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-blue-600" />
          <h1 className="font-bold text-gray-800 text-base leading-tight">Vector DB Generator</h1>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={onCreateNew} className="btn-primary w-full justify-center text-sm">
            <Plus className="w-4 h-4" />
            Nouveau domaine
          </button>
          <button onClick={onImportJson} className="btn-secondary w-full justify-center text-sm">
            <FileJson className="w-4 h-4" />
            Importer JSON
          </button>
        </div>
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
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-gray-400">
                    {domain.files.length} fichier{domain.files.length !== 1 ? 's' : ''}
                  </span>
                  {domain.has_chroma_db && domain.has_json_db ? (
                    <span className="badge bg-violet-50 text-violet-600 text-[10px] flex items-center gap-0.5">
                      <Layers className="w-2.5 h-2.5" /> Les deux
                    </span>
                  ) : domain.has_chroma_db ? (
                    <span className="badge bg-blue-50 text-blue-600 text-[10px] flex items-center gap-0.5">
                      <Database className="w-2.5 h-2.5" /> Chroma
                    </span>
                  ) : domain.has_json_db ? (
                    <span className="badge bg-emerald-50 text-emerald-600 text-[10px] flex items-center gap-0.5">
                      <FileJson className="w-2.5 h-2.5" /> JSON
                    </span>
                  ) : null}
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
