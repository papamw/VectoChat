import { useState } from 'react'
import ChatView from './views/ChatView'
import VectorDBView from './views/VectorDBView'

const STORAGE_KEY = 'vectochat_view'

export default function App() {
  // Restaure la dernière vue depuis localStorage (survit au F5)
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'chat' } catch { return 'chat' }
  })
  const [refreshKey, setRefreshKey] = useState(0)

  const navigateTo = (v) => {
    try { localStorage.setItem(STORAGE_KEY, v) } catch {}
    setView(v)
  }

  const handleBack = () => {
    setRefreshKey(k => k + 1)
    navigateTo('chat')
  }

  if (view === 'vectordb') {
    return <VectorDBView onBack={handleBack} />
  }

  return <ChatView onNavigateToVectorDB={() => navigateTo('vectordb')} refreshKey={refreshKey} />
}
