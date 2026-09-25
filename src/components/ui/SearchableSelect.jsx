import { useEffect, useRef, useState } from 'react'

/**
 * Compact single-select with a filter box: a button that opens a searchable
 * list. The single-choice sibling of MultiSelect, for filters with too many
 * values to scroll through (e.g. substation names).
 *
 * Props:
 *   options     - [{ value, label }]
 *   value       - the selected value, or '' for none
 *   onChange    - called with the new value ('' when cleared)
 *   placeholder - button text when nothing is selected
 */
export default function SearchableSelect({ options, value = '', onChange, placeholder = 'All', className = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Start each opening with an empty filter.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? options.filter((o) => String(o.label).toLowerCase().includes(needle))
    : options

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (v) => {
    onChange(v)
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, visible.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (visible[active]) choose(visible[active].value)
    }
  }

  const current = options.find((o) => o.value === value)
  const summary = value ? (current?.label || value) : placeholder

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-sm text-gray-800 max-w-[12rem]"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={value ? summary : undefined}
      >
        <span className={`truncate ${value ? 'font-medium' : 'text-gray-500'}`}>{summary}</span>
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
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-primary-500"
            />
            {value && (
              <button
                type="button"
                onClick={() => choose('')}
                className="text-xs text-gray-500 hover:text-gray-800 whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
          <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-400">No matches</li>
            )}
            {visible.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={`px-3 py-1.5 text-sm cursor-pointer ${
                  i === active ? 'bg-gray-100' : ''
                } ${o.value === value ? 'font-medium text-primary-700' : 'text-gray-700'}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
