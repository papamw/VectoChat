import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const icons = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  error: <XCircle className="w-4 h-4 text-red-500" />,
  info: <AlertCircle className="w-4 h-4 text-blue-500" />,
}

const styles = {
  success: 'bg-white border-emerald-200 text-gray-800',
  error: 'bg-white border-red-200 text-gray-800',
  info: 'bg-white border-blue-200 text-gray-800',
}

export default function Notification({ message, type = 'success', onClose }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg fade-in max-w-sm ${styles[type]}`}
    >
      {icons[type]}
      <span className="text-sm flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
