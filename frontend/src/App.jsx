import { useState } from 'react'
import ChatView from './views/ChatView'
import VectorDBView from './views/VectorDBView'

export default function App() {
  const [view, setView] = useState('chat')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleBack = () => {
    setRefreshKey(k => k + 1)
    setView('chat')
  }

  if (view === 'vectordb') {
    return <VectorDBView onBack={handleBack} />
  }

  return <ChatView onNavigateToVectorDB={() => setView('vectordb')} refreshKey={refreshKey} />
}
