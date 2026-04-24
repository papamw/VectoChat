import { useState, useEffect, useRef } from 'react'
import {
  Send, Plus, MessageSquare, Database, Sparkles,
  ChevronDown, Bot, User, BookOpen, Loader2, Trash2, Settings
} from 'lucide-react'
import * as api from '../api/client'
import SettingsModal from '../components/SettingsModal'

function newConversation() {
  return { id: Date.now(), title: 'Nouvelle conversation', messages: [] }
}

export default function ChatView({ onNavigateToVectorDB }) {
  const [conversations, setConversations] = useState([newConversation()])
  const [activeId, setActiveId]           = useState(conversations[0].id)
  const [input, setInput]                 = useState('')
  const [models, setModels]               = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [domains, setDomains]             = useState([])
  const [loading, setLoading]             = useState(false)
  const [modelOpen, setModelOpen]         = useState(false)
  const [domainOpen, setDomainOpen]       = useState(false)
  const [showSettings, setShowSettings]   = useState(false)
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)

  const activeConv = conversations.find(c => c.id === activeId)

  const fetchModels = async () => {
    try {
      const res = await api.getModels()
      setModels(res.data)
      if (res.data.length > 0 && !selectedModel) setSelectedModel(res.data[0])
    } catch { /* backend not running */ }
  }

  useEffect(() => {
    fetchModels()
    api.getDomains().then(res => {
      const withVdb = res.data.filter(d => d.has_vector_db)
      setDomains(withVdb)
      if (withVdb.length > 0 && !selectedDomain) setSelectedDomain(withVdb[0])
    }).catch(() => {})
  }, []) // eslint-disable-line

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConv?.messages])

  const updateConv = (id, updater) =>
    setConversations(prev => prev.map(c => c.id === id ? updater(c) : c))

  const handleNewConv = () => {
    const c = newConversation()
    setConversations(prev => [c, ...prev])
    setActiveId(c.id)
    setInput('')
  }

  const handleDeleteConv = (id, e) => {
    e.stopPropagation()
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id)
      if (next.length === 0) {
        const c = newConversation()
        setActiveId(c.id)
        return [c]
      }
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    if (!selectedDomain) {
      alert('Veuillez sélectionner une base vectorielle.')
      return
    }
    if (!selectedModel) {
      alert('Aucun modèle disponible. Configurez une clé API ou démarrez Ollama.')
      return
    }

    const convId = activeId
    const userMsg = { role: 'user', content: text, id: Date.now() }
    const aiMsgId = Date.now() + 1

    updateConv(convId, c => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 50) : c.title,
      messages: [
        ...c.messages,
        userMsg,
        { role: 'assistant', id: aiMsgId, content: '', sources: [], model: selectedModel.name, domain: selectedDomain.name },
      ],
    }))
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const history = activeConv.messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
      const fd = new FormData()
      fd.append('domain', selectedDomain.name)
      fd.append('query', text)
      fd.append('model_id', selectedModel.id)
      fd.append('history', JSON.stringify(history))

      const resp = await fetch('http://localhost:8000/chat', {
        method: 'POST', body: fd, signal: controller.signal,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: `Erreur HTTP ${resp.status}` }))
        throw new Error(err.detail || `Erreur HTTP ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'sources') {
              updateConv(convId, c => ({
                ...c,
                messages: c.messages.map(m => m.id === aiMsgId ? { ...m, sources: data.sources } : m),
              }))
            } else if (data.type === 'token') {
              updateConv(convId, c => ({
                ...c,
                messages: c.messages.map(m =>
                  m.id === aiMsgId ? { ...m, content: m.content + data.content } : m
                ),
              }))
            } else if (data.type === 'error') {
              updateConv(convId, c => ({
                ...c,
                messages: c.messages.map(m =>
                  m.id === aiMsgId ? { ...m, content: data.message, isError: true } : m
                ),
              }))
            }
          } catch { /* ignore parse error */ }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      updateConv(convId, c => ({
        ...c,
        messages: c.messages.map(m =>
          m.id === aiMsgId ? { ...m, content: err.message || 'Erreur de connexion.', isError: true } : m
        ),
      }))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const closeDropdowns = () => { setModelOpen(false); setDomainOpen(false) }

  // Group models by provider
  const modelsByProvider = models.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {})

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-white overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-[#111111] border-r border-white/8">
        <div className="px-4 py-5 flex items-center gap-3 border-b border-white/8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-white" />
          </div>
          <span className="font-semibold text-sm tracking-wide">VectoChat</span>
        </div>

        <div className="px-3 pt-3">
          <button
            onClick={handleNewConv}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Plus size={16} />
            Nouvelle conversation
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                c.id === activeId ? 'bg-white/12 text-white' : 'text-white/60 hover:text-white hover:bg-white/6'
              }`}
            >
              <MessageSquare size={14} className="flex-shrink-0 opacity-60" />
              <span className="flex-1 truncate">{c.title}</span>
              <Trash2
                size={13}
                onClick={e => handleDeleteConv(c.id, e)}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 flex-shrink-0 transition-opacity"
              />
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-white/8 pt-3 space-y-1">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Settings size={15} />
            Paramètres & clés API
          </button>
          <button
            onClick={onNavigateToVectorDB}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Database size={15} />
            Gérer les bases vectorielles
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center gap-3 px-6 py-3 border-b border-white/8">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => { setModelOpen(o => !o); setDomainOpen(false) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-sm transition-colors"
            >
              <Bot size={14} className="text-violet-400" />
              <span className="text-white/90">
                {selectedModel ? selectedModel.name : models.length === 0 ? 'Aucun modèle' : 'Choisir…'}
              </span>
              <ChevronDown size={13} className="text-white/40" />
            </button>
            {modelOpen && (
              <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-[#2a2a2a] border border-white/12 rounded-xl shadow-2xl overflow-hidden">
                {models.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-white/40 text-center">
                    <p>Aucun modèle disponible.</p>
                    <p className="mt-1 text-xs">Configurez une clé API ou démarrez Ollama.</p>
                  </div>
                ) : (
                  Object.entries(modelsByProvider).map(([provider, ms]) => (
                    <div key={provider}>
                      <p className="px-3 pt-2.5 pb-1 text-xs text-white/30 font-medium uppercase tracking-wider">{provider}</p>
                      {ms.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedModel(m); setModelOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-white/8 transition-colors ${
                            selectedModel?.id === m.id ? 'text-violet-400' : 'text-white/80'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  ))
                )}
                <div className="border-t border-white/8 mt-1">
                  <button
                    onClick={() => { setModelOpen(false); setShowSettings(true) }}
                    className="w-full text-left px-3 py-2.5 text-xs text-white/40 hover:text-white/70 hover:bg-white/6 transition-colors flex items-center gap-2"
                  >
                    <Settings size={12} />
                    Configurer les clés API
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Domain selector */}
          <div className="relative">
            <button
              onClick={() => { setDomainOpen(o => !o); setModelOpen(false) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-sm transition-colors"
            >
              <BookOpen size={14} className="text-emerald-400" />
              <span className="text-white/90">
                {selectedDomain ? selectedDomain.name : 'Aucune base'}
              </span>
              <ChevronDown size={13} className="text-white/40" />
            </button>
            {domainOpen && (
              <div className="absolute top-full mt-1 left-0 z-50 w-56 bg-[#2a2a2a] border border-white/12 rounded-xl shadow-2xl overflow-hidden">
                <p className="px-3 pt-2.5 pb-1 text-xs text-white/30 font-medium uppercase tracking-wider">Bases vectorielles</p>
                {domains.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-white/40 italic">Aucune base générée</p>
                ) : (
                  domains.map(d => (
                    <button
                      key={d.name}
                      onClick={() => { setSelectedDomain(d); setDomainOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-white/8 transition-colors ${
                        selectedDomain?.name === d.name ? 'text-emerald-400' : 'text-white/80'
                      }`}
                    >
                      {d.name}
                      <span className="ml-2 text-xs text-white/30">{d.chunk_count} chunks</span>
                    </button>
                  ))
                )}
                <div className="border-t border-white/8 mt-1">
                  <button
                    onClick={() => { setDomainOpen(false); onNavigateToVectorDB() }}
                    className="w-full text-left px-3 py-2.5 text-xs text-white/40 hover:text-white/70 hover:bg-white/6 transition-colors flex items-center gap-2"
                  >
                    <Plus size={12} />
                    Créer une base
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto" onClick={closeDropdowns}>
          {activeConv?.messages.length === 0 ? (
            <EmptyState model={selectedModel} domain={selectedDomain} hasModels={models.length > 0} onSettings={() => setShowSettings(true)} />
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
              {activeConv.messages.map(msg => (
                <Message key={msg.id} msg={msg} />
              ))}
              {loading && activeConv.messages[activeConv.messages.length - 1]?.role === 'user' && (
                <TypingIndicator model={selectedModel} />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/8" onClick={closeDropdowns}>
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-3 bg-[#2a2a2a] border border-white/12 rounded-2xl px-4 py-3 focus-within:border-violet-500/50 transition-colors">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !selectedDomain ? 'Sélectionnez une base vectorielle…'
                  : !selectedModel ? 'Configurez un modèle IA dans les paramètres…'
                  : `Posez votre question sur "${selectedDomain.name}"…`
                }
                rows={1}
                className="flex-1 bg-transparent text-sm text-white/90 placeholder-white/25 resize-none outline-none leading-6 max-h-40 overflow-y-auto"
                style={{ minHeight: '24px' }}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || !selectedModel || !selectedDomain}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {loading
                  ? <Loader2 size={15} className="animate-spin text-white" />
                  : <Send size={15} className="text-white" />
                }
              </button>
            </div>
            <p className="text-center text-xs text-white/20 mt-2">
              Entrée pour envoyer · Shift+Entrée pour nouvelle ligne
            </p>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => { setShowSettings(false); fetchModels() }}
        />
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function EmptyState({ model, domain, hasModels, onSettings }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-20">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg">
        <Sparkles size={26} className="text-white" />
      </div>
      <h2 className="text-xl font-semibold text-white/90 mb-2">Comment puis-je vous aider ?</h2>
      {!hasModels ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-white/40">Aucun modèle IA disponible.</p>
          <button
            onClick={onSettings}
            className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
          >
            Configurer les clés API
          </button>
        </div>
      ) : (
        <p className="text-sm text-white/40 max-w-sm">
          {domain
            ? <>Modèle <span className="text-violet-400">{model?.name}</span> · Base <span className="text-emerald-400">{domain.name}</span></>
            : 'Sélectionnez une base vectorielle dans le menu en haut pour commencer.'
          }
        </p>
      )}
    </div>
  )
}

function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-xl bg-violet-600/80 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-3 leading-relaxed">
          {msg.content}
        </div>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
          <User size={15} className="text-white/60" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow">
        <Bot size={15} className="text-white" />
      </div>
      <div className="flex-1 space-y-3 min-w-0">
        {msg.model && (
          <p className="text-xs text-white/30">{msg.model}{msg.domain ? ` · ${msg.domain}` : ''}</p>
        )}
        {msg.content ? (
          <div className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.isError ? 'text-red-400' : 'text-white/85'}`}>
            {msg.content}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full bg-white/30 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {msg.sources?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-white/30 font-medium uppercase tracking-wider">Sources</p>
            {msg.sources.map((s, i) => (
              <div key={i} className="flex gap-2 bg-white/5 border border-white/8 rounded-lg px-3 py-2">
                <div className="w-1 rounded-full bg-emerald-500 flex-shrink-0 my-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-emerald-400 truncate">{s.file}</p>
                  <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{s.excerpt}…</p>
                </div>
                <span className="text-xs text-white/20 flex-shrink-0 self-start mt-0.5">{Math.round(s.score * 100)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator({ model }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow">
        <Bot size={15} className="text-white" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-white/30 mb-2">{model?.name}</p>
        <div className="flex items-center gap-1.5 py-1">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full bg-white/30 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
