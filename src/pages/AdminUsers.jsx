import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { userApi } from '../api/users'
import { teamApi } from '../api/teams'
import Header from '../components/layout/Header'
import Modal from '../components/ui/Modal'
import SearchInput from '../components/ui/SearchInput'
import { TableCount } from '../components/ui/Pagination'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../utils/apiError'

// Fallback only — the real list comes from GET /users/roles.
const FALLBACK_ROLES = ['admin', 'manager', 'qc_officer', 'team_leader', 'surveyor', 'viewer', 'tnb']

// Shown under the role buttons so whoever grants it knows what it does.
const ROLE_HINTS = {
  tnb: 'TNB viewer — read-only, sees QA-accepted records only, cannot generate or download QR.',
}

export default function AdminUsers() {
  const { setSidebarOpen } = useOutletContext() || {}
  const { hasRole } = useAuth()
  const [users, setUsers] = useState([])
  const [bas, setBas] = useState([])
  const [roles, setRoles] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
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

  // GET /users has no `search` param, so the list is fetched once and filtered
  // locally.
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const u = await userApi.list({ page_size: 200 })
      setUsers(u)
    } catch (err) {
      setListError(errorMessage(err, 'Failed to load users.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    userApi.listBAs().then(setBas).catch(() => {})
    userApi.listRoles().then(setRoles).catch(() => {})
    teamApi.list({ page_size: 200 }).then(setTeams).catch(() => {})
  }, [fetchUsers])

  const roleNames = useMemo(
    () => (roles.length ? roles.map((r) => r.role_name) : FALLBACK_ROLES),
    [roles]
  )

  const visibleUsers = useMemo(() => {
    if (!search) return users
    const needle = search.toLowerCase()
    return users.filter((u) =>
      [u.name, u.email, u.zone, ...(u.roles || [])]
        .some((v) => v && String(v).toLowerCase().includes(needle))
    )
  }, [users, search])

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
    // On edit the password is optional: blank keeps the current one.
    if (editingUser && form.password && form.password.length < 6) { setError('New password must be at least 6 characters.'); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        ba_id: form.ba_id || null,
        zone: form.zone || null,
        id_team: form.id_team || null,
      }

      if (editingUser) {
        // UserUpdate carries no roles — they are assigned via a separate call.
        await userApi.update(editingUser.id, {
          ...payload,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        })
        if (form.role_names?.length) await userApi.assignRoles(editingUser.id, form.role_names)
      } else {
        await userApi.create({ ...payload, password: form.password, role_names: form.role_names })
      }
      setModalOpen(false)
      fetchUsers()
    } catch (err) {
      setError(errorMessage(err, 'Failed to save user.'))
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
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSearch={setSearch}
            placeholder="Search name, email, zone…"
            className="max-w-sm"
          />
          <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New User
          </button>
        </div>

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
                {visibleUsers.map((u) => (
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
            {visibleUsers.length === 0 && <p className="text-center text-gray-400 py-8">No users found.</p>}
            {visibleUsers.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <TableCount total={visibleUsers.length} noun="users" />
              </div>
            )}
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

          {editingUser ? (
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                placeholder="Leave blank to keep the current password"
              />
              <p className="text-xs text-gray-500 mt-1">Changing it signs the user out of every device.</p>
            </div>
          ) : (
            <div>
              <label className="label">Password</label>
              <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required placeholder="Min 6 characters" />
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
              {roleNames.map((role) => (
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
            {form.role_names.filter((r) => ROLE_HINTS[r]).map((r) => (
              <p key={r} className="text-xs text-gray-500 mt-2">{ROLE_HINTS[r]}</p>
            ))}
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
