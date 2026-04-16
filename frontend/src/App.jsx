import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import HomePage    from './pages/HomePage.jsx'
import LoginPage   from './pages/LoginPage.jsx'
import UploadPage  from './pages/UploadPage.jsx'
import GalleryPage from './pages/GalleryPage.jsx'

// Admin page added in Phase 7
// import AdminPage from './pages/AdminPage.jsx'

import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/"       element={<HomePage />} />
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/gallery" element={
            <ProtectedRoute>
              <GalleryPage />
            </ProtectedRoute>
          } />
          {/* /admin added in Phase 7 */}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
