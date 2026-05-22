import { createContext, useContext, useEffect, useState } from 'react'
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
 */
export function KurumYonetimProvider({ children }) {
  const { kurumId, platformAdmin } = useAuth()
  const [erisimKurumlar, setErisimKurumlar] = useState([])
  const [secilenKurumId, setSecilenKurumId] = useState(null)
  const [yukleniyor, setYukleniyor]         = useState(true)

  useEffect(() => {
    // ── Platform Admin: tüm kurumları yükle ──────────────────────────────────
    if (platformAdmin) {
      async function yukleHepsi() {
        try {
          const snap = await getDocs(collection(db, 'kurumlar'))
          const hepsi = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          // root → kampüs → altKurum sıralaması
          const tipSira = { kurum: 0, kampus: 1, altKurum: 2 }
          hepsi.sort((a, b) => (tipSira[a.tip] ?? 3) - (tipSira[b.tip] ?? 3))
          setErisimKurumlar(hepsi)
          // İlk root kurumu seçili getir
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

    // ── Kurum Admin ──────────────────────────────────────────────────────────
    if (!kurumId) { setYukleniyor(false); return }
    setSecilenKurumId(kurumId)

    async function yukle() {
      try {
        // 1. Kendi kurumu
        const anaSnap = await getDoc(doc(db, 'kurumlar', kurumId))
        if (!anaSnap.exists()) { setYukleniyor(false); return }
        const anaKurum = { id: kurumId, ...anaSnap.data() }

        // 2. Kampüs / altKurum admini ise root kurumu da çek (başlık gösterimi için)
        let rootKurum = null
        if (anaKurum.rootKurumId && anaKurum.rootKurumId !== kurumId) {
          try {
            const rootSnap = await getDoc(doc(db, 'kurumlar', anaKurum.rootKurumId))
            if (rootSnap.exists()) rootKurum = { id: anaKurum.rootKurumId, ...rootSnap.data() }
          } catch (err) {
            console.warn('Root kurum yüklenemedi:', err.message)
          }
        }

        setErisimKurumlar(rootKurum ? [rootKurum, anaKurum] : [anaKurum])

        // 3. Alt kurumları yükle
        try {
          const [rootQ, parentQ] = await Promise.all([
            getDocs(query(collection(db, 'kurumlar'), where('rootKurumId', '==', kurumId))),
            getDocs(query(collection(db, 'kurumlar'), where('parentId',    '==', kurumId))),
          ])
          const map = new Map()
          ;[...rootQ.docs, ...parentQ.docs].forEach(d => map.set(d.id, { id: d.id, ...d.data() }))
          setErisimKurumlar(rootKurum ? [rootKurum, anaKurum, ...map.values()] : [anaKurum, ...map.values()])
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
  }, [kurumId, platformAdmin])

  const secilenKurum = erisimKurumlar.find(k => k.id === secilenKurumId) || null

  return (
    <KurumYonetimContext.Provider value={{
      erisimKurumlar,
      secilenKurumId,
      secilenKurum,
      setSecilenKurumId,
      yukleniyor,
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
