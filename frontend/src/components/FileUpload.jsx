import { useState, useRef } from 'react'
import { X, UploadCloud, File } from 'lucide-react'
import * as api from '../api/client'

const ACCEPTED = '.pdf,.txt,.docx,.md,.jpg,.jpeg,.png,.tiff,.tif,.bmp,.webp,.gif'
const MAX_SIZE_MB = 50

export default function FileUpload({ domain, onClose, onSuccess }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles).filter(
      (f) => f.size <= MAX_SIZE_MB * 1024 * 1024
    )
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...arr.filter((f) => !names.has(f.name))]
    })
  }

  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name))

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    let uploaded = 0
    let errors = []
    for (const file of files) {
      try {
        await api.uploadFile(domain, file)
        uploaded++
      } catch (e) {
        errors.push(file.name)
      }
    }
    setUploading(false)
    onSuccess(uploaded, errors)
  }

  const fmt = (bytes) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} Ko`
      : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <UploadCloud className="w-4 h-4 text-blue-600" />
            Uploader des fichiers — <span className="text-blue-600">{domain}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            className={`drop-zone cursor-pointer ${dragging ? 'dragging' : 'hover:border-blue-300 hover:bg-gray-50'}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <UploadCloud className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Glisser-déposer ou <span className="text-blue-600 font-medium">parcourir</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, TXT, DOCX, Markdown, Images (JPG, PNG, TIFF…) — max {MAX_SIZE_MB} Mo</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm">
                  <File className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="flex-1 truncate text-gray-700">{f.name}</span>
                  <span className="text-gray-400 text-xs shrink-0">{fmt(f.size)}</span>
                  <button onClick={() => removeFile(f.name)} className="text-gray-300 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">Annuler</button>
            <button
              onClick={handleUpload}
              className="btn-primary"
              disabled={uploading || !files.length}
            >
              {uploading ? <span className="spinner" /> : <UploadCloud className="w-4 h-4" />}
              {uploading ? 'Upload…' : `Uploader (${files.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
