import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client.js'

const POLL_INTERVAL_MS = 30_000

/**
 * FR-A04: Polls /api/admin/pending-count every 30 s.
 * Returns { pendingCount } — always 0 when user is not admin.
 *
 * @param {boolean} isAdmin  Pass req.user.is_admin (or equivalent from AuthContext)
 */
export function useAdminBadge(isAdmin) {
  const [pendingCount, setPendingCount] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) {
      setPendingCount(0)
      return
    }

    const fetchCount = async () => {
      try {
        const data = await api.get('/api/admin/pending-count')
        setPendingCount(data.count ?? 0)
      } catch {
        // Silently ignore — badge will just show stale count
      }
    }

    // Fetch immediately, then on interval
    fetchCount()
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL_MS)

    return () => clearInterval(intervalRef.current)
  }, [isAdmin])

  return { pendingCount }
}
