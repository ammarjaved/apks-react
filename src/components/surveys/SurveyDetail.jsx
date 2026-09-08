import { useEffect, useState } from 'react'
import StatusBadge from '../ui/StatusBadge'
import MapView from '../map/MapView'
import ImageLightbox from '../ui/ImageLightbox'
import { imageUrl } from '../../utils/imageUrl'
import { optionLabel } from '../../utils/options'
import { useAuth } from '../../context/AuthContext'
import { surveyApi, arusApi, assetLinkApi } from '../../api/surveys'
import { userApi } from '../../api/users'

const ASSET_TYPE_LABELS = {
  tbl_savr: 'Pole',
  tbl_link_box: 'Link Box',
  tbl_cable_bridge: 'Cable Bridge',
  tbl_feeder_pillar: 'Feeder Pillar',
}

export default function SurveyDetail({ config, record, onEdit, onDelete, onQaAction, onBack, onPointSelect }) {
  const { user } = useAuth()
  const userBaId = user?.is_admin ? null : user?.ba_id
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [arusViewer, setArusViewer] = useState(null)
  const [creatorName, setCreatorName] = useState(record?.created_by_name || '')
  const [savrTiangNo, setSavrTiangNo] = useState(record?.savr_tiang_no || '')

  useEffect(() => {
    if (record?.created_by_name) {
      setCreatorName(record.created_by_name)
      return
    }
    if (!record?.created_by) {
      setCreatorName('')
      return
    }
    let cancelled = false
    userApi
      .get(record.created_by)
      .then((u) => {
        if (!cancelled) setCreatorName(u.name || '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [record?.created_by, record?.created_by_name])

  useEffect(() => {
    if (record?.savr_tiang_no) {
      setSavrTiangNo(record.savr_tiang_no)
      return
    }
    if (!record?.savr_id) {
      setSavrTiangNo('')
      return
    }
    let cancelled = false
    surveyApi
      .get('savr', record.savr_id)
      .then((s) => {
        if (!cancelled) setSavrTiangNo(s.tiang_no || '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [record?.savr_id, record?.savr_tiang_no])

  // Reading photos live on tbl_arus rows, not on the pole, so they are absent
  // from `record.images` and have to be fetched. One bulk call for all readings.
  const [arusPhotos, setArusPhotos] = useState({})
  useEffect(() => {
    const ids = (record?.arus || []).map((r) => r.id).filter(Boolean)
    if (ids.length === 0) { setArusPhotos({}); return }
    let cancelled = false
    arusApi.imagesFor(ids)
      .then((byRow) => { if (!cancelled) setArusPhotos(byRow) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [record?.id, record?.arus_count])

  // The span's ends are polymorphic ids — meaningless on screen without the
  // lookup that turns them into "TIANG-A (Pole)". The span endpoint does that,
  // and hands back the measured length between them at the same time.
  const [span, setSpan] = useState(null)
  const hasSpan = (config.sections || []).some((sec) =>
    (sec.fields || []).some((f) => f.type === 'asset-select'))
  useEffect(() => {
    if (!hasSpan || !record?.id) { setSpan(null); return }
    let cancelled = false
    assetLinkApi.span(record.id)
      .then((d) => { if (!cancelled) setSpan(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [hasSpan, record?.id])

  if (!record) return null

  // Flatten wizard steps into sections for display
  const sections = config.sections || (config.wizardSteps || []).flatMap(step => step.sections || [])

  // The photos are gathered into the one "Uploaded Images" card below rather
  // than being repeated under each section, so a section holding nothing but
  // image slots ("Substation Images", "Cable Bridge Images", …) has nothing
  // left to draw — it is dropped here rather than left as an empty heading.
  // The sections themselves stay in the config: the wizard uploads through
  // them, and their labels caption the images.
  // A section with a `component` draws itself (leakage readings, say) and has no
  // fields to test, so it is kept regardless.
  const detailSections = sections.filter((section) =>
    section.component || (section.fields || []).some((f) => f.type !== 'image' && !f.hidden)
  )

  // Leakage readings come embedded in GET /savr/{id}. They carry no QA status of
  // their own — the pole's decision covers them — so there is no per-reading
  // Accept / Reject here, by design.
  const arusReadings = record.arus || []

  const images = record.images || []
  const labelByCode = Object.fromEntries(
    sections.flatMap((s) => s.fields || []).filter((f) => f.type === 'image').map((f) => [f.name, f.label])
  )
  const captionFor = (img) => {
    const base = labelByCode[img.image_type] || img.image_type
    return img.image_label ? `${base} · ${img.image_label}` : base
  }
  const lightboxImages = images.map((img) => ({
    url: imageUrl(img.image_url),
    label: captionFor(img),
  }))

  const renderValue = (field, value) => {
    if (value == null || value === '') return <span className="text-gray-300">—</span>

    // Boolean checkboxes: show Yes/No badge
    if (field.type === 'checkbox') {
      return yesNoBadge(Boolean(value))
    }

    // Selects: show the option's label, not the raw stored value. Several
    // Yes/No columns are varchars holding "1"/"0", so printing the value
    // straight through showed a bare 1 where the form asked a yes/no question.
    if (field.type === 'select' && field.options?.length) {
      const label = optionLabel(field.options, value)
      if (label === 'Yes' || label === 'No') return yesNoBadge(label === 'Yes')
      return label
    }

    // Parse JSON strings for span/object fields
    let parsed = value
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try { parsed = JSON.parse(value) } catch { /* keep as string */ }
    }

    // Span groups: show sub-fields with their selected value
    if (field.type === 'span-group' && typeof parsed === 'object') {
      const entries = Object.entries(parsed).filter(([k, v]) => v && !k.endsWith('_other'))
      if (!entries.length) return <span className="text-gray-300">—</span>
      return (
        <div className="space-y-0.5 text-xs text-gray-700">
          {entries.map(([key, val]) => {
            const sub = field.subFields?.find((s) => s.key === key || (s.aliases || []).includes(key))
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

    if (field.type === 'savr-select') {
      return savrTiangNo || '—'
    }

    if (field.type === 'asset-select') {
      const end = span?.[field.name === 'from_id' ? 'from' : 'to']
      if (!end) return <span className="text-gray-400 font-mono text-xs">{String(value)}</span>
      if (end.exists === false) {
        return <span className="text-amber-600">Asset no longer exists</span>
      }
      const type = ASSET_TYPE_LABELS[end.asset_type] || end.asset_type
      return `${end.label || end.device_id || String(value).slice(0, 8)} (${type})`
    }

    if (field.type === 'datetime') {
      return new Date(value).toLocaleString()
    }
    if (field.type === 'date') {
      return new Date(value).toLocaleDateString()
    }
    return String(value)
  }

  function yesNoBadge(isYes) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isYes ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
      }`}>
        {isYes ? 'Yes' : 'No'}
      </span>
    )
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
          <p className="text-xs text-gray-500 mt-1 font-mono">
            {record.id}
            {record.device_id && (
              <span className="text-gray-700"> / {record.device_id}</span>
            )}
          </p>
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

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6">
        {record.geometry && (
          <aside className="order-first lg:order-last w-full lg:w-1/2 lg:h-full flex-shrink-0">
            <div className="card overflow-hidden h-72 lg:h-full">
              <MapView
                surveyConfig={config}
                baId={userBaId}
                height="100%"
                highlightGeometryId={record.geometry_id}
                highlightCoords={[record.geometry.longitude, record.geometry.latitude]}
                initialCenter={[record.geometry.longitude, record.geometry.latitude]}
                initialZoom={17}
                // Without this the popup's "View Full Details" button is inert and
                // the page keeps showing the record you arrived with.
                onPointSelect={onPointSelect}
              />
            </div>
          </aside>
        )}

        <div className={`w-full min-w-0 space-y-4 lg:h-full lg:overflow-y-auto ${record.geometry ? 'lg:w-1/2' : ''}`}>
          {detailSections.map((section) => (
            <div key={section.title} className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                {section.title}
                {section.component === 'arus' && arusReadings.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {record.arus_count ?? arusReadings.length} reading
                    {(record.arus_count ?? arusReadings.length) === 1 ? '' : 's'}
                    {record.arus_leaking_count ? ` · ${record.arus_leaking_count} leaking` : ''}
                  </span>
                )}
              </h3>
              {section.component === 'arus' ? (
                arusReadings.length === 0 ? (
                  <p className="text-sm text-gray-300">No readings recorded on this pole.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {arusReadings.map((r, idx) => {
                      const shots = Object.entries(arusPhotos[r.id] || {})
                      return (
                        <li key={r.id} className="py-2 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-5">{idx + 1}</span>
                            <span className="flex-1 text-gray-900">
                              {r.reading || <span className="text-gray-300">— no reading —</span>}
                            </span>
                            {yesNoBadge(Boolean(r.leakage_current))}
                            <span className="text-xs text-gray-400 w-16 text-right">
                              {shots.length || r.photo_count || 0} photo
                              {(shots.length || r.photo_count) === 1 ? '' : 's'}
                            </span>
                          </div>
                          {shots.length > 0 && (
                            <div className="flex gap-2 mt-2 pl-8">
                              {shots.map(([code, img]) => (
                                <img
                                  key={code}
                                  src={imageUrl(img.url)}
                                  alt={code}
                                  title={code}
                                  loading="lazy"
                                  onClick={() => setArusViewer({
                                    url: imageUrl(img.url),
                                    label: `${code} — reading ${idx + 1}`,
                                  })}
                                  className="w-20 h-16 object-cover rounded border border-gray-200 cursor-zoom-in"
                                />
                              ))}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {section.title === 'Span (From / To)' && span?.measurable && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Span Length</p>
                    {/* Computed from the two ends, never stored — either can be
                        repositioned, and a saved length would quietly go stale. */}
                    <div className="text-sm text-gray-900">{span.span_m} m</div>
                  </div>
                )}
                {/* Image slots are not record columns — they render below. */}
                {(section.fields || [])
                  .filter((f) => f.type !== 'image' && !f.hidden && (!f.showWhen || Boolean(record[f.showWhen])))
                  .map((field) => (
                  <div key={field.name} className={field.wide ? 'sm:col-span-2' : undefined}>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">{field.label}</p>
                    <div className="text-sm text-gray-900">{renderValue(field, record[field.name])}</div>
                  </div>
                ))}
              </div>
              )}
            </div>
          ))}

          {/* Metadata */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              Metadata
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Created By</p>
                <p className="text-sm text-gray-900">{creatorName || '—'}</p>
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

          {/* Uploaded images. `image_type` is the code that matches an image
              field in the survey config, so prefer that field's label. */}
          {images.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                  Uploaded Images ({images.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative group cursor-pointer"
                      onClick={() => setLightboxIndex(idx)}
                    >
                      <img
                        src={imageUrl(img.image_url)}
                        alt={captionFor(img)}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg">
                        {captionFor(img)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
          )}
        </div>
      </div>

      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />

      {/* Reading photos are not part of the pole's gallery above. */}
      <ImageLightbox
        images={arusViewer ? [arusViewer] : []}
        index={arusViewer ? 0 : null}
        onIndexChange={() => {}}
        onClose={() => setArusViewer(null)}
      />
    </div>
  )
}

