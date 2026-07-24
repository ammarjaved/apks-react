import { imageUrl } from '../../utils/imageUrl'

/**
 * Dynamic form field renderer.
 * Supports: text, textarea, number, date, time, select, radio, checkbox,
 * defect-group, span-group, image
 */

export default function FormField({ field, value, onChange, error, disabled }) {
  const renderField = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            disabled={disabled}
            rows={3}
            className="input"
          />
        )

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
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value || null)}
            disabled={disabled}
            className="input"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )

      case 'radio':
        return (
          <div className="flex flex-wrap gap-3">
            {field.options?.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={field.name}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  disabled={disabled}
                  className="border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        )

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
        return <ImageField field={field} value={value} onChange={onChange} disabled={disabled} />

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
        const isRadio = radioKeys.includes(cb)
        return (
          <div key={cb}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type={isRadio ? 'radio' : 'checkbox'}
                name={isRadio ? `${field.name}_radio` : `${field.name}_${cb}`}
                checked={!!current[cb]}
                onChange={(e) => handleChange(cb, e.target.checked)}
                disabled={disabled}
                className={isRadio ? 'border-gray-300 text-primary-600 focus:ring-primary-500' : 'rounded border-gray-300 text-primary-600 focus:ring-primary-500'}
              />
              <span className="text-sm text-gray-700 capitalize">{cb.replace(/_/g, ' ')}</span>
            </label>
            {cb === 'other' && current.other && (
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

// ─── Span Group: radio per sub-field + number input for "other" ────────
function SpanGroupField({ field, value, onChange, disabled }) {
  const current = value || {}

  const handleChange = (subKey, val) => {
    onChange(field.name, { ...current, [subKey]: val })
  }

  const handleOtherValue = (subKey, val) => {
    onChange(field.name, { ...current, [`${subKey}_other`]: val })
  }

  return (
    <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
      {field.subFields?.map((sub) => (
        <div key={sub.key} className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-[100px]">{sub.label}</span>
          <div className="flex gap-1.5">
            {['1', '2', '3', '4', '5', '6', 'other'].map((opt) => (
              <label key={opt} className="cursor-pointer">
                <input
                  type="radio"
                  name={`${field.name}_${sub.key}`}
                  value={opt}
                  checked={current[sub.key] === opt}
                  onChange={(e) => handleChange(sub.key, e.target.value)}
                  disabled={disabled}
                  className="border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-gray-500 ml-0.5">{opt === 'other' ? 'Other' : opt}</span>
              </label>
            ))}
          </div>
          {current[sub.key] === 'other' && (
            <input
              type="number"
              value={current[`${sub.key}_other`] || ''}
              onChange={(e) => handleOtherValue(sub.key, e.target.value)}
              disabled={disabled}
              className="input text-sm w-20 py-1"
              placeholder="value"
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Image Upload Field ────────────────────────────────────────────────
function ImageField({ field, value, onChange, disabled }) {
  const isExistingUrl = typeof value === 'string' && value && !value.startsWith('data:')

  return (
    <div className="flex items-center gap-3">
      {(value || isExistingUrl) && (
        <img
          src={typeof value === 'string' ? imageUrl(value) : value?.preview}
          alt={field.label}
          className="w-16 h-16 object-cover rounded-lg border border-gray-200"
        />
      )}
      <div className="flex-1">
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
        {isExistingUrl && <p className="text-xs text-gray-400 mt-1">Current: {value.split('/').pop()}</p>}
      </div>
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
