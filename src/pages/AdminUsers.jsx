import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { userApi } from '../api/users'
import Header from '../components/layout/Header'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'

const ROLES = ['admin', 'manager', 'qc_officer', 'team_leader', 'surveyor', 'viewer']

export default function AdminUsers() {
  const { setSidebarOpen } = useOutletContext() || {}
  const { hasRole } = useAuth()
  const [users, setUsers] = useState([])
  const [bas, setBas] = useState([])
  const [roles, setRoles] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')

  const canManage = hasRole('admin', 'manager')

  function emptyForm() {
    return { name: '', email: '', password: '', ba_id: '', zone: '', id_team: '', is_active: true, role_names: ['surveyor'] }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const u = await userApi.list()
      setUsers(u)
    } catch (err) {
      setListError(err.response?.data?.detail || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    userApi.listBAs().then(setBas).catch(() => {})
    userApi.listRoles().then(setRoles).catch(() => {})
    userApi.listTeams().then(setTeams).catch(() => {})
  }, [fetchUsers])

  const openCreate = () => {
    setEditingUser(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  const openEdit = (user) => {
    setEditingUser(user)
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      ba_id: user.ba_id || '',
      zone: user.zone || '',
      id_team: user.id_team || '',
      is_active: user.is_active ?? true,
      role_names: user.roles || [],
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.name || !form.email) { setError('Name and email are required.'); return }
    if (!editingUser && form.password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        ba_id: form.ba_id || null,
        zone: form.zone || null,
        id_team: form.id_team || null,
        role_names: form.role_names,
      }
      if (!editingUser) payload.password = form.password

      if (editingUser) {
        await userApi.update(editingUser.id, { ...payload, is_active: form.is_active })
        if (form.role_names?.length) await userApi.assignRoles(editingUser.id, form.role_names)
      } else {
        await userApi.create(payload)
      }
      setModalOpen(false)
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user) => {
    if (!confirm(`Delete user "${user.name}"?`)) return
    try {
      await userApi.delete(user.id)
      fetchUsers()
    } catch { }
  }

  const toggleRole = (role) => {
    setForm((prev) => ({
      ...prev,
      role_names: prev.role_names.includes(role)
        ? prev.role_names.filter((r) => r !== role)
        : [...prev.role_names, role],
    }))
  }

  const baName = (ba_id) => bas.find((b) => b.id === ba_id)?.business_area || bas.find((b) => b.id === ba_id)?.short_name || '—'

  if (!canManage) {
    return (
      <div className="flex flex-col h-full">
        <Header title="User Management" onMenuClick={() => setSidebarOpen?.(true)} />
        <div className="flex items-center justify-center h-full text-gray-400">You don't have permission to manage users.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="User Management"
        subtitle="Create and manage user accounts"
        onMenuClick={() => setSidebarOpen?.(true)}
        actions={
          <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New User
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {listError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {listError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Business Area</th>
                  <th className="table-th">Team</th>
                  <th className="table-th">Zone</th>
                  <th className="table-th">Roles</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="table-td font-medium">{u.name}</td>
                    <td className="table-td text-gray-600">{u.email}</td>
                    <td className="table-td">{baName(u.ba_id)}</td>
                    <td className="table-td">{teams.find((t) => t.id === u.id_team)?.team_name || '—'}</td>
                    <td className="table-td">{u.zone || '—'}</td>
                    <td className="table-td">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((r) => (
                          <span key={r} className="px-1.5 py-0.5 text-xs rounded bg-primary-100 text-primary-700">{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="table-td">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="table-td text-right">
                      <button onClick={() => openEdit(u)} className="text-primary-600 hover:text-primary-700 text-xs font-medium mr-3">Edit</button>
                      <button onClick={() => handleDelete(u)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="text-center text-gray-400 py-8">No users found.</p>}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? 'Edit User' : 'Create User'} size="md">
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required />
            </div>
          </div>

          {!editingUser && (
            <div>
              <label className="label">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required placeholder="Min 6 characters" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Business Area</label>
              <select value={form.ba_id} onChange={(e) => setForm({ ...form, ba_id: e.target.value })} className="input">
                <option value="">— Select BA —</option>
                {bas.map((ba) => (
                  <option key={ba.id} value={ba.id}>{ba.business_area || ba.short_name || ba.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Team</label>
              <select value={form.id_team} onChange={(e) => setForm({ ...form, id_team: e.target.value })} className="input">
                <option value="">— Select Team —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.team_name}{t.zone ? ` (${t.zone})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Zone</label>
            <input type="text" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="input" />
          </div>

          <div>
            <label className="label">Roles</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.role_names.includes(role)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {editingUser && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-gray-700">Account Active</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
