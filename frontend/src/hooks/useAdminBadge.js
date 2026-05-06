import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client.js'

const POLL_INTERVAL_MS = 30_000

/**
 * FR-A04: Polls a pending-count endpoint every 30 s.
 *
 * @param {boolean} enabled    Only polls when true
 * @param {string}  [url]      Defaults to /api/admin/pending-count (legacy)
 */
export function useAdminBadge(enabled, url = '/api/admin/pending-count') {
  const [pendingCount, setPendingCount] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!enabled || !url) {
      setPendingCount(0)
      return
    }

    const fetchCount = async () => {
      try {
        const data = await api.get(url)
        setPendingCount(data.count ?? 0)
      } catch {
        // Silently ignore
      }
    }

    fetchCount()
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
  }, [enabled, url])

  return { pendingCount }
}
