import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import GirisPage              from './pages/GirisPage'
import YetkisizPage           from './pages/YetkisizPage'
import PlatformLayout         from './pages/platform/PlatformLayout'
import Dashboard              from './pages/platform/Dashboard'
import Kurumlar               from './pages/platform/Kurumlar'
import PlatformKullanicilar   from './pages/platform/PlatformKullanicilar'
import PlatformRubrikler      from './pages/platform/PlatformRubrikler'
import KurumLayout            from './pages/kurum/KurumLayout'
import KurumDashboard         from './pages/kurum/KurumDashboard'
import KurumSiniflar          from './pages/kurum/KurumSiniflar'
import KurumOgrenciler        from './pages/kurum/KurumOgrenciler'
import KurumKullanicilar      from './pages/kurum/KurumKullanicilar'
import KurumRubrikler         from './pages/kurum/KurumRubrikler'
import KurumDegerlendirmeler  from './pages/kurum/KurumDegerlendirmeler'
import KurumMentor            from './pages/kurum/KurumMentor'
import Hakkinda               from './pages/Hakkinda'
import PlatformLoglar         from './pages/platform/PlatformLoglar'
import KurumKutuphane         from './pages/kurum/KurumKutuphane'

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
    ogretmen:       '/kurum',
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
            <Route path="kurumlar"     element={<Kurumlar />} />
            <Route path="kullanicilar" element={<PlatformKullanicilar />} />
            <Route path="rubrikler"    element={<PlatformRubrikler />} />
            {/* Kurum operasyon sayfaları — platform admin seçili kurumu yönetir */}
            <Route path="kurum/siniflar"         element={<KurumSiniflar />} />
            <Route path="kurum/ogrenciler"       element={<KurumOgrenciler />} />
            <Route path="kurum/kullanicilar"     element={<KurumKullanicilar />} />
            <Route path="kurum/rubrikler"        element={<KurumRubrikler />} />
            <Route path="kurum/degerlendirmeler" element={<KurumDegerlendirmeler />} />
            <Route path="kurum/mentor"           element={<KurumMentor />} />
            <Route path="kurum/kutuphane"        element={<KurumKutuphane />} />
            <Route path="hakkinda"               element={<Hakkinda />} />
            <Route path="loglar"                 element={<PlatformLoglar />} />
          </Route>
          <Route path="/kurum" element={
            <KorunanRoute izinliRoller={['kurum_admin', 'ogretmen']}>
              <KurumLayout />
            </KorunanRoute>
          }>
            <Route index element={<KurumDashboard />} />
            <Route path="siniflar"     element={<KurumSiniflar />} />
            <Route path="ogrenciler"   element={<KurumOgrenciler />} />
            <Route path="kullanicilar" element={<KurumKullanicilar />} />
            <Route path="rubrikler"         element={<KurumRubrikler />} />
            <Route path="degerlendirmeler" element={<KurumDegerlendirmeler />} />
            <Route path="mentor"           element={<KurumMentor />} />
            <Route path="kutuphane"        element={<KurumKutuphane />} />
            <Route path="hakkinda"         element={<Hakkinda />} />
          </Route>
          <Route path="/ogretmen/*" element={<Navigate to="/kurum" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
