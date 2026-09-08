import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 8
const ZOOM_STEP = 1.4

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * Full-screen image viewer with previous / next navigation and zoom.
 * `images` is `[{ url, label }]`; `index` is the currently shown item, or null.
 *
 * Zoom comes from the wheel, a pinch, the +/- buttons or a double click;
 * while zoomed the image can be dragged to pan.
 */
export default function ImageLightbox({ images = [], index, onIndexChange, onClose }) {
  const total = images.length
  const current = index != null ? images[index] : null
  const hasMany = total > 1

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const viewportRef = useRef(null)
  const dragRef = useRef(null)   // { startX, startY, originX, originY, moved }
  const pinchRef = useRef(null)  // { dist, scale }
  const justPannedRef = useRef(false)

  const isZoomed = scale > 1

  const resetView = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const go = (delta) => {
    if (!hasMany || index == null) return
    onIndexChange((index + delta + total) % total)
  }

  // A newly shown image always starts un-zoomed.
  useEffect(() => { resetView() }, [index, resetView])

  /**
   * Zoom towards a point in viewport coordinates so whatever sits under the
   * cursor stays under it. Defaults to the centre of the viewport.
   */
  const zoomTo = useCallback((nextScale, px, py) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    setScale((prev) => {
      const next = clamp(nextScale, MIN_SCALE, MAX_SCALE)
      if (next === prev) return prev
      setOffset((o) => {
        if (next === MIN_SCALE) return { x: 0, y: 0 }
        if (!rect) return o
        const cx = (px ?? rect.left + rect.width / 2) - rect.left - rect.width / 2
        const cy = (py ?? rect.top + rect.height / 2) - rect.top - rect.height / 2
        const ratio = next / prev
        return { x: cx - (cx - o.x) * ratio, y: cy - (cy - o.y) * ratio }
      })
      return next
    })
  }, [])

  useEffect(() => {
    if (index == null) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (isZoomed) resetView()
        else onClose()
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(scale * ZOOM_STEP) }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(scale / ZOOM_STEP) }
      if (e.key === '0') { e.preventDefault(); resetView() }
      // While zoomed the arrows pan instead of stepping through the images.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowLeft' ? -1 : 1
        if (isZoomed) {
          e.preventDefault()
          setOffset((o) => ({ ...o, x: o.x - dir * 60 }))
        } else if (total > 1) {
          e.preventDefault()
          onIndexChange((index + dir + total) % total)
        }
      }
      if (isZoomed && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        setOffset((o) => ({ ...o, y: o.y + (e.key === 'ArrowUp' ? 60 : -60) }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, total, onClose, onIndexChange, isZoomed, scale, zoomTo, resetView])

  // Non-passive so the wheel zooms instead of scrolling the page behind.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      zoomTo(scale * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scale, zoomTo])

  const onPointerDown = (e) => {
    if (!isZoomed || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y, moved: false }
    setDragging(true)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
    setOffset({ x: d.originX + dx, y: d.originY + dy })
  }

  const endDrag = (e) => {
    if (!dragRef.current) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    // Kept until the click event has fired so a pan doesn't close the viewer.
    const moved = dragRef.current.moved
    dragRef.current = null
    setDragging(false)
    if (moved) {
      justPannedRef.current = true
      setTimeout(() => { justPannedRef.current = false }, 0)
    }
  }

  const touchDistance = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDistance(e.touches), scale }
      dragRef.current = null
      setDragging(false)
    }
  }

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const { dist, scale: startScale } = pinchRef.current
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      zoomTo(startScale * (touchDistance(e.touches) / dist), midX, midY)
    }
  }

  const onTouchEnd = (e) => {
    if (e.touches.length < 2) pinchRef.current = null
  }

  const onDoubleClick = (e) => {
    e.stopPropagation()
    if (isZoomed) resetView()
    else zoomTo(2.5, e.clientX, e.clientY)
  }

  // A pan whose pointer ended over the backdrop shouldn't close the viewer.
  const onBackdropClick = () => {
    if (justPannedRef.current) return
    onClose()
  }

  if (index == null || !current) return null

  const zoomBtn = 'w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center disabled:opacity-30 disabled:hover:bg-white/15'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onBackdropClick}
    >
      <button
        type="button"
        className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10"
        aria-label="Close"
        onClick={(e) => { e.stopPropagation(); onClose() }}
      >
        &times;
      </button>

      <div className="absolute top-4 left-4 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={zoomBtn}
          aria-label="Zoom out"
          disabled={scale <= MIN_SCALE}
          onClick={() => zoomTo(scale / ZOOM_STEP)}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          className={zoomBtn}
          aria-label="Zoom in"
          disabled={scale >= MAX_SCALE}
          onClick={() => zoomTo(scale * ZOOM_STEP)}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          className="px-3 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white text-xs font-medium disabled:opacity-30 disabled:hover:bg-white/15"
          aria-label="Reset zoom"
          disabled={!isZoomed}
          onClick={resetView}
        >
          {Math.round(scale * 100)}%
        </button>
      </div>

      {hasMany && (
        <button
          type="button"
          className="absolute left-3 sm:left-6 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center"
          aria-label="Previous image"
          onClick={(e) => { e.stopPropagation(); go(-1) }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {hasMany && (
        <button
          type="button"
          className="absolute right-3 sm:right-6 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center"
          aria-label="Next image"
          onClick={(e) => { e.stopPropagation(); go(1) }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div className="relative max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
        <div
          ref={viewportRef}
          className="overflow-hidden rounded-lg touch-none select-none"
          style={{ cursor: isZoomed ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onDoubleClick={onDoubleClick}
        >
          <img
            src={current.url}
            alt={current.label || 'Image'}
            draggable={false}
            className="max-w-full max-h-[80vh] object-contain shadow-2xl"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragging || pinchRef.current ? 'none' : 'transform 120ms ease-out',
            }}
            onError={(e) => { e.target.src = ''; e.target.alt = 'Image not available' }}
          />
        </div>
        <p className="text-center text-white text-sm mt-3">
          {current.label}
          {hasMany && (
            <span className="text-white/70 ml-2">
              {index + 1} / {total}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
