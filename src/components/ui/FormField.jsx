import { useState, useEffect, useMemo } from 'react'
import { imageUrl } from '../../utils/imageUrl'
import ImageLightbox from './ImageLightbox'
import { normalizeOptionValue } from '../../utils/options'
import { surveyApi, assetLinkApi } from '../../api/surveys'

/**
 * Dynamic form field renderer.
 * Supports: text, textarea, number, date, time, select, radio, checkbox,
 * number-list, defect-group, span-group, image, savr-select, asset-select
 */

export default function FormField({ field, value, onChange, error, disabled, onImageView, imageDrag, context }) {
  const renderField = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <div>
            <textarea
              value={value || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
              disabled={disabled}
              rows={3}
              maxLength={field.maxLength || undefined}
              className="input"
            />
            {field.maxLength && (
              <p className="text-[11px] text-gray-400 text-right mt-0.5">
                {(value || '').length}/{field.maxLength}
              </p>
            )}
          </div>
        )

      case 'number-list':
        return <NumberListField field={field} value={value} onChange={onChange} disabled={disabled} />

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(field.name, e.target.value === '' ? null : Number(e.target.value))}
            disabled={disabled}
            className="input"
          />
        )

      case 'date':
        return (
          <input
            type="date"
            value={value ? value.split('T')[0] : ''}
            onChange={(e) => onChange(field.name, e.target.value || null)}
            disabled={disabled}
            className="input"
          />
        )

      case 'time':
        return (
          <input
            type="time"
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value || null)}
            disabled={disabled}
            className="input"
          />
        )

      case 'select':
        return (
          <select
            // Normalised so a value stored under an equivalent spelling (a
            // legacy "Yes" against a "1" option) still selects its option
            // instead of rendering as unset and being dropped on save.
            value={normalizeOptionValue(field.options, value)}
            onChange={(e) => onChange(field.name, e.target.value || null)}
            disabled={disabled}
            className="input"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )

      case 'radio': {
        // Drawn as checkboxes but answered like a radio: at most one option at a
        // time, and clicking the ticked one clears it. A true radio group cannot
        // be unticked, and these questions are optional — a surveyor who picks
        // the wrong pole size has to be able to take it back.
        //
        // The stored value is normalised the same way `select` does it: a value
        // saved as "Spun" or 9.0 must still tick the `spun` / "9" box instead of
        // leaving the group blank on edit.
        const selected = normalizeOptionValue(field.options, value)
        return (
          <div className="flex flex-wrap gap-3">
            {field.options?.map((opt) => {
              const isChecked = selected === String(opt.value)
              return (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name={`${field.name}_${opt.value}`}
                    checked={isChecked}
                    onChange={() => onChange(field.name, isChecked ? null : String(opt.value))}
                    disabled={disabled}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              )
            })}
          </div>
        )
      }

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(field.name, e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Yes</span>
          </label>
        )

      case 'defect-group':
        return <DefectGroupField field={field} value={value} onChange={onChange} disabled={disabled} />

      case 'span-group':
        return <SpanGroupField field={field} value={value} onChange={onChange} disabled={disabled} />

      case 'image':
        return <ImageField field={field} value={value} onChange={onChange} disabled={disabled} onView={onImageView} imageDrag={imageDrag} />

      case 'savr-select':
        return (
          <SavrSelectField
            field={field}
            value={value}
            onChange={onChange}
            disabled={disabled}
            context={context}
          />
        )

      case 'asset-select':
        return (
          <AssetSelectField
            field={field}
            value={value}
            onChange={onChange}
            disabled={disabled}
            context={context}
          />
        )

      case 'json':
        return <JsonField value={value} onChange={(v) => onChange(field.name, v)} disabled={disabled} />

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            disabled={disabled}
            className="input"
          />
        )
    }
  }

  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {renderField()}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Defect Group: checkboxes with optional "other" text ──────────────
function DefectGroupField({ field, value, onChange, disabled }) {
  const current = value || {}
  const checkboxes = field.checkboxes || []
  const radioKeys = field.radioKeys || []

  const handleChange = (key, checked) => {
    onChange(field.name, { ...current, [key]: checked })
  }

  const handleOtherValue = (val) => {
    onChange(field.name, { ...current, other_value: val })
  }

  return (
    <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
      {checkboxes.map((cb) => {
        const cbKey = typeof cb === 'object' ? cb.key : cb
        const cbLabel = typeof cb === 'object' ? cb.label : cb.replace(/_/g, ' ')
        const isRadio = radioKeys.includes(cbKey)
        return (
          <div key={cbKey}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type={isRadio ? 'radio' : 'checkbox'}
                name={isRadio ? `${field.name}_radio` : `${field.name}_${cbKey}`}
                checked={!!current[cbKey]}
                onChange={(e) => handleChange(cbKey, e.target.checked)}
                disabled={disabled}
                className={isRadio ? 'border-gray-300 text-primary-600 focus:ring-primary-500' : 'rounded border-gray-300 text-primary-600 focus:ring-primary-500'}
              />
              <span className="text-sm text-gray-700">{cbLabel}</span>
            </label>
            {cbKey === 'other' && current.other && (
              <input
                type="text"
                value={current.other_value || ''}
                onChange={(e) => handleOtherValue(e.target.value)}
                disabled={disabled}
                className="input mt-1.5 ml-6 text-sm"
                placeholder="Please specify"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Span Group: one count per sub-field + number input for "other" ────
/**
 * The stored JSON key for a conductor size: the record's own spelling when it
 * already has one (the mobile app writes `3x185`, the web form `s3_185`), else
 * the config key. Writing back to the key in use keeps the record readable by
 * whichever app created it.
 */
export function spanStorageKey(current, sub) {
  for (const k of [sub.key, ...(sub.aliases || [])]) {
    if (current[k] !== undefined && current[k] !== null && current[k] !== '') return k
  }
  return sub.key
}

function SpanGroupField({ field, value, onChange, disabled }) {
  const current = value || {}

  const handleChange = (storeKey, val) => {
    const next = { ...current, [storeKey]: val }
    if (val === null) {
      // Unticked: drop the size from the JSON entirely, and the "other" count
      // with it, so the record does not keep a stale value behind a blank box.
      delete next[storeKey]
      delete next[`${storeKey}_other`]
    }
    onChange(field.name, next)
  }

  const handleOtherValue = (storeKey, val) => {
    onChange(field.name, { ...current, [`${storeKey}_other`]: val })
  }

  return (
    <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
      {field.subFields?.map((sub) => {
        const storeKey = spanStorageKey(current, sub)
        // Values arrive as '1' from both apps, but tolerate a number.
        const selected = current[storeKey] == null ? '' : String(current[storeKey])
        return (
          <div key={sub.key} className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 min-w-[100px]">{sub.label}</span>
            {/* Drawn as checkboxes but answered like a radio: one count per
                conductor size, and clicking the ticked box clears it so a
                miscounted span can be taken back. Clearing drops the key from
                the JSON rather than storing an empty string. */}
            <div className="flex gap-1.5">
              {['1', '2', '3', '4', '5', '6', 'other'].map((opt) => {
                const isChecked = selected === opt
                return (
                  <label key={opt} className="cursor-pointer">
                    <input
                      type="checkbox"
                      name={`${field.name}_${sub.key}_${opt}`}
                      checked={isChecked}
                      onChange={() => handleChange(storeKey, isChecked ? null : opt)}
                      disabled={disabled}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs text-gray-500 ml-0.5">{opt === 'other' ? 'Other' : opt}</span>
                  </label>
                )
              })}
            </div>
            {selected === 'other' && (
              <input
                type="number"
                value={current[`${storeKey}_other`] || ''}
                onChange={(e) => handleOtherValue(storeKey, e.target.value)}
                disabled={disabled}
                className="input text-sm w-20 py-1"
                placeholder="value"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Image Upload Field ────────────────────────────────────────────────
/**
 * An image slot holds one of:
 *   - a `File` the user just picked (preview from an object URL)
 *   - `{ id, url }` for an image already stored against the record
 *   - a bare URL string (legacy)
 */
function ImageField({ field, value, onChange, disabled, onView, imageDrag }) {
  const isFile = value instanceof File
  const existingUrl = !isFile && (typeof value === 'string' ? value : value?.url) || null
  const previewSrc = isFile ? value.preview : existingUrl ? imageUrl(existingUrl) : null
  // The thumbnail is too small to judge a defect by, so it opens a viewer.
  // The form supplies `onView` to show the photo in its side panel; without one
  // (any other host of this field) the field falls back to its own lightbox.
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [dropOver, setDropOver] = useState(false)

  const occupied = Boolean(previewSrc)
  const draggingFrom = imageDrag?.from
  const draggingHere = draggingFrom === field.name
  const canAcceptDrop = Boolean(
    imageDrag?.onMove && draggingFrom && !draggingHere && !occupied && !disabled
  )
  const rejectDrop = Boolean(
    imageDrag?.onMove && draggingFrom && !draggingHere && occupied && !disabled
  )

  const handleDragStart = (e) => {
    if (disabled || !previewSrc || !imageDrag?.onMove) return
    e.dataTransfer.setData('application/x-apks-image-slot', field.name)
    e.dataTransfer.effectAllowed = 'move'
    imageDrag.onStart?.(field.name)
  }

  const handleDragEnd = () => {
    setDropOver(false)
    imageDrag?.onEnd?.()
  }

  const handleDragOver = (e) => {
    if (!draggingFrom || draggingHere || disabled) return
    e.preventDefault()
    e.dataTransfer.dropEffect = canAcceptDrop ? 'move' : 'none'
    setDropOver(true)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDropOver(false)
    const from = e.dataTransfer.getData('application/x-apks-image-slot') || draggingFrom
    imageDrag?.onEnd?.()
    if (!from || from === field.name || occupied || disabled) return
    imageDrag.onMove(from, field.name)
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg transition-colors ${
        dropOver && canAcceptDrop ? 'ring-2 ring-primary-500 bg-primary-50/70 p-1 -m-1' : ''
      } ${dropOver && rejectDrop ? 'ring-2 ring-red-400 bg-red-50/70 p-1 -m-1' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(false)
      }}
      onDrop={handleDrop}
    >
      {previewSrc && (
        <button
          type="button"
          draggable={!disabled && Boolean(imageDrag?.onMove)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="relative group w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 cursor-grab active:cursor-grabbing"
          aria-label={`View ${field.label}`}
          onClick={() => (onView ? onView(field.name) : setLightboxIndex(0))}
        >
          <img src={previewSrc} alt={field.label} className="w-full h-full object-cover pointer-events-none" />
          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 8v6M8 11h6M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </span>
        </button>
      )}
      {!previewSrc && (
        <div
          className={`w-16 h-16 flex-shrink-0 rounded-lg border-2 border-dashed flex items-center justify-center ${
            dropOver && canAcceptDrop ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-gray-50'
          }`}
          aria-hidden
        >
          <span className="text-[10px] text-gray-400 px-1 text-center leading-tight">
            {dropOver && canAcceptDrop ? 'Drop here' : 'Empty'}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              file.preview = URL.createObjectURL(file)
              onChange(field.name, file)
            }
          }}
          className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
        />
        {isFile && <p className="text-xs text-primary-600 mt-1 truncate">New: {value.name}</p>}
        {!isFile && existingUrl && (
          <p className="text-xs text-gray-400 mt-1 truncate">Current: {existingUrl.split('/').pop()}</p>
        )}
        {previewSrc && imageDrag?.onMove && !disabled && (
          <p className="text-xs text-gray-400 mt-1">Drag onto an empty slot to reassign</p>
        )}
        {dropOver && rejectDrop && (
          <p className="text-xs text-red-500 mt-1">Slot already has a photo</p>
        )}
      </div>

      {previewSrc && !onView && (
        <ImageLightbox
          images={[{ url: previewSrc, label: field.label }]}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

// ─── JSON Field ────────────────────────────────────────────────────────
function JsonField({ value, onChange, disabled }) {
  const isObject = value && typeof value === 'object' && !Array.isArray(value)

  const handleKeyChange = (oldKey, newKey) => {
    const newObj = { ...(value || {}) }
    const val = newObj[oldKey]
    delete newObj[oldKey]
    newObj[newKey] = val
    onChange(newObj)
  }

  const handleValueChange = (key, val) => {
    onChange({ ...(value || {}), [key]: val })
  }

  const addRow = () => {
    onChange({ ...(value || {}), '': '' })
  }

  const removeRow = (key) => {
    const newObj = { ...(value || {}) }
    delete newObj[key]
    onChange(Object.keys(newObj).length ? newObj : null)
  }

  if (isObject) {
    return (
      <div className="space-y-1.5">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <input type="text" value={k} onChange={(e) => handleKeyChange(k, e.target.value)} disabled={disabled} className="input flex-1 text-sm" placeholder="key" />
            <input type="text" value={typeof v === 'object' ? JSON.stringify(v) : v ?? ''} onChange={(e) => handleValueChange(k, e.target.value)} disabled={disabled} className="input flex-1 text-sm" placeholder="value" />
            {!disabled && <button type="button" onClick={() => removeRow(k)} className="text-red-400 hover:text-red-600 px-1">✕</button>}
          </div>
        ))}
        {!disabled && <button type="button" onClick={addRow} className="text-xs text-primary-600 hover:text-primary-700">+ Add row</button>}
      </div>
    )
  }

  return (
    <textarea
      value={value ? (typeof value === 'string' ? value : JSON.stringify(value, null, 2)) : ''}
      onChange={(e) => { try { onChange(JSON.parse(e.target.value)) } catch { onChange(e.target.value) } }}
      disabled={disabled}
      rows={3}
      className="input font-mono text-xs"
    />
  )
}

// ─── Number list: comma-separated numbers stored as an array ─────────
// e.g. tbl_savr.feeder_involved, which the API takes as number[] | null.
// The text is kept locally so a half-typed "1234, " is not reparsed away;
// only a fully valid list is sent up, and an empty box sends null.
function formatNumberList(value) {
  if (Array.isArray(value)) return value.join(', ')
  return value == null ? '' : String(value)
}

function NumberListField({ field, value, onChange, disabled }) {
  const [text, setText] = useState(() => formatNumberList(value))
  const [invalid, setInvalid] = useState('')

  // Follow the record when it is (re)loaded, but not while this box is the
  // source of the change.
  useEffect(() => {
    const incoming = formatNumberList(value)
    setText((prev) => {
      const parsed = prev.split(',').map((s) => s.trim()).filter(Boolean).map(Number)
      return parsed.join(', ') === incoming ? prev : incoming
    })
  }, [value])

  const handleChange = (raw) => {
    setText(raw)
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    const bad = parts.find((p) => !Number.isFinite(Number(p)))
    if (bad) {
      setInvalid(`"${bad}" is not a number`)
      return
    }
    setInvalid('')
    onChange(field.name, parts.length ? parts.map(Number) : null)
  }

  return (
    <div>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder={field.placeholder || 'e.g. 1234, 5678'}
        className="input"
      />
      {invalid ? (
        <p className="text-[11px] text-red-600 mt-0.5">{invalid}</p>
      ) : (
        <p className="text-[11px] text-gray-400 mt-0.5">Separate several with commas.</p>
      )}
    </div>
  )
}

// ─── SAVR Select: fetch SAVR records for parent linkage ──────────────
const ASSET_TYPE_LABELS = {
  tbl_savr: 'Pole',
  tbl_link_box: 'Link Box',
  tbl_cable_bridge: 'Cable Bridge',
  tbl_feeder_pillar: 'Feeder Pillar',
}

/**
 * One end of a height-clearance span — the From picker or the To picker.
 *
 * The reference is polymorphic: a span may run between poles, link boxes, cable
 * bridges or feeder pillars, so an id means nothing without the type that says
 * which table it lives in. The API refuses one without the other. This field
 * therefore writes TWO keys: `field.name` (the id) and `field.typeField` (the
 * asset type), from whichever option is chosen.
 *
 * Candidates come from GET /height-clearance/nearby-assets around this record's
 * own pin, nearest first — the surveyor is standing at the span and picks the two
 * things it runs between, so proximity is the only ordering that helps.
 *
 * `context.resolved` carries the ends as the span endpoint resolved them. An asset
 * already chosen can sit outside the search radius, and without it the picker
 * would show a blank for a perfectly valid stored value.
 */
function AssetSelectField({ field, value, onChange, disabled, context }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const { latitude, longitude } = context || {}
  const resolved = context?.resolved?.[field.name] || null

  useEffect(() => {
    if (latitude == null || longitude == null) { setAssets([]); return }
    let cancelled = false
    setLoading(true)
    // `assetType` narrows the endpoint to one table — height clearance is measured
    // pole to pole, so its two pickers ask for poles only.
    assetLinkApi.nearby({ latitude, longitude, assetType: field.assetType })
      .then((items) => { if (!cancelled) setAssets(items) })
      .catch(() => { if (!cancelled) setAssets([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [latitude, longitude, field.assetType])

  // The stored asset first, when the radius did not reach it.
  const options = useMemo(() => {
    const list = [...assets]
    if (value && !list.some((a) => a.id === value)) {
      list.unshift(resolved
        ? { ...resolved, distance_m: null }
        : { id: value, asset_type: context?.typeValues?.[field.typeField], label: null, distance_m: null })
    }
    return list
  }, [assets, value, resolved, context, field.typeField])

  const labelFor = (a) => {
    const name = a.label || a.device_id || (a.id ? a.id.slice(0, 8) : '')
    const type = ASSET_TYPE_LABELS[a.asset_type] || a.asset_type || 'Asset'
    const far = a.distance_m == null ? '' : ` · ${Math.round(a.distance_m)} m`
    // The type is only worth showing when the picker can return more than one.
    return field.assetType ? `${name}${far}` : `${name} — ${type}${far}`
  }

  const handle = (e) => {
    const id = e.target.value || null
    const picked = options.find((a) => a.id === id)
    // id and type together, always — the API rejects one without the other.
    onChange(field.name, id)
    onChange(field.typeField, id ? (picked?.asset_type || null) : null)
  }

  if (latitude == null || longitude == null) {
    return (
      <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-500 border border-gray-200">
        Set the location on the map first — the list is what is near this pin.
      </div>
    )
  }

  return (
    <>
      <select value={value || ''} onChange={handle} disabled={disabled || loading} className="input">
        <option value="">
          {loading
            ? 'Finding nearby poles…'
            : assets.length ? '— Select —' : 'No surveyed poles nearby'}
        </option>
        {options.map((a) => (
          <option key={a.id} value={a.id}>{labelFor(a)}</option>
        ))}
      </select>
      {resolved && resolved.exists === false && (
        <p className="text-xs text-amber-600 mt-1">
          The asset recorded here no longer exists. Pick another end.
        </p>
      )}
    </>
  )
}


/** How many of the closest poles the parent picker offers. */
const NEARBY_SAVR_LIMIT = 10
const NEARBY_SAVR_RADIUS_M = 1000

/**
 * The parent pole picker.
 *
 * Offers the ten nearest poles rather than every pole in the database: a five
 * foot way belongs to the pole it is under, so a list of hundreds sorted by
 * nothing useful is harder to answer from than the handful actually in sight.
 * The record's location is the reference point, so the list appears once the
 * point has been placed on the map. Until then, and if the lookup fails, it
 * falls back to a plain list so the field is never unanswerable.
 */
function SavrSelectField({ field, value, onChange, disabled, context }) {
  const [savrRecords, setSavrRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [byDistance, setByDistance] = useState(false)
  const latitude = context?.latitude
  const longitude = context?.longitude

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    /** Keep a pole already chosen visible even when it is out of range. */
    const withCurrent = async (items) => {
      if (value && !items.some((s) => s.id === value)) {
        try {
          const current = await surveyApi.get('savr', value)
          return [current, ...items]
        } catch { /* the parent pole may have been deleted */ }
      }
      return items
    }

    const load = async () => {
      if (latitude != null && longitude != null) {
        try {
          const items = await assetLinkApi.nearby({
            latitude,
            longitude,
            assetType: 'tbl_savr',
            radiusM: NEARBY_SAVR_RADIUS_M,
            limit: NEARBY_SAVR_LIMIT,
          })
          if (items.length) {
            if (!cancelled) setByDistance(true)
            return withCurrent(items.map((a) => ({
              id: a.id,
              tiang_no: a.label || a.device_id,
              distance_m: a.distance_m,
            })))
          }
        } catch { /* fall through to the full list */ }
      }
      if (!cancelled) setByDistance(false)
      const data = await surveyApi.list('savr', { page: 1, page_size: 500 })
      return withCurrent(data.items || [])
    }

    load()
      .then((items) => { if (!cancelled) setSavrRecords(items) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [value, latitude, longitude])

  const labelFor = (s) => {
    const tiang = s.tiang_no || (s.id ? s.id.substring(0, 8) : '')
    if (s.distance_m != null) return `${tiang} · ${Math.round(s.distance_m)} m`
    return s.fp_road ? `${tiang} — ${s.fp_road}` : tiang
  }

  return (
    <div>
      <select
        value={value || ''}
        onChange={(e) => onChange(field.name, e.target.value || null)}
        disabled={disabled || loading}
        className="input"
      >
        <option value="">{loading ? 'Loading poles…' : '— Select SAVR —'}</option>
        {savrRecords.map((s) => (
          <option key={s.id} value={s.id}>
            {labelFor(s)}
          </option>
        ))}
      </select>
      {!loading && (
        <p className="text-[11px] text-gray-400 mt-0.5">
          {byDistance
            ? `Nearest ${NEARBY_SAVR_LIMIT} poles within ${NEARBY_SAVR_RADIUS_M} m of this point.`
            : latitude == null || longitude == null
              ? 'Set the location on the map to list the nearest poles.'
              : 'No pole within range — showing all poles.'}
        </p>
      )}
    </div>
  )
}
