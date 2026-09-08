/**
 * Convert relative image paths from the backend to full URLs.
 *
 * Handles:
 * - "app/static/images/..." → "<API_ORIGIN>/static/images/..." (served by FastAPI)
 * - "assets/images/..." → old image server
 * - "http://..." / "https://..." → returned as-is
 */

// Derive the API server origin from VITE_API_URL so images load from the same
// server as the API. e.g. "http://121.121.232.53:5000/api/v1" → "http://121.121.232.53:5000"
// Falls back to "" (relative) in dev where VITE_API_URL is "/api/v1".
const API_ORIGIN = (() => {
  const u = import.meta.env.VITE_API_URL || ''
  try {
    return u && /^https?:\/\//.test(u) ? new URL(u).origin : ''
  } catch {
    return ''
  }
})()

const OLD_IMG_SERVER = 'http://121.121.232.53:89/'

export function imageUrl(path) {
  if (!path || typeof path !== 'string') return null

  // Already a full URL
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }

  // Backend static files: "app/static/..." → "<origin>/static/..."
  if (path.startsWith('app/static/') || path.startsWith('/app/static/')) {
    return API_ORIGIN + '/' + path.replace(/^\/?app\//, '')
  }
  if (path.startsWith('/static/') || path.startsWith('static/')) {
    const clean = path.startsWith('/') ? path : '/' + path
    return API_ORIGIN + clean
  }

  // Old image server: "assets/images/..."
  if (path.startsWith('assets/')) {
    return OLD_IMG_SERVER + path
  }

  // Fallback: return as-is
  return path
}
