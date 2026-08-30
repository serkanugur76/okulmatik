import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'

const KurumYonetimContext = createContext(null)

/**
 * Hiyerarşi:
 *   platform_admin  → tüm kurumlar
 *   kurum_admin @ tip:'kurum'    → kendi kurumu + tüm alt kampüs + altKurumlar
 *   kurum_admin @ tip:'kampus'   → kendi kampüsü + kendi altKurumları
 *   kurum_admin @ tip:'altKurum' → sadece kendi altKurumu
 *   ogretmen                     → erisimKurumIdler'deki kurumlar (sinifAtamalari'ndan)
 */
export function KurumYonetimProvider({ children }) {
  const { kurumId, platformAdmin, profil, kullanici } = useAuth()
  const ogretmen = profil?.rol === 'ogretmen'

  // localStorage anahtarı kullanıcıya özgü (farklı hesaplar arasında karışmasın)
  const LS_KEY = `okulmatik_secilenKurumId_${kullanici?.uid || 'guest'}`

  const [erisimKurumlar, setErisimKurumlar] = useState([])
  const [secilenKurumId, setSecilenKurumIdRaw] = useState(null)
  const [yukleniyor, setYukleniyor]         = useState(true)

  // Seçimi hem state'e hem localStorage'a yaz
  function setSecilenKurumId(id) {
    if (id) localStorage.setItem(LS_KEY, id)
    else    localStorage.removeItem(LS_KEY)
    setSecilenKurumIdRaw(id)
  }

  const atananKurumIds = useMemo(
    () => profil?.erisimKurumIdler || [],
    [profil?.erisimKurumIdler?.join(',')]  // eslint-disable-line
  )
  const parentKurumIds = useMemo(
    () => profil?.parentKurumIdler || [],
    [profil?.parentKurumIdler?.join(',')]  // eslint-disable-line
  )

  useEffect(() => {
    setYukleniyor(true)

    // ── Platform Admin: tüm kurumları yükle ─────────────────────────────────
    if (platformAdmin) {
      const unsub = onSnapshot(collection(db, 'kurumlar'), snap => {
        const hepsi = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        const tipSira = { kurum: 0, kampus: 1, altKurum: 2 }
        hepsi.sort((a, b) => (tipSira[a.tip] ?? 3) - (tipSira[b.tip] ?? 3))
        setErisimKurumlar(hepsi)
        const kayitliId = localStorage.getItem(LS_KEY)
        const kayitli   = kayitliId && hepsi.find(k => k.id === kayitliId)
        setSecilenKurumIdRaw(kayitli ? kayitliId : null)
        setYukleniyor(false)
      }, err => {
        console.error('Platform admin kurum dinleme hatası:', err)
        setYukleniyor(false)
      })
      return () => unsub()
    }

    // ── Öğretmen: sadece atanan kurumlar ────────────────────────────────────
    if (ogretmen) {
      if (!atananKurumIds.length) {
        setErisimKurumlar([])
        setSecilenKurumId(null)
        setYukleniyor(false)
        return
      }
      async function yukleOgretmen() {
        try {
          // Atanan altKurumları yükle
          const snaplar = await Promise.all(
            atananKurumIds.map(kid => getDoc(doc(db, 'kurumlar', kid)))
          )
          const kurumlar = snaplar
            .filter(s => s.exists())
            .map(s => ({ id: s.id, ...s.data() }))

          // Parent kampüs dokümanlarını yükle (kampüs adını göstermek için)
          const yuklenecekParentIds = parentKurumIds.filter(
            pid => !kurumlar.find(k => k.id === pid)
          )
          const parentSnaplar = yuklenecekParentIds.length
            ? await Promise.all(yuklenecekParentIds.map(pid => getDoc(doc(db, 'kurumlar', pid))))
            : []
          const parentKurumlar = parentSnaplar
            .filter(s => s.exists())
            .map(s => ({ id: s.id, ...s.data() }))

          // Root kurum dokümanlarını yükle (rubrik erişimi için — rubrikler root altında saklanıyor)
          const yuklenecekRootIds = [...new Set(kurumlar.map(k => k.rootKurumId).filter(Boolean))]
            .filter(rid => !kurumlar.find(k => k.id === rid) && !parentKurumlar.find(k => k.id === rid))
          const rootSnaplar = yuklenecekRootIds.length
            ? await Promise.all(yuklenecekRootIds.map(rid => getDoc(doc(db, 'kurumlar', rid))))
            : []
          const rootKurumlar = rootSnaplar
            .filter(s => s.exists())
            .map(s => ({ id: s.id, ...s.data() }))

          setErisimKurumlar([...rootKurumlar, ...parentKurumlar, ...kurumlar])
          // Tek kurum → direkt seç; birden fazla → localStorage restore veya null
          const kayitliId = localStorage.getItem(LS_KEY)
          const kayitliGecerli = kayitliId && atananKurumIds.includes(kayitliId)
          if (kayitliGecerli)        setSecilenKurumIdRaw(kayitliId)
          else                       setSecilenKurumIdRaw(null)
        } catch (err) {
          console.error('Öğretmen kurum yükleme hatası:', err)
        } finally {
          setYukleniyor(false)
        }
      }
      yukleOgretmen()
      return
    }

    // ── Kurum Admin ──────────────────────────────────────────────────────────
    if (!kurumId) { setErisimKurumlar([]); setYukleniyor(false); return }

    async function yukle() {
      try {
        // 1. Kendi kurumu
        const anaSnap = await getDoc(doc(db, 'kurumlar', kurumId))
        if (!anaSnap.exists()) { setYukleniyor(false); return }
        const anaKurum = { id: kurumId, ...anaSnap.data() }

        // 2. Ata kurumları çek (rubrik inheritance + başlık gösterimi için)
        let rootKurum   = null
        let kampusKurum = null

        if (anaKurum.rootKurumId && anaKurum.rootKurumId !== kurumId) {
          try {
            const rootSnap = await getDoc(doc(db, 'kurumlar', anaKurum.rootKurumId))
            if (rootSnap.exists()) rootKurum = { id: anaKurum.rootKurumId, ...rootSnap.data() }
          } catch (err) {
            console.warn('Root kurum yüklenemedi:', err.message)
          }
        }

        if (anaKurum.parentId && anaKurum.parentId !== kurumId && anaKurum.parentId !== anaKurum.rootKurumId) {
          try {
            const kampusSnap = await getDoc(doc(db, 'kurumlar', anaKurum.parentId))
            if (kampusSnap.exists()) kampusKurum = { id: anaKurum.parentId, ...kampusSnap.data() }
          } catch (err) {
            console.warn('Kampüs yüklenemedi:', err.message)
          }
        }

        const ustKurumlar = [rootKurum, kampusKurum].filter(Boolean)
        const tumKurumlar = [...ustKurumlar, anaKurum]
        setErisimKurumlar(tumKurumlar)

        // 3. Alt kurumları yükle
        try {
          const [rootQ, parentQ] = await Promise.all([
            getDocs(query(collection(db, 'kurumlar'), where('rootKurumId', '==', kurumId))),
            getDocs(query(collection(db, 'kurumlar'), where('parentId',    '==', kurumId))),
          ])
          const map = new Map()
          ;[...rootQ.docs, ...parentQ.docs].forEach(d => map.set(d.id, { id: d.id, ...d.data() }))
          const hepsi = [...ustKurumlar, anaKurum, ...map.values()]
          setErisimKurumlar(hepsi)

          // localStorage'dan seçimi restore et; yoksa kendi kurumu
          const kayitliId = localStorage.getItem(LS_KEY)
          const gecerli   = kayitliId && hepsi.find(k => k.id === kayitliId)
          setSecilenKurumIdRaw(gecerli ? kayitliId : null)
        } catch (err) {
          console.error('Alt kurum yükleme hatası:', err.code, err.message)
          setSecilenKurumIdRaw(kurumId)
        }
      } catch (err) {
        console.error('Kurum yükleme hatası:', err)
      } finally {
        setYukleniyor(false)
      }
    }
    yukle()
  }, [kurumId, platformAdmin, ogretmen, atananKurumIds.join(','), parentKurumIds.join(',')]) // eslint-disable-line

  const secilenKurum = erisimKurumlar.find(k => k.id === secilenKurumId) || null

  // Öğretmen için: hangi sınıflar atanmış?
  const ogretmenSinifIdleri = useMemo(() => {
    if (!ogretmen) return []
    return profil?.sinifIdler || []
  }, [ogretmen, profil?.sinifIdler]) // eslint-disable-line

  return (
    <KurumYonetimContext.Provider value={{
      erisimKurumlar,
      secilenKurumId,
      secilenKurum,
      setSecilenKurumId,
      yukleniyor,
      // Öğretmene özgü
      ogretmenModu:       ogretmen,
      ogretmenSinifIdleri,
    }}>
      {children}
    </KurumYonetimContext.Provider>
  )
}

export function useKurumYonetim() {
  const ctx = useContext(KurumYonetimContext)
  if (!ctx) throw new Error('useKurumYonetim, KurumYonetimProvider içinde kullanılmalı')
  return ctx
}
