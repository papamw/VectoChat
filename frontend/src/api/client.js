import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120_000,
})

export const getDomains = () => api.get('/domains')

export const createDomain = (name) => {
  const form = new FormData()
  form.append('name', name)
  return api.post('/domain', form)
}

export const deleteDomain = (name) => api.delete(`/domain/${name}`)

export const uploadFile = (domain, file) => {
  const form = new FormData()
  form.append('domain', domain)
  form.append('file', file)
  return api.post('/upload', form)
}

export const deleteFile = (domain, filename) =>
  api.delete('/file', { params: { domain, filename } })

export const generateVectorDB = (domain) => {
  const form = new FormData()
  form.append('domain', domain)
  return api.post('/generate-vector-db', form)
}

export const updateVectorDB = (domain) => {
  const form = new FormData()
  form.append('domain', domain)
  return api.post('/update-vector-db', form)
}

export const getVectorDB = (domain) => api.get(`/vector-db/${domain}`)

export const getModels = () => api.get('/models')

export const getConfig = () => api.get('/config')

export const updateConfig = (data) => {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => form.append(k, v))
  return api.post('/config', form)
}

export const search = (domain, query, topK = 5) => {
  const form = new FormData()
  form.append('domain', domain)
  form.append('query', query)
  form.append('top_k', String(topK))
  return api.post('/search', form)
}
