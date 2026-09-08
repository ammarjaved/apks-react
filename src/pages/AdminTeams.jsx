import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { teamApi } from '../api/teams'
import { userApi } from '../api/users'
import Header from '../components/layout/Header'
import Modal from '../components/ui/Modal'
import SearchInput from '../components/ui/SearchInput'
import { TableCount } from '../components/ui/Pagination'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../utils/apiError'

export default function AdminTeams() {
  const { setSidebarOpen } = useOutletContext() || {}
  const { hasRole } = useAuth()
  const [teams, setTeams] = useState([])
  const [bas, setBas] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')

  const canManage = hasRole('admin')

  function emptyForm() {
    return { team_name: '', ba_id: '', zone: '', leader_id: '', is_active: true }
  }

  // GET /teams has no `search` param, so the list is fetched once and filtered
  // locally.
  const fetchTeams = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const t = await teamApi.list({ page_size: 200 })
      setTeams(t)
    } catch (err) {
      setListError(errorMessage(err, 'Failed to load teams.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
    userApi.listBAs().then(setBas).catch(() => {})
    userApi.list({ page_size: 200 }).then(setUsers).catch(() => {})
  }, [fetchTeams])

  const visibleTeams = useMemo(() => {
    if (!search) return teams
    const needle = search.toLowerCase()
    return teams.filter((t) =>
      [t.team_name, t.zone].some((v) => v && String(v).toLowerCase().includes(needle))
    )
  }, [teams, search])

  const openCreate = () => {
    setEditingTeam(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  const openEdit = (team) => {
    setEditingTeam(team)
    setForm({
      team_name: team.team_name || '',
      ba_id: team.ba_id || '',
      zone: team.zone || '',
      leader_id: team.leader_id || '',
      is_active: team.is_active ?? true,
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.team_name) { setError('Team name is required.'); return }

    setSaving(true)
    try {
      const payload = {
        team_name: form.team_name,
        ba_id: form.ba_id || null,
        zone: form.zone || null,
        leader_id: form.leader_id || null,
      }
      if (editingTeam) {
        // `is_active` only exists on TeamUpdate, not TeamCreate.
        await teamApi.update(editingTeam.id, { ...payload, is_active: form.is_active })
      } else {
        await teamApi.create(payload)
      }
      setModalOpen(false)
      fetchTeams()
    } catch (err) {
      setError(errorMessage(err, 'Failed to save team.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (team) => {
    if (!confirm(`Delete team "${team.team_name}"?`)) return
    try {
      await teamApi.delete(team.id)
      fetchTeams()
    } catch (err) {
      setListError(errorMessage(err, 'Failed to delete team.'))
    }
  }

  const baName = (ba_id) =>
    bas.find((b) => b.id === ba_id)?.business_area ||
    bas.find((b) => b.id === ba_id)?.short_name || '—'

  const leaderName = (leader_id) =>
    users.find((u) => u.id === leader_id)?.name || '—'

  if (!canManage) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Team Management" onMenuClick={() => setSidebarOpen?.(true)} />
        <div className="flex items-center justify-center h-full text-gray-400">You don't have permission to manage teams.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Team Management"
        subtitle="Create and manage field teams"
        onMenuClick={() => setSidebarOpen?.(true)}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSearch={setSearch}
            placeholder="Search team name, zone…"
            className="max-w-sm"
          />
          <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Team
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
                  <th className="table-th">Team Name</th>
                  <th className="table-th">Business Area</th>
                  <th className="table-th">Zone</th>
                  <th className="table-th">Leader</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleTeams.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="table-td font-medium">{t.team_name}</td>
                    <td className="table-td">{baName(t.ba_id)}</td>
                    <td className="table-td">{t.zone || '—'}</td>
                    <td className="table-td">{leaderName(t.leader_id)}</td>
                    <td className="table-td">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        {t.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="table-td text-right">
                      <button onClick={() => openEdit(t)} className="text-primary-600 hover:text-primary-700 text-xs font-medium mr-3">Edit</button>
                      <button onClick={() => handleDelete(t)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleTeams.length === 0 && <p className="text-center text-gray-400 py-8">No teams found.</p>}
            {visibleTeams.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <TableCount total={visibleTeams.length} noun="teams" />
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingTeam ? 'Edit Team' : 'Create Team'} size="md">
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="label">Team Name</label>
            <input type="text" value={form.team_name} onChange={(e) => setForm({ ...form, team_name: e.target.value })} className="input" required />
          </div>

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
              <label className="label">Zone</label>
              <input type="text" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Team Leader</label>
            <select value={form.leader_id} onChange={(e) => setForm({ ...form, leader_id: e.target.value })} className="input">
              <option value="">— Select Leader —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-gray-700">Team Active</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
