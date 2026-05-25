import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
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
  const { kurumId, platformAdmin, profil } = useAuth()
  const ogretmen = profil?.rol === 'ogretmen'

  const [erisimKurumlar, setErisimKurumlar] = useState([])
  const [secilenKurumId, setSecilenKurumId] = useState(null)
  const [yukleniyor, setYukleniyor]         = useState(true)

  const atananKurumIds = useMemo(
    () => profil?.erisimKurumIdler || [],
    [profil?.erisimKurumIdler?.join(',')]  // eslint-disable-line
  )

  useEffect(() => {
    setYukleniyor(true)

    // ── Platform Admin: tüm kurumları yükle ─────────────────────────────────
    if (platformAdmin) {
      async function yukleHepsi() {
        try {
          const snap = await getDocs(collection(db, 'kurumlar'))
          const hepsi = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          const tipSira = { kurum: 0, kampus: 1, altKurum: 2 }
          hepsi.sort((a, b) => (tipSira[a.tip] ?? 3) - (tipSira[b.tip] ?? 3))
          setErisimKurumlar(hepsi)
          const ilkKok = hepsi.find(k => !k.parentId)
          if (ilkKok) setSecilenKurumId(ilkKok.id)
        } catch (err) {
          console.error('Platform admin kurum yükleme hatası:', err)
        } finally {
          setYukleniyor(false)
        }
      }
      yukleHepsi()
      return
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
          const snaplar = await Promise.all(
            atananKurumIds.map(kid => getDoc(doc(db, 'kurumlar', kid)))
          )
          const kurumlar = snaplar
            .filter(s => s.exists())
            .map(s => ({ id: s.id, ...s.data() }))
          setErisimKurumlar(kurumlar)
          // Tek kurum → direkt seç; birden fazla → null (kurum seçici gösterilecek)
          setSecilenKurumId(kurumlar.length === 1 ? kurumlar[0].id : null)
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
    setSecilenKurumId(kurumId)

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
        setErisimKurumlar([...ustKurumlar, anaKurum])

        // 3. Alt kurumları yükle
        try {
          const [rootQ, parentQ] = await Promise.all([
            getDocs(query(collection(db, 'kurumlar'), where('rootKurumId', '==', kurumId))),
            getDocs(query(collection(db, 'kurumlar'), where('parentId',    '==', kurumId))),
          ])
          const map = new Map()
          ;[...rootQ.docs, ...parentQ.docs].forEach(d => map.set(d.id, { id: d.id, ...d.data() }))
          setErisimKurumlar([...ustKurumlar, anaKurum, ...map.values()])
        } catch (err) {
          console.error('Alt kurum yükleme hatası:', err.code, err.message)
        }
      } catch (err) {
        console.error('Kurum yükleme hatası:', err)
      } finally {
        setYukleniyor(false)
      }
    }
    yukle()
  }, [kurumId, platformAdmin, ogretmen, atananKurumIds.join(',')]) // eslint-disable-line

  const secilenKurum = erisimKurumlar.find(k => k.id === secilenKurumId) || null

  // Öğretmen için: seçili kurumda hangi sınıflar atanmış?
  const ogretmenSinifIdleri = useMemo(() => {
    if (!ogretmen || !secilenKurumId) return []
    const atama = (profil?.sinifAtamalari || []).find(a => a.kurumId === secilenKurumId)
    return atama?.siniflar || []
  }, [ogretmen, secilenKurumId, profil?.sinifAtamalari]) // eslint-disable-line

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
