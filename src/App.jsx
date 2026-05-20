import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import GirisPage         from './pages/GirisPage'
import PlatformAdminPage from './pages/PlatformAdminPage'
import KurumAdminPage    from './pages/KurumAdminPage'
import OgretmenPage      from './pages/OgretmenPage'
import YetkisizPage      from './pages/YetkisizPage'

function KorunanRoute({ izinliRoller, children }) {
  const { kullanici, profil, yukleniyor } = useAuth()
  if (yukleniyor) return <div className="yukleniyor">Yükleniyor...</div>
  if (!kullanici)  return <Navigate to="/giris" replace />
  if (izinliRoller && !izinliRoller.includes(profil?.rol))
    return <Navigate to="/yetkisiz" replace />
  return children
}

function AnaYonlendirici() {
  const { kullanici, profil, yukleniyor } = useAuth()
  if (yukleniyor) return null
  if (!kullanici)  return <Navigate to="/giris" replace />
  const hedef = {
    platform_admin: '/platform',
    kurum_admin:    '/kurum',
    ogretmen:       '/ogretmen',
  }
  return <Navigate to={hedef[profil?.rol] || '/yetkisiz'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/giris"    element={<GirisPage />} />
          <Route path="/yetkisiz" element={<YetkisizPage />} />
          <Route path="/"         element={<AnaYonlendirici />} />
          <Route path="/platform/*" element={
            <KorunanRoute izinliRoller={['platform_admin']}>
              <PlatformAdminPage />
            </KorunanRoute>
          }/>
          <Route path="/kurum/*" element={
            <KorunanRoute izinliRoller={['kurum_admin']}>
              <KurumAdminPage />
            </KorunanRoute>
          }/>
          <Route path="/ogretmen/*" element={
            <KorunanRoute izinliRoller={['ogretmen']}>
              <OgretmenPage />
            </KorunanRoute>
          }/>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
