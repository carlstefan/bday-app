import { useEffect, useRef, useState } from 'react'
import { PhotoImage }    from './PhotoImage.jsx'
import { CaptionEditor } from './CaptionEditor.jsx'
import { ActionMenu }    from './ActionMenu.jsx'
import { ReportButton }  from './ReportButton.jsx'
import { useViewport }   from '../../hooks/useViewport.js'
import { useAuth }       from '../../context/AuthContext.jsx'
import styles from './SushiBar.module.css'

/** How many photos to show at each breakpoint (always odd). */
function visibleCount(width) {
  if (width >= 1280) return 7
  if (width >= 768)  return 5
  return 3
}

const GAP            = 10   // px gap between slots — keep in sync with .strip gap in CSS
const TRANSITION_MS  = 280
const DRAG_THRESHOLD = 55   // px drag to trigger navigation

/** Visual scale + opacity based on distance from centre. */
function distStyle(dist) {
  const scale   = [1.0, 0.80, 0.66, 0.56][Math.min(dist, 3)]
  const opacity = [1.0, 0.82, 0.66, 0.52][Math.min(dist, 3)]
  return { transform: `scale(${scale})`, opacity, zIndex: dist === 0 ? 2 : 1 }
}

export function SushiBar({ photos, currentIndex, onNavigate, onOpenFullScreen, onPhotoUpdate, onPhotoFlagged }) {
  const { width } = useViewport()
  const { user }  = useAuth()

  const count    = visibleCount(width)
  const flanking = Math.floor(count / 2)

  // ── Container width (measured, kept in state for correct SSR/resize) ────
  const containerRef   = useRef(null)
  const [cw, setCw]    = useState(0)   // container width in px

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setCw(el.offsetWidth)
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Derived geometry
  const slotWidth  = cw ? cw / count : 0
  const slotStep   = slotWidth + GAP
  // Neutral strip translateX so the centre slot is centred in the container:
  //   neutralX = -(slotWidth + (flanking+1) * GAP)
  const neutralX   = slotWidth ? -(slotWidth + (flanking + 1) * GAP) : 0

  // ── Animation / drag state ───────────────────────────────────────────────
  // displayIndex: the photo shown as centre right now (may lag currentIndex during slide)
  const [displayIndex, setDisplayIndex] = useState(currentIndex)
  // stripOffset: extra px on top of neutralX (drag or animation target)
  const [stripOffset, setStripOffset]   = useState(0)
  // transitioning: CSS transition is active on the strip
  const [transitioning, setTransitioning] = useState(false)

  // FR-G10: track whether caption editor is open for the centre photo
  const [editingCaption, setEditingCaption] = useState(false)

  const animatingRef        = useRef(false)
  const pendingIndexRef     = useRef(null)
  const prevCurrentIndexRef = useRef(currentIndex)

  // Keep refs up-to-date for use inside callbacks without stale closures
  const slotStepRef     = useRef(slotStep)
  const displayIndexRef = useRef(displayIndex)
  slotStepRef.current   = slotStep
  displayIndexRef.current = displayIndex

  // ── Core animation ───────────────────────────────────────────────────────
  function startSlide(newIndex, fromOffset = 0) {
    if (animatingRef.current) return
    const step = slotStepRef.current
    if (!step) { setDisplayIndex(newIndex); return }

    const dir = newIndex > displayIndexRef.current ? -1 : 1  // -1 = slide left (next)
    animatingRef.current  = true
    pendingIndexRef.current = newIndex
    setTransitioning(true)
    setStripOffset(fromOffset + dir * step)
  }

  function onStripTransitionEnd(e) {
    // Only handle the strip's own transition, not children's scale/opacity transitions
    if (e.target !== e.currentTarget) return

    const newIndex = pendingIndexRef.current

    if (newIndex === null) {
      // Snap-back after drag that didn't reach threshold
      setTransitioning(false)
      return
    }

    animatingRef.current    = false
    pendingIndexRef.current = null

    // Batch update: disable transition + reset offset + advance displayIndex.
    // React 18 batches these into one render → the strip jumps to neutral
    // position with the new photo set, without any visible transition.
    setTransitioning(false)
    setStripOffset(0)
    setDisplayIndex(newIndex)
  }

  // ── Sync with parent's currentIndex ──────────────────────────────────────
  useEffect(() => {
    if (currentIndex === prevCurrentIndexRef.current) return
    prevCurrentIndexRef.current = currentIndex
    if (!animatingRef.current) startSlide(currentIndex)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  // Reset caption editing when the displayed photo changes
  useEffect(() => {
    setEditingCaption(false)
  }, [displayIndex])

  // ── Scroll wheel ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let lastAt = 0
    function onWheel(e) {
      e.preventDefault()
      if (Date.now() - lastAt < 350 || animatingRef.current) return
      lastAt = Date.now()
      if (e.deltaY > 0 || e.deltaX > 0) onNavigate(Math.min(photos.length - 1, currentIndex + 1))
      else                               onNavigate(Math.max(0, currentIndex - 1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [currentIndex, photos.length, onNavigate])

  // ── Touch: drag-to-pull ──────────────────────────────────────────────────
  const touchStartXRef = useRef(null)
  const dragLiveRef    = useRef(0)    // current drag px (to read in onTouchEnd without stale state)

  function onTouchStart(e) {
    if (animatingRef.current) return
    touchStartXRef.current = e.touches[0].clientX
    dragLiveRef.current    = 0
  }

  function onTouchMove(e) {
    if (touchStartXRef.current === null) return
    const step = slotStepRef.current
    const dx   = e.touches[0].clientX - touchStartXRef.current
    const clamped = Math.max(-step * 1.1, Math.min(step * 1.1, dx))
    dragLiveRef.current = clamped
    setStripOffset(clamped)
  }

  function onTouchEnd() {
    if (touchStartXRef.current === null) return
    touchStartXRef.current = null
    const drag = dragLiveRef.current
    dragLiveRef.current = 0
    const di = displayIndexRef.current

    if (drag < -DRAG_THRESHOLD && di < photos.length - 1) {
      startSlide(di + 1, drag)               // continue from drag position → next
    } else if (drag > DRAG_THRESHOLD && di > 0) {
      startSlide(di - 1, drag)               // continue from drag position → prev
    } else {
      // Snap back to centre with a quick transition
      pendingIndexRef.current = null          // signal snap-back (no index change)
      setTransitioning(true)
      setStripOffset(0)
    }
  }

  // ── Build slot list: one extra on each side for smooth slide-in ──────────
  const slots = []
  for (let offset = -(flanking + 1); offset <= flanking + 1; offset++) {
    const idx = displayIndex + offset
    slots.push({ offset, idx: idx >= 0 && idx < photos.length ? idx : null })
  }

  // Strip transform: neutralX + stripOffset (moves together as one unit)
  const stripTranslateX = neutralX + stripOffset

  // CSS transition: active only during animation/snap-back, never during live drag
  const stripTransition = transitioning
    ? `transform ${TRANSITION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
    : 'none'

  return (
    <div
      ref={containerRef}
      className={styles.bar}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Sliding strip ─────────────────────────────────────────────── */}
      <div
        className={styles.strip}
        style={{ transform: `translateX(${stripTranslateX}px)`, transition: stripTransition }}
        onTransitionEnd={onStripTransitionEnd}
      >
        {slots.map(({ offset, idx }) => {
          const dist = Math.abs(offset)

          if (idx === null) {
            return (
              <div
                key={`empty-${offset}`}
                className={styles.slot}
                style={{ width: slotWidth || undefined }}
                aria-hidden
              />
            )
          }

          const photo    = photos[idx]
          const isCenter = offset === 0
          // Always use thumbnail — 1000px is plenty for the sushi bar.
          // Full originals are only loaded in FullScreenView.
          const imgSrc   = 'thumbnail'

          return (
            <div
              key={photo.id}
              className={`${styles.slot} ${isCenter ? styles.center : styles.flanking}`}
              style={{ width: slotWidth || undefined, ...distStyle(dist) }}
              onClick={() => isCenter ? onOpenFullScreen() : onNavigate(idx)}
              role="button"
              tabIndex={isCenter ? 0 : -1}
              aria-label={isCenter ? 'Open full-screen' : `Go to photo by ${photo.uploader_name || 'guest'}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  isCenter ? onOpenFullScreen() : onNavigate(idx)
                }
              }}
            >
              <div className={styles.imgWrap}>
                <PhotoImage photo={photo} src={imgSrc} className={styles.img} />
              </div>

              {isCenter && (
                <div className={styles.info}>
                  {photo.uploader_name && (
                    <span className={styles.name}>{photo.uploader_name}</span>
                  )}

                  {user && photo.user_id === user.id ? (
                    // Own photo: caption editor + action menu
                    <>
                      {editingCaption ? (
                        <CaptionEditor
                          photo={photo}
                          autoEdit
                          onSaved={(id, caption) => {
                            onPhotoUpdate?.(id, { caption })
                            setEditingCaption(false)
                          }}
                          onCancel={() => setEditingCaption(false)}
                        />
                      ) : (
                        photo.caption && <p className={styles.caption}>{photo.caption}</p>
                      )}
                      <div className={styles.actionsWrap}>
                        <ActionMenu
                          photo={photo}
                          onEditCaption={() => setEditingCaption(true)}
                          onFlagged={(id) => onPhotoFlagged?.(id)}
                        />
                      </div>
                    </>
                  ) : (
                    // Others' photo: caption display + report button
                    <>
                      {photo.caption && <p className={styles.caption}>{photo.caption}</p>}
                      {user && (
                        <div className={styles.actionsWrap}>
                          <ReportButton photo={photo} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Nav arrows (desktop) ──────────────────────────────────────── */}
      {currentIndex > 0 && (
        <button
          className={`${styles.arrow} ${styles.arrowLeft}`}
          onClick={() => onNavigate(currentIndex - 1)}
          aria-label="Previous photo"
        >‹</button>
      )}
      {currentIndex < photos.length - 1 && (
        <button
          className={`${styles.arrow} ${styles.arrowRight}`}
          onClick={() => onNavigate(currentIndex + 1)}
          aria-label="Next photo"
        >›</button>
      )}

      {/* ── Counter ───────────────────────────────────────────────────── */}
      <div className={styles.counter}>{currentIndex + 1} / {photos.length}</div>
    </div>
  )
}
