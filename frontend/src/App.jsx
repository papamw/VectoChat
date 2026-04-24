import { useState } from 'react'
import ChatView from './views/ChatView'
import VectorDBView from './views/VectorDBView'

export default function App() {
  const [view, setView] = useState('chat')

  if (view === 'vectordb') {
    return <VectorDBView onBack={() => setView('chat')} />
  }

  return <ChatView onNavigateToVectorDB={() => setView('vectordb')} />
}
