import { useEffect, useRef, useState } from 'react'

/**
 * Compact multi-select: a button that opens a checklist. Used for filters
 * where several values apply at once (e.g. defects).
 *
 * Props:
 *   options   - [{ value, label, group? }] — `group` is shown as a caption
 *   value     - array of selected values
 *   onChange  - called with the new array
 *   placeholder - button text when nothing is selected
 */
export default function MultiSelect({ options, value = [], onChange, placeholder = 'Any', className = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = new Set(value)
  const toggle = (v) => {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value))
  }

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? options.filter((o) => `${o.group || ''} ${o.label}`.toLowerCase().includes(needle))
    : options

  // Caption each run of options that share a group.
  let lastGroup = null

  const summary = selected.size === 0
    ? placeholder
    : selected.size === 1
      ? (options.find((o) => o.value === value[0])?.label || '1 selected')
      : `${selected.size} selected`

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-sm text-gray-800 max-w-[12rem]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate ${selected.size ? 'font-medium' : 'text-gray-500'}`}>{summary}</span>
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 left-0 w-72 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-primary-500"
            />
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-gray-500 hover:text-gray-800 whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-400">No matches</li>
            )}
            {visible.map((o) => {
              const showGroup = o.group && o.group !== lastGroup
              lastGroup = o.group || lastGroup
              return (
                <li key={o.value} role="option" aria-selected={selected.has(o.value)}>
                  {showGroup && (
                    <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{o.group}</p>
                  )}
                  <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(o.value)}
                      onChange={() => toggle(o.value)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{o.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
