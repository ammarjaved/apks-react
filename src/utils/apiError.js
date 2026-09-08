/**
 * Turn an axios error into a string safe to render.
 *
 * FastAPI returns 422 validation failures as `detail: [{loc, msg, type, …}]`.
 * Rendering that array directly crashes React ("Objects are not valid as a
 * React child"), so flatten it into `field: message` pairs.
 */
export function errorMessage(err, fallback = 'Something went wrong.') {
  const detail = err?.response?.data?.detail

  if (Array.isArray(detail)) {
    const parts = detail.map((e) => {
      if (typeof e === 'string') return e
      const field = Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : null
      return field ? `${field}: ${e?.msg || 'invalid'}` : e?.msg || 'invalid'
    })
    return parts.join('; ') || fallback
  }

  if (typeof detail === 'string') return detail
  if (detail && typeof detail.msg === 'string') return detail.msg
  if (typeof err?.message === 'string' && err.message) return err.message

  return fallback
}
