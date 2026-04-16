import { useRef, useState, useCallback } from 'react'

const MIN_SCALE       = 1
const MAX_SCALE       = 5
const SWIPE_THRESHOLD = 60
const DISMISS_DIST    = 100

/**
 * Full-screen image zoom/pan/swipe hook.
 *
 * Handles:
 *   - Two-finger pinch → zoom
 *   - Single finger drag when scale > 1 → pan
 *   - Single finger swipe when scale === 1 → navigate or dismiss
 *   - Mouse wheel → zoom
 *
 * Returns { transform, reset, handlers } where handlers is an object of
 * React event props to spread onto the element.
 */
export function usePinchZoom({ onPrev, onNext, onDismiss } = {}) {
  // Committed state (survives between gestures)
  const committed = useRef({ scale: 1, x: 0, y: 0 })

  // Live display state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })

  // Per-gesture tracking
  const gesture = useRef({
    pinching:     false,
    initDist:     null,
    initScale:    1,
    dragStart:    null,   // { x, y }
    swipeStart:   null,   // { x, y } — only when scale ≈ 1
  })

  const apply = useCallback((scale, x, y) => {
    committed.current = { scale, x, y }
    setTransform({ scale, x, y })
  }, [])

  const reset = useCallback(() => {
    apply(1, 0, 0)
    gesture.current = { pinching: false, initDist: null, initScale: 1, dragStart: null, swipeStart: null }
  }, [apply])

  // ── touch events ──────────────────────────────────────────────────────────

  const onTouchStart = useCallback((e) => {
    const g = gesture.current
    if (e.touches.length >= 2) {
      g.pinching   = true
      g.dragStart  = null
      g.swipeStart = null
      const t0 = e.touches[0], t1 = e.touches[1]
      g.initDist  = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      g.initScale = committed.current.scale
    } else {
      g.pinching   = false
      g.dragStart  = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      g.swipeStart = committed.current.scale <= 1.05
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : null
    }
  }, [])

  const onTouchMove = useCallback((e) => {
    e.preventDefault()
    const g   = gesture.current
    const com = committed.current

    if (e.touches.length >= 2 && g.initDist) {
      const t0 = e.touches[0], t1 = e.touches[1]
      const dist     = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, g.initScale * (dist / g.initDist)))
      committed.current.scale = newScale
      setTransform({ scale: newScale, x: com.x, y: com.y })
    } else if (e.touches.length === 1 && com.scale > 1.05 && g.dragStart) {
      const dx = e.touches[0].clientX - g.dragStart.x
      const dy = e.touches[0].clientY - g.dragStart.y
      setTransform({ scale: com.scale, x: com.x + dx, y: com.y + dy })
    }
  }, [])

  const onTouchEnd = useCallback((e) => {
    const g   = gesture.current
    const com = committed.current

    if (e.touches.length < 2 && g.pinching) {
      // Pinch ended
      g.pinching  = false
      g.initDist  = null
      // Snap back if nearly unzoomed
      if (com.scale < 1.1) { apply(1, 0, 0) }
      return
    }

    if (e.changedTouches.length >= 1 && !g.pinching) {
      const touch = e.changedTouches[0]

      if (com.scale > 1.05 && g.dragStart) {
        // Commit pan
        const dx = touch.clientX - g.dragStart.x
        const dy = touch.clientY - g.dragStart.y
        apply(com.scale, com.x + dx, com.y + dy)
      } else if (com.scale <= 1.05 && g.swipeStart) {
        // Detect navigation / dismiss swipe
        const dx  = touch.clientX - g.swipeStart.x
        const dy  = touch.clientY - g.swipeStart.y
        const adx = Math.abs(dx)
        const ady = Math.abs(dy)

        if (adx > ady && adx >= SWIPE_THRESHOLD) {
          if (dx < 0) onNext?.()
          else        onPrev?.()
        } else if (ady > adx && dy >= DISMISS_DIST) {
          onDismiss?.()
        }
      }

      g.dragStart  = null
      g.swipeStart = null
    }
  }, [apply, onPrev, onNext, onDismiss])

  // ── mouse wheel ───────────────────────────────────────────────────────────

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const com    = committed.current
    const factor = e.deltaY < 0 ? 1.15 : 0.87
    const next   = Math.max(MIN_SCALE, Math.min(MAX_SCALE, com.scale * factor))
    if (next <= MIN_SCALE) apply(MIN_SCALE, 0, 0)
    else                   apply(next, com.x, com.y)
  }, [apply])

  return {
    transform,
    reset,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    onWheel,  // attached via ref (passive: false) — see FullScreenView
  }
}
