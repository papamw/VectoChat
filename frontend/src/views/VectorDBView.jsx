import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import DomainList from '../components/DomainList'
import DomainContent from '../components/DomainContent'
import CreateDomainModal from '../components/CreateDomainModal'
import ImportJsonModal from '../components/ImportJsonModal'
import Notification from '../components/Notification'
import * as api from '../api/client'

export default function VectorDBView({ onBack }) {
  const [domains, setDomains] = useState([])
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [domainLoading, setDomainLoading] = useState(false)
  const [notification, setNotification] = useState(null)
  const [showCreateDomain, setShowCreateDomain] = useState(false)
  const [showImportJson, setShowImportJson] = useState(false)

  const notify = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // useCallback sans dépendance sur selectedDomain — on utilise la forme
  // fonctionnelle de setSelectedDomain pour toujours lire la valeur fraîche.
  const fetchDomains = useCallback(async () => {
    try {
      const res = await api.getDomains()
      setDomains(res.data)
      setSelectedDomain(prev =>
        prev ? (res.data.find(d => d.name === prev.name) ?? null) : null
      )
    } catch {
      notify('Impossible de joindre le serveur backend', 'error')
    }
  }, []) // eslint-disable-line

  useEffect(() => { fetchDomains() }, []) // eslint-disable-line

  const handleCreateDomain = async (name) => {
    setDomainLoading(true)
    try {
      await api.createDomain(name)
      const res = await api.getDomains()
      setDomains(res.data)
      const created = res.data.find(d => d.name === name)
      setSelectedDomain(created || null)
      setShowCreateDomain(false)
      notify(`Domaine "${name}" créé`)
    } catch (e) {
      notify(e.response?.data?.detail || 'Erreur création domaine', 'error')
    } finally {
      setDomainLoading(false)
    }
  }

  const handleImportJsonSuccess = async (result) => {
    setShowImportJson(false)
    notify(`Base "${result.domain}" importée — ${result.chunks} chunks`)
    const res = await api.getDomains()
    setDomains(res.data)
    const imported = res.data.find(d => d.name === result.domain)
    setSelectedDomain(imported || null)
  }

  const handleDeleteDomain = async (name) => {
    if (!confirm(`Supprimer le domaine "${name}" et tous ses fichiers ?`)) return
    try {
      await api.deleteDomain(name)
      if (selectedDomain?.name === name) setSelectedDomain(null)
      await fetchDomains()
      notify(`Domaine "${name}" supprimé`)
    } catch {
      notify('Erreur suppression domaine', 'error')
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DomainList
        domains={domains}
        selectedDomain={selectedDomain}
        onSelect={setSelectedDomain}
        onDelete={handleDeleteDomain}
        onCreateNew={() => setShowCreateDomain(true)}
        onImportJson={() => setShowImportJson(true)}
        headerSlot={
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors px-1 py-0.5 rounded"
          >
            <ArrowLeft size={13} />
            Retour au chat
          </button>
        }
      />

      <main className="flex-1 overflow-hidden">
        <DomainContent
          domain={selectedDomain}
          onRefresh={fetchDomains}
          onNotify={notify}
        />
      </main>

      {showCreateDomain && (
        <CreateDomainModal
          onClose={() => setShowCreateDomain(false)}
          onCreate={handleCreateDomain}
          loading={domainLoading}
        />
      )}

      {showImportJson && (
        <ImportJsonModal
          onClose={() => setShowImportJson(false)}
          onSuccess={handleImportJsonSuccess}
        />
      )}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  )
}
