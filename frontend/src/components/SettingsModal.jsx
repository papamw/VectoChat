import { useState, useEffect } from 'react'
import { X, Save, Eye, EyeOff, Server, Key, CheckCircle } from 'lucide-react'
import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000' })

export default function SettingsModal({ onClose }) {
  const [form, setForm] = useState({
    anthropic_api_key: '',
    openai_api_key: '',
    ollama_url: 'http://localhost:11434',
  })
  const [show, setShow] = useState({ anthropic: false, openai: false })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasKeys, setHasKeys] = useState({ anthropic: false, openai: false })

  useEffect(() => {
    api.get('/config').then(res => {
      setForm(f => ({
        ...f,
        ollama_url: res.data.ollama_url || 'http://localhost:11434',
        anthropic_api_key: res.data.anthropic_api_key || '',
        openai_api_key: res.data.openai_api_key || '',
      }))
      setHasKeys({ anthropic: res.data.has_anthropic, openai: res.data.has_openai })
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('anthropic_api_key', form.anthropic_api_key)
      fd.append('openai_api_key', form.openai_api_key)
      fd.append('ollama_url', form.ollama_url)
      await api.post('/config', fd)
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 1200)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-white/12 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="font-semibold text-white text-base">Paramètres</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Anthropic */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Key size={14} className="text-violet-400" />
              <h3 className="text-sm font-medium text-white/80">Anthropic (Claude)</h3>
              {hasKeys.anthropic && <CheckCircle size={13} className="text-emerald-400 ml-auto" />}
            </div>
            <div className="relative">
              <input
                type={show.anthropic ? 'text' : 'password'}
                value={form.anthropic_api_key}
                onChange={e => setForm(f => ({ ...f, anthropic_api_key: e.target.value }))}
                placeholder={hasKeys.anthropic ? '••••••••  (clé existante)' : 'sk-ant-...'}
                className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder-white/25 outline-none focus:border-violet-500/50 pr-10"
              />
              <button
                onClick={() => setShow(s => ({ ...s, anthropic: !s.anthropic }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {show.anthropic ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </section>

          {/* OpenAI */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Key size={14} className="text-emerald-400" />
              <h3 className="text-sm font-medium text-white/80">OpenAI (GPT)</h3>
              {hasKeys.openai && <CheckCircle size={13} className="text-emerald-400 ml-auto" />}
            </div>
            <div className="relative">
              <input
                type={show.openai ? 'text' : 'password'}
                value={form.openai_api_key}
                onChange={e => setForm(f => ({ ...f, openai_api_key: e.target.value }))}
                placeholder={hasKeys.openai ? '••••••••  (clé existante)' : 'sk-...'}
                className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder-white/25 outline-none focus:border-emerald-500/50 pr-10"
              />
              <button
                onClick={() => setShow(s => ({ ...s, openai: !s.openai }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {show.openai ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </section>

          {/* Ollama */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Server size={14} className="text-blue-400" />
              <h3 className="text-sm font-medium text-white/80">Ollama (modèles locaux)</h3>
            </div>
            <input
              type="text"
              value={form.ollama_url}
              onChange={e => setForm(f => ({ ...f, ollama_url: e.target.value }))}
              placeholder="http://localhost:11434"
              className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder-white/25 outline-none focus:border-blue-500/50"
            />
            <p className="mt-1.5 text-xs text-white/25">Les modèles installés via Ollama apparaîtront automatiquement dans la liste.</p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm rounded-lg transition-colors"
          >
            {saved ? <CheckCircle size={15} /> : <Save size={15} />}
            {saved ? 'Sauvegardé !' : saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
