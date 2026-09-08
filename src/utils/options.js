/**
 * Matching stored values against a field's `options` list.
 *
 * Several Yes/No columns are varchars rather than booleans
 * (`grass_status`, `tree_branches_status`, `advertise_poster_status`). The
 * mobile app writes `"1"`/`"0"`; web submissions made before the configs were
 * aligned wrote `"Yes"`/`"No"`. Both spellings are in the database, so anything
 * rendering or editing one of these fields has to accept either.
 */

const EQUIVALENT = {
  '1': ['1', 'yes', 'y', 'true', 't'],
  '0': ['0', 'no', 'n', 'false', 'f'],
}

/** The option whose value matches `value`, exactly or by equivalent spelling. */
export function matchOption(options = [], value) {
  if (value === null || value === undefined || value === '') return null
  const stored = String(value).trim().toLowerCase()

  const exact = options.find((opt) => String(opt.value).trim().toLowerCase() === stored)
  if (exact) return exact

  return (
    options.find((opt) => (EQUIVALENT[String(opt.value)] || []).includes(stored)) || null
  )
}

/**
 * The label to display for a stored value. Falls back to the raw value so an
 * unexpected entry is shown rather than silently blanked.
 */
export function optionLabel(options, value) {
  return matchOption(options, value)?.label ?? String(value)
}

/**
 * The canonical option value for a stored value, for use as a `<select>`'s
 * `value`. Without this a legacy `"Yes"` would match no `<option>`, the select
 * would render as unset, and saving the form would quietly drop the answer.
 */
export function normalizeOptionValue(options, value) {
  const match = matchOption(options, value)
  if (match) return String(match.value)
  return value === null || value === undefined ? '' : String(value)
}
