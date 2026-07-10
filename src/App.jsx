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
import KurumOgretmenler       from './pages/kurum/KurumOgretmenler'
import KurumNobet             from './pages/kurum/KurumNobet'
import KurumKulupler          from './pages/kurum/KurumKulupler'
import KurumBelirliGunler     from './pages/kurum/KurumBelirliGunler'
import PlatformSistemIslemleri from './pages/platform/PlatformSistemIslemleri'
import KurumResmiIslemler     from './pages/kurum/KurumResmiIslemler'
import KurumResmiEvraklar     from './pages/kurum/KurumResmiEvraklar'
import PlatformTopluMail      from './pages/platform/PlatformTopluMail'
import PlatformVersiyonlar    from './pages/platform/PlatformVersiyonlar'
import KurumArge              from './pages/kurum/KurumArge'

function KorunanRoute({ izinliRoller, children }) {
  const { kullanici, profil, yukleniyor, platformAdmin } = useAuth()
  if (yukleniyor) return <div className="yukleniyor">Yükleniyor...</div>
  if (!kullanici)  return <Navigate to="/giris" replace />
  
  if (izinliRoller) {
    if (izinliRoller.includes('platform_admin') && platformAdmin) {
      return children
    }
    if (!izinliRoller.includes(profil?.rol)) {
      return <Navigate to="/yetkisiz" replace />
    }
  }
  return children
}

function AnaYonlendirici() {
  const { kullanici, profil, yukleniyor, platformAdmin } = useAuth()
  if (yukleniyor) return null
  if (!kullanici)  return <Navigate to="/giris" replace />
  
  if (platformAdmin) {
    return <Navigate to="/platform" replace />
  }
  
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
            <Route path="kurum/ogretmenler"      element={<KurumOgretmenler />} />
            <Route path="kurum/nobet"            element={<KurumNobet />} />
            <Route path="kurum/kulupler"         element={<KurumKulupler />} />
            <Route path="belirli-gunler"         element={<KurumBelirliGunler />} />
            <Route path="kurum/kutuphane"        element={<KurumKutuphane />} />
            <Route path="kurum/arge"             element={<KurumArge />} />
            <Route path="kurum/resmi-islemler/is-plani" element={<KurumResmiIslemler />} />
            <Route path="kurum/resmi-islemler/evraklar" element={<KurumResmiEvraklar />} />
            <Route path="hakkinda"               element={<Hakkinda />} />
            <Route path="loglar"                 element={<PlatformLoglar />} />
            <Route path="sistem"                 element={<PlatformSistemIslemleri />} />
            <Route path="toplu-mail"             element={<PlatformTopluMail />} />
            <Route path="versiyonlar"             element={<PlatformVersiyonlar />} />
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
            <Route path="ogretmenler"      element={<KurumOgretmenler />} />
            <Route path="nobet"            element={<KurumNobet />} />
            <Route path="kulupler"         element={<KurumKulupler />} />
            <Route path="belirli-gunler"   element={<KurumBelirliGunler />} />
            <Route path="kutuphane"        element={<KurumKutuphane />} />
            <Route path="arge"             element={<KurumArge />} />
            <Route path="resmi-islemler/is-plani" element={<KurumResmiIslemler />} />
            <Route path="resmi-islemler/evraklar" element={<KurumResmiEvraklar />} />
            <Route path="hakkinda"         element={<Hakkinda />} />
          </Route>
          <Route path="/ogretmen/*" element={<Navigate to="/kurum" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
