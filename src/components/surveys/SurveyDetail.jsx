import { useState } from 'react'
import StatusBadge from '../ui/StatusBadge'
import MapView from '../map/MapView'
import { imageUrl } from '../../utils/imageUrl'
import { useAuth } from '../../context/AuthContext'

export default function SurveyDetail({ config, record, onEdit, onDelete, onQaAction, onBack }) {
  const { user } = useAuth()
  const userBaId = user?.is_admin ? null : user?.ba_id
  const [lightbox, setLightbox] = useState(null)
  if (!record) return null

  // Flatten wizard steps into sections for display
  const sections = config.sections || (config.wizardSteps || []).flatMap(step => step.sections || [])

  const renderValue = (field, value) => {
    if (value == null || value === '') return <span className="text-gray-300">—</span>

    // Parse JSON strings for defect/span/object fields
    let parsed = value
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try { parsed = JSON.parse(value) } catch { /* keep as string */ }
    }

    // Defect groups: show checked items as badges
    if (field.type === 'defect-group' && typeof parsed === 'object') {
      const checked = Object.entries(parsed).filter(([k, v]) => v && k !== 'other_value')
      if (!checked.length) return <span className="text-gray-300">No defects</span>
      return (
        <div className="flex flex-wrap gap-1">
          {checked.map(([key]) => (
            <span key={key} className="px-1.5 py-0.5 text-xs rounded bg-orange-100 text-orange-700 capitalize">
              {key.replace(/_/g, ' ')}
            </span>
          ))}
          {parsed.other_value && <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">{parsed.other_value}</span>}
        </div>
      )
    }

    // Span groups: show sub-fields with their selected value
    if (field.type === 'span-group' && typeof parsed === 'object') {
      const entries = Object.entries(parsed).filter(([k, v]) => v && !k.endsWith('_other'))
      if (!entries.length) return <span className="text-gray-300">—</span>
      return (
        <div className="space-y-0.5 text-xs text-gray-700">
          {entries.map(([key, val]) => {
            const sub = field.subFields?.find(s => s.key === key)
            const otherKey = `${key}_other`
            return (
              <div key={key}>
                <span className="font-medium">{sub?.label || key}:</span>{' '}
                <span>{val === 'other' ? parsed[otherKey] || 'other' : val}</span>
              </div>
            )
          })}
        </div>
      )
    }

    // Radio buttons: just show the value
    if (field.type === 'radio') {
      return String(value)
    }

    // Generic JSON objects (not defect/span): show as readable key-value
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed).filter(([k, v]) => v != null && v !== false)
      if (!entries.length) return <span className="text-gray-300">—</span>
      return (
        <div className="space-y-0.5 text-xs text-gray-700">
          {entries.map(([key, val]) => (
            <div key={key}>
              <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
              <span>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
            </div>
          ))}
        </div>
      )
    }

    if (field.type === 'image') {
      if (!value || typeof value !== 'string') return <span className="text-gray-300">—</span>
      return (
        <img src={imageUrl(value)} alt={field.label} className="w-16 h-16 object-cover rounded border border-gray-200"
          onError={(e) => { e.target.style.display = 'none' }} loading="lazy" />
      )
    }

    if (field.type === 'checkbox') {
      return value ? 'Yes' : 'No'
    }
    if (field.type === 'datetime') {
      return new Date(value).toLocaleString()
    }
    if (field.type === 'date') {
      return new Date(value).toLocaleDateString()
    }
    return String(value)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{config.title} Details</h2>
            <StatusBadge status={record.qa_status} />
          </div>
          <p className="text-xs text-gray-500 mt-1 font-mono">{record.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="btn-secondary btn-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          )}
          {onQaAction && record.qa_status !== 'Accept' && (
            <button
              onClick={() => onQaAction('Accept')}
              className="btn-sm bg-green-600 text-white rounded-lg hover:bg-green-700 px-3 py-1.5 text-sm font-medium"
            >
              Accept
            </button>
          )}
          {onQaAction && record.qa_status !== 'Reject' && (
            <button
              onClick={() => onQaAction('Reject')}
              className="btn-sm bg-red-600 text-white rounded-lg hover:bg-red-700 px-3 py-1.5 text-sm font-medium"
            >
              Reject
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="btn-secondary btn-sm">
              Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="btn-danger btn-sm">
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Map */}
        {record.geometry && (
          <div className="mb-6">
            <MapView
              surveyConfig={config}
              baId={userBaId}
              height={300}
              initialCenter={[record.geometry.longitude, record.geometry.latitude]}
              initialZoom={16}
            />
          </div>
        )}

        {/* Form sections */}
        <div className="space-y-4 max-w-4xl">
          {sections.map((section) => (
            <div key={section.title} className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                {section.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                {section.fields.map((field) => (
                  <div key={field.name}>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">{field.label}</p>
                    <div className="text-sm text-gray-900">{renderValue(field, record[field.name])}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Metadata */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              Metadata
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Created By</p>
                <p className="text-sm text-gray-900 font-mono">{record.created_by?.substring(0, 8) || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Created At</p>
                <p className="text-sm text-gray-900">{record.created_at ? new Date(record.created_at).toLocaleString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Updated At</p>
                <p className="text-sm text-gray-900">{record.updated_at ? new Date(record.updated_at).toLocaleString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Cycle</p>
                <p className="text-sm text-gray-900">{record.cycle ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Images from survey_images table */}
          {record.images && record.images.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                Uploaded Images ({record.images.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {record.images.map((img) => (
                  <div key={img.id} className="relative group cursor-pointer" onClick={() => setLightbox({ url: imageUrl(img.image_url), label: `${img.image_type}${img.image_label ? ' · ' + img.image_label : ''}` })}>
                    <img
                      src={imageUrl(img.image_url)}
                      alt={img.image_label || img.image_type}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200 transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg">
                      {img.image_type}{img.image_label ? ` · ${img.image_label}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images from record columns */}
          {(() => {
            const imageFields = sections.flatMap(s => s.fields).filter(f => f.type === 'image')
            const imagesWithData = imageFields.filter(f => record[f.name] && typeof record[f.name] === 'string')
            if (imagesWithData.length === 0) return null
            return (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                  Inspection Images ({imagesWithData.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {imagesWithData.map((field) => (
                    <div key={field.name} className="relative group cursor-pointer" onClick={() => setLightbox({ url: imageUrl(record[field.name]), label: field.label })}>
                      <img
                        src={imageUrl(record[field.name])}
                        alt={field.label}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 transition-transform group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg">
                        {field.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10"
            onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
          >
            &times;
          </button>
          <div className="relative max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.label}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              onError={(e) => { e.target.src = ''; e.target.alt = 'Image not available' }}
            />
            {lightbox.label && (
              <p className="text-center text-white text-sm mt-3">{lightbox.label}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
