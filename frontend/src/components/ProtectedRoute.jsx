import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({
  children,
  adminOnly      = false,
  superAdminOnly = false,
  managerOnly    = false,
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <span>Loading…</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (superAdminOnly && !user.is_super_admin) {
    return <Navigate to="/" replace />
  }

  if (adminOnly && !user.is_admin) {
    return <Navigate to="/" replace />
  }

  // managerOnly: backend enforces the actual role check; frontend just requires auth
  // (the role may be for any party, so we can't gate here without partyKey context)

  return children
}
