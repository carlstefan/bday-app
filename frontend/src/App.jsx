import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { PartyProvider } from './context/PartyContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import HomePage         from './pages/HomePage.jsx'
import LoginPage        from './pages/LoginPage.jsx'
import UploadPage       from './pages/UploadPage.jsx'
import GalleryPage      from './pages/GalleryPage.jsx'
import AdminPage        from './pages/AdminPage.jsx'
import PartyHomePage    from './pages/PartyHomePage.jsx'
import PartyAdminPage   from './pages/PartyAdminPage.jsx'
import SuperAdminPage   from './pages/SuperAdminPage.jsx'

import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Global routes */}
          <Route path="/"       element={<HomePage />} />
          <Route path="/login"  element={<LoginPage />} />

          {/* Legacy single-party routes — redirect to tcs */}
          <Route path="/upload"  element={<Navigate to="/p/tcs/upload"  replace />} />
          <Route path="/gallery" element={<Navigate to="/p/tcs/gallery" replace />} />
          <Route path="/admin"   element={
            <ProtectedRoute superAdminOnly>
              <SuperAdminPage />
            </ProtectedRoute>
          } />

          {/* Party-scoped routes — all wrapped in PartyProvider */}
          <Route path="/p/:partyKey" element={
            <PartyProvider>
              <PartyHomePage />
            </PartyProvider>
          } />

          <Route path="/p/:partyKey/upload" element={
            <PartyProvider>
              <UploadPage />
            </PartyProvider>
          } />

          <Route path="/p/:partyKey/gallery" element={
            <PartyProvider>
              <ProtectedRoute>
                <GalleryPage />
              </ProtectedRoute>
            </PartyProvider>
          } />

          <Route path="/p/:partyKey/admin" element={
            <PartyProvider>
              <ProtectedRoute>
                <PartyAdminPage />
              </ProtectedRoute>
            </PartyProvider>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
