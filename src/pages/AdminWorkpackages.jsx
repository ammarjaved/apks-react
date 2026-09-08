import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { workPackageApi } from '../api/workpackages'
import { userApi } from '../api/users'
import Header from '../components/layout/Header'
import Modal from '../components/ui/Modal'
import SearchInput from '../components/ui/SearchInput'
import { TableCount } from '../components/ui/Pagination'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../utils/apiError'

function emptyForm() {
  return { package_name: '', ba_id: '', zone: '', wp_status: '', remarks: '' }
}

export default function AdminWorkpackages() {
  const { setSidebarOpen } = useOutletContext() || {}
  const { hasRole } = useAuth()
  const canManage = hasRole('admin', 'manager')
  const canDelete = hasRole('admin')

  const [packages, setPackages] = useState([])
  const [bas, setBas] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')

  const fetchPackages = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const items = await workPackageApi.list({ page_size: 200 })
      setPackages(items)
    } catch (err) {
      setListError(errorMessage(err, 'Failed to load work packages.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPackages()
    userApi.listBAs().then(setBas).catch(() => {})
  }, [fetchPackages])

  const visible = useMemo(() => {
    if (!search) return packages
    const needle = search.toLowerCase()
    return packages.filter((wp) =>
      [wp.package_name, wp.zone, wp.wp_status].some((v) => v && String(v).toLowerCase().includes(needle))
    )
  }, [packages, search])

  const baName = (baId) =>
    bas.find((b) => b.id === baId)?.short_name ||
    bas.find((b) => b.id === baId)?.business_area ||
    '—'

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  const openEdit = (wp) => {
    setEditing(wp)
    setForm({
      package_name: wp.package_name || '',
      ba_id: wp.ba_id || '',
      zone: wp.zone || '',
      wp_status: wp.wp_status || '',
      remarks: wp.remarks || '',
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.package_name) {
      setError('Package name is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        package_name: form.package_name,
        ba_id: form.ba_id || null,
        zone: form.zone || null,
        wp_status: form.wp_status || null,
        remarks: form.remarks || null,
      }
      if (editing) await workPackageApi.update(editing.id, payload)
      else await workPackageApi.create(payload)
      setModalOpen(false)
      fetchPackages()
    } catch (err) {
      setError(errorMessage(err, 'Failed to save work package.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (wp) => {
    if (!confirm(`Delete work package "${wp.package_name}"?`)) return
    try {
      await workPackageApi.delete(wp.id)
      fetchPackages()
    } catch (err) {
      setListError(errorMessage(err, 'Failed to delete work package.'))
    }
  }

  if (!canManage) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Work Packages" onMenuClick={() => setSidebarOpen?.(true)} />
        <div className="flex items-center justify-center h-full text-gray-400">You don't have permission to manage work packages.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Work Packages"
        subtitle="A package with no polygon can never be matched from a dropped pin"
        onMenuClick={() => setSidebarOpen?.(true)}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSearch={setSearch}
            placeholder="Search package name, zone…"
            className="max-w-sm"
          />
          <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5 flex-shrink-0">
            New Package
          </button>
        </div>

        {listError && <div className="mb-3 bg-red-50 text-red-700 text-sm rounded-lg p-3">{listError}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Package</th>
                  <th className="table-th">Polygon</th>
                  <th className="table-th">BA</th>
                  <th className="table-th">Zone</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((wp) => (
                  <tr key={wp.id} className="hover:bg-gray-50">
                    <td className="table-td font-medium">{wp.package_name}</td>
                    <td className="table-td">
                      {wp.has_geom ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Has polygon</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">No polygon</span>
                      )}
                    </td>
                    <td className="table-td text-sm text-gray-600">{baName(wp.ba_id)}</td>
                    <td className="table-td text-sm text-gray-600">{wp.zone || '—'}</td>
                    <td className="table-td text-sm text-gray-600">{wp.wp_status || '—'}</td>
                    <td className="table-td text-right">
                      <button onClick={() => openEdit(wp)} className="text-primary-600 hover:text-primary-700 text-xs font-medium mr-3">Edit</button>
                      {canDelete && (
                        <button onClick={() => handleDelete(wp)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TableCount total={visible.length} />
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Work Package' : 'New Work Package'}>
        <div className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div>
            <label className="label">Package name</label>
            <input className="input" value={form.package_name} onChange={(e) => setForm((p) => ({ ...p, package_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Business Area</label>
            <select className="input" value={form.ba_id} onChange={(e) => setForm((p) => ({ ...p, ba_id: e.target.value }))}>
              <option value="">—</option>
              {bas.map((ba) => (
                <option key={ba.id} value={ba.id}>{ba.short_name || ba.business_area}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Zone</label>
              <input className="input" value={form.zone} onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Status</label>
              <input className="input" value={form.wp_status} onChange={(e) => setForm((p) => ({ ...p, wp_status: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Remarks</label>
            <textarea className="input" rows={2} value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
          </div>
          {editing && !editing.has_geom && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
              This package has no polygon, so dropped pins will never auto-assign to it.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
