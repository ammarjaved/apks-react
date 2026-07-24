import { useState, useEffect, useMemo } from 'react'
import { surveyApi } from '../../api/surveys'
import { userApi } from '../../api/users'
import FormField from '../ui/FormField'
import MapView from '../map/MapView'
import { useAuth } from '../../context/AuthContext'

export default function SurveyForm({ config, record, onSave, onCancel }) {
  const { user } = useAuth()
  const isEdit = !!record?.id
  const isWizard = !!config.isWizard
  const isAdmin = user?.is_admin || user?.roles?.includes('admin')

  const [bas, setBas] = useState([])

  // Fetch BAs once
  useEffect(() => {
    userApi.listBAs().then(setBas).catch(() => {})
  }, [])

  // Build BA dropdown options
  const baOptions = useMemo(() => [
    { value: '', label: '— Select BA —' },
    ...bas.map((ba) => ({
      value: ba.id,
      label: ba.business_area || ba.short_name || ba.label || ba.id,
    })),
  ], [bas])

  // Find zone from BA
  const zoneFromBa = (baId) => bas.find((b) => b.id === baId)?.region || null

  const [formData, setFormData] = useState(() => {
    const defaults = {}
    const collectFields = (sections) => {
      sections.forEach((section) => {
        section.fields.forEach((field) => {
          if (field.type === 'defect-group') defaults[field.name] = record?.[field.name] || {}
          else if (field.type === 'span-group') defaults[field.name] = record?.[field.name] || {}
          else defaults[field.name] = record?.[field.name] ?? null
        })
      })
    }
    if (isWizard) {
      config.wizardSteps.forEach((step) => collectFields(step.sections))
    } else {
      collectFields(config.sections)
    }

    // Auto BA from user if not admin
    const userBa = user?.ba_id || null
    return {
      ...defaults,
      latitude: record?.geometry?.latitude || null,
      longitude: record?.geometry?.longitude || null,
      point_id: record?.id || null,
      ba_id: record?.ba_id || userBa,
      zone: record?.zone || user?.zone || null,
      cycle: record?.cycle || 1,
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dropMode, setDropMode] = useState(!isEdit)
  const [activeTab, setActiveTab] = useState('form')
  const [wizardStep, setWizardStep] = useState(0)

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Auto-set zone when ba_id changes
    if (name === 'ba_id') {
      const zone = zoneFromBa(value)
      if (zone) setFormData((prev) => ({ ...prev, zone }))
    }
  }

  const handleMapClick = ({ lng, lat }) => {
    handleChange('longitude', lng)
    handleChange('latitude', lat)
    setDropMode(false)
  }

  const handleSave = async () => {
    setError('')

    if (!formData.latitude || !formData.longitude) {
      setError('Please set a location on the map before saving.')
      setActiveTab('map')
      return
    }

    // Require BA for admin
    if (isAdmin && !formData.ba_id) {
      setError('Please select a Business Area.')
      return
    }

    setSaving(true)
    try {
      const imageFields = []
      const textData = {}
      for (const [key, val] of Object.entries(formData)) {
        if (val instanceof File) {
          imageFields.push({ name: key, file: val })
        } else {
          textData[key] = val
        }
      }

      Object.keys(textData).forEach((k) => {
        if (textData[k] === '') textData[k] = null
      })

      let createdId = record?.id

      if (isEdit) {
        const { latitude, longitude, point_id, ...updateData } = textData
        await surveyApi.update(config.endpoint, record.id, updateData)
      } else {
        const result = await surveyApi.create(config.endpoint, textData)
        createdId = result.id
      }

      if (imageFields.length > 0 && createdId) {
        for (const img of imageFields) {
          try {
            await surveyApi.uploadImage(config.endpoint, createdId, img.file, img.name)
          } catch (e) {
            console.error('Image upload failed:', img.name, e)
          }
        }
      }

      onSave()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map((e) => `${e.loc?.slice(-1)[0] || 'field'}: ${e.msg}`).join('; '))
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to save record.')
      }
    } finally {
      setSaving(false)
    }
  }

  const hasGeometry = formData.latitude != null && formData.longitude != null

  const allSteps = isWizard ? config.wizardSteps : [{ title: 'Form', sections: config.sections }]
  const currentStepData = allSteps[wizardStep] || allSteps[0]

  // Build a custom BA field that replaces the static zone/ba fields
  const baField = {
    name: 'ba_id',
    label: 'Business Area',
    type: 'select',
    required: !user?.ba_id,
    options: baOptions,
  }

  // Check if user has a locked BA (non-admin with ba_id)
  const baLocked = !isAdmin && user?.ba_id

  // Render the BA selector (auto-filled or dropdown)
  const renderBAField = () => {
    if (baLocked) {
      const baName = bas.find((b) => b.id === formData.ba_id)?.business_area || 'Your BA'
      return (
        <div>
          <label className="label">
            Business Area
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 border border-gray-200">
            {baName} <span className="text-xs text-gray-400 ml-1">(auto-assigned)</span>
          </div>
        </div>
      )
    }
    return (
      <div>
        <label className="label">
          Business Area
          {!user?.ba_id && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          value={formData.ba_id || ''}
          onChange={(e) => handleChange('ba_id', e.target.value || null)}
          className="input"
        >
          {baOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }

  // Filter out zone and ba fields from config sections (we handle them ourselves)
  const filterFields = (fields) => fields.filter((f) => f.name !== 'zone' && f.name !== 'ba' && f.name !== 'ba_id')

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200 px-6 pt-2">
        <button
          onClick={() => setActiveTab('form')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'form' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {isWizard ? `Step ${wizardStep + 1}: ${currentStepData.title}` : 'Form Data'}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'map' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Map
          {!hasGeometry && <span className="ml-1 text-red-500">●</span>}
          {hasGeometry && <span className="ml-1 text-xs text-gray-400">{formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'form' && (
          <div className="space-y-6 max-w-4xl">
            {/* Wizard step tabs */}
            {isWizard && (
              <div className="flex gap-1 border-b border-gray-200 pb-2 overflow-x-auto">
                {allSteps.map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => setWizardStep(idx)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${wizardStep === idx ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {idx + 1}. {step.title}
                  </button>
                ))}
              </div>
            )}

            {/* BA auto-select row — always shown at top of first step */}
            {wizardStep === 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Location Assignment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderBAField()}
                  <div>
                    <label className="label">Zone</label>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 border border-gray-200">
                      {formData.zone || zoneFromBa(formData.ba_id) || '—'} <span className="text-xs text-gray-400 ml-1">(auto from BA)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Render sections for current step */}
            {currentStepData.sections.map((section) => (
              <div key={section.title} className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">{section.title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterFields(section.fields).map((field) => (
                    <FormField
                      key={field.name + (field.type === 'span-group' ? field.label : '')}
                      field={field}
                      value={formData[field.name]}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Wizard nav buttons */}
            {isWizard && (
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setWizardStep(Math.max(0, wizardStep - 1))}
                  disabled={wizardStep === 0}
                  className="btn-secondary"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setWizardStep(Math.min(allSteps.length - 1, wizardStep + 1))}
                  disabled={wizardStep === allSteps.length - 1}
                  className="btn-secondary"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'map' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Set Location</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {hasGeometry ? `Location: ${formData.latitude.toFixed(6)}, ${formData.longitude.toFixed(6)}` : 'Click on the map to place the inspection point'}
                </p>
              </div>
              {hasGeometry && (
                <button onClick={() => setDropMode(true)} className="btn-secondary btn-sm">Reposition</button>
              )}
            </div>
            <MapView
              surveyConfig={config}
              dropMode={dropMode}
              onMapClick={handleMapClick}
              height={450}
              initialCenter={hasGeometry ? [formData.longitude, formData.latitude] : undefined}
              initialZoom={hasGeometry ? 16 : 11}
            />
          </div>
        )}
      </div>

      {error && <div className="px-6 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Update Record' : 'Create Record'}
        </button>
      </div>
    </div>
  )
}
