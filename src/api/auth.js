import client from './client'

export const authApi = {
  login: async (emailOrName, password) => {
    const { data } = await client.post('/auth/login', { email: emailOrName, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return data
  },

  register: async ({ name, email, password, ba_id, zone }) => {
    const { data } = await client.post('/auth/register', { name, email, password, ba_id, zone })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return data
  },

  logout: async () => {
    try {
      await client.post('/auth/logout', {
        refresh_token: localStorage.getItem('refresh_token'),
      })
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
    }
  },

  me: async () => {
    const { data } = await client.get('/auth/me')
    localStorage.setItem('user', JSON.stringify(data))
    return data
  },

  getStoredUser: () => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('access_token')
  },
}
