import { useRef, useCallback } from 'react'

/**
 * Returns touch event handlers that detect swipe direction.
 * Attach the returned handlers to the element you want to listen on.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,   // minimum px to register as a swipe
  maxOrtho  = 80,   // max orthogonal movement before gesture is cancelled
} = {}) {
  const start = useRef(null)

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchEnd = useCallback((e) => {
    if (!start.current) return
    const t   = e.changedTouches[0]
    const dx  = t.clientX - start.current.x
    const dy  = t.clientY - start.current.y
    start.current = null

    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (adx > ady) {
      if (adx >= threshold && ady <= maxOrtho) {
        if (dx < 0) onSwipeLeft?.()
        else        onSwipeRight?.()
      }
    } else {
      if (ady >= threshold && adx <= maxOrtho) {
        if (dy < 0) onSwipeUp?.()
        else        onSwipeDown?.()
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, maxOrtho])

  return { onTouchStart, onTouchEnd }
}
