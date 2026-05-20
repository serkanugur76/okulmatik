import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import GirisPage              from './pages/GirisPage'
import OgretmenPage           from './pages/OgretmenPage'
import YetkisizPage           from './pages/YetkisizPage'
import PlatformLayout         from './pages/platform/PlatformLayout'
import Dashboard              from './pages/platform/Dashboard'
import Kurumlar               from './pages/platform/Kurumlar'
import PlatformKullanicilar   from './pages/platform/PlatformKullanicilar'
import KurumLayout            from './pages/kurum/KurumLayout'
import KurumDashboard         from './pages/kurum/KurumDashboard'
import KurumSiniflar          from './pages/kurum/KurumSiniflar'
import KurumOgrenciler        from './pages/kurum/KurumOgrenciler'
import KurumKullanicilar      from './pages/kurum/KurumKullanicilar'

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
          <Route path="/platform" element={
            <KorunanRoute izinliRoller={['platform_admin']}>
              <PlatformLayout />
            </KorunanRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="kurumlar"    element={<Kurumlar />} />
            <Route path="kullanicilar" element={<PlatformKullanicilar />} />
          </Route>
          <Route path="/kurum" element={
            <KorunanRoute izinliRoller={['kurum_admin']}>
              <KurumLayout />
            </KorunanRoute>
          }>
            <Route index element={<KurumDashboard />} />
            <Route path="siniflar"     element={<KurumSiniflar />} />
            <Route path="ogrenciler"   element={<KurumOgrenciler />} />
            <Route path="kullanicilar" element={<KurumKullanicilar />} />
          </Route>
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
