/**
 * Convert relative image paths from the backend to full URLs.
 *
 * Handles:
 * - "app/static/images/..." → "/static/images/..." (proxied to FastAPI)
 * - "assets/images/..." → "http://121.121.232.53:89/assets/images/..." (old image server)
 * - "http://..." / "https://..." → returned as-is
 */
const OLD_IMG_SERVER = 'http://121.121.232.53:89/'

export function imageUrl(path) {
  if (!path || typeof path !== 'string') return null

  // Already a full URL
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }

  // Backend static files: "app/static/..." → "/static/..."
  if (path.startsWith('app/static/') || path.startsWith('/app/static/')) {
    return '/' + path.replace(/^\/?app\//, '')
  }

  // Old image server: "assets/images/..."
  if (path.startsWith('assets/')) {
    return OLD_IMG_SERVER + path
  }

  // Fallback: return as-is
  return path
}
