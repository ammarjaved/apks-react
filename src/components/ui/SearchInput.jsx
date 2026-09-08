import { useState, useEffect, useRef } from 'react'

/**
 * Reusable free-text search input with search icon, clear button, and debounce.
 *
 * Props:
 *   value       - controlled value (string)
 *   onChange     - called with the new value (string)
 *   onSearch     - called with debounced value (string); fires ~350ms after typing stops
 *   placeholder  - input placeholder text
 *   debounce     - debounce delay in ms (default 350)
 */
export default function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = 'Search…',
  debounce = 350,
  className = '',
}) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!onSearch) return
    const t = setTimeout(() => onSearch(value || ''), debounce)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounce])

  return (
    <div
      className={`relative flex items-center transition-all duration-150 ${
        focused ? 'ring-2 ring-primary-500 ring-opacity-60' : ''
      } ${className}`}
    >
      <span className="absolute left-3 pointer-events-none text-gray-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
        </svg>
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-primary-500 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="absolute right-2.5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
