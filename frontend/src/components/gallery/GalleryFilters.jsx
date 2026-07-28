import { useState, useRef, useEffect, useMemo } from 'react'
import styles from './GalleryFilters.module.css'

/**
 * FR-G16/FR-G17: Uploader filter (multi-select, searchable) + capture-time sort toggle.
 * Follows the same trigger/dropdown/click-outside pattern as ThreeDotMenu.
 */
export function GalleryFilters({ uploaders, selected, onChangeSelected, sortBy, onChangeSortBy, sortDir, onChangeSortDir }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const filteredUploaders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return uploaders
    return uploaders.filter((u) => u.label.toLowerCase().includes(q))
  }, [uploaders, search])

  function toggleUploader(key) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChangeSelected(next)
  }

  const activeCount = selected.size

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={`${styles.trigger} ${activeCount > 0 ? styles.triggerActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Filtrer og sorter"
        aria-expanded={open}
      >
        🔍
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Sorter etter</div>
            <div className={styles.sortRow}>
              <button
                className={`${styles.sortBtn} ${sortBy === 'time' ? styles.sortBtnActive : ''}`}
                onClick={() => onChangeSortBy('time')}
              >
                Opptaksdato
              </button>
              <button
                className={`${styles.sortBtn} ${sortBy === 'user' ? styles.sortBtnActive : ''}`}
                onClick={() => onChangeSortBy('user')}
              >
                Opplaster
              </button>
            </div>
            <div className={styles.sortRow}>
              {sortBy === 'user' ? (
                <>
                  <button
                    className={`${styles.sortBtn} ${sortDir === 'asc' ? styles.sortBtnActive : ''}`}
                    onClick={() => onChangeSortDir('asc')}
                  >
                    A → Å
                  </button>
                  <button
                    className={`${styles.sortBtn} ${sortDir === 'desc' ? styles.sortBtnActive : ''}`}
                    onClick={() => onChangeSortDir('desc')}
                  >
                    Å → A
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`${styles.sortBtn} ${sortDir === 'asc' ? styles.sortBtnActive : ''}`}
                    onClick={() => onChangeSortDir('asc')}
                  >
                    Eldst først
                  </button>
                  <button
                    className={`${styles.sortBtn} ${sortDir === 'desc' ? styles.sortBtnActive : ''}`}
                    onClick={() => onChangeSortDir('desc')}
                  >
                    Nyest først
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Filtrer etter opplaster</div>
            <input
              className={styles.search}
              type="text"
              placeholder="Søk etter navn…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={styles.uploaderList}>
              {filteredUploaders.length === 0 && (
                <div className={styles.noMatch}>Ingen treff.</div>
              )}
              {filteredUploaders.map((u) => (
                <label key={u.key} className={styles.uploaderItem}>
                  <input
                    type="checkbox"
                    checked={selected.has(u.key)}
                    onChange={() => toggleUploader(u.key)}
                  />
                  <span className={styles.uploaderLabel}>{u.label}</span>
                  <span className={styles.uploaderCount}>{u.count}</span>
                </label>
              ))}
            </div>
            {activeCount > 0 && (
              <button className={styles.resetBtn} onClick={() => onChangeSelected(new Set())}>
                Nullstill filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
