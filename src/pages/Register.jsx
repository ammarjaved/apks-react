import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { userApi } from '../api/users'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', ba_id: '', zone: '' })
  const [bas, setBas] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    userApi.listBAs().then(setBas).catch(() => {})
  }, [])

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      await authApi.register(form)
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err, 'Registration failed.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <img src={`${import.meta.env.BASE_URL}main-logo.ico`} alt="APKS" className="w-16 h-16 mx-auto rounded-2xl object-contain mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 mt-1">Register as a surveyor</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className="input"
              placeholder="John Doe"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              required
              className="input"
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <label className="label">Business Area (optional)</label>
            <select
              value={form.ba_id}
              onChange={(e) => handleChange('ba_id', e.target.value)}
              className="input"
            >
              <option value="">— Select BA —</option>
              {bas.map((ba) => (
                <option key={ba.id} value={ba.id}>
                  {ba.business_area || ba.short_name || ba.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Zone (optional)</label>
            <input
              type="text"
              value={form.zone}
              onChange={(e) => handleChange('zone', e.target.value)}
              className="input"
              placeholder="Zone name"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
