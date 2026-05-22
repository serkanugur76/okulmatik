import { createContext, useContext, useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './AuthContext'

const KurumYonetimContext = createContext(null)

/**
 * Kullanıcının erişebildiği tüm kurumları (kendi kurumu + alt kurumlar) yükler.
 * secilenKurumId ile hangi kurumun verisi gösterileceğini yönetir.
 */
export function KurumYonetimProvider({ children }) {
  const { kurumId } = useAuth()
  const [erisimKurumlar, setErisimKurumlar] = useState([])
  const [secilenKurumId, setSecilenKurumId] = useState(null)
  const [yukleniyor, setYukleniyor]         = useState(true)

  useEffect(() => {
    if (!kurumId) return
    setSecilenKurumId(kurumId)

    async function yukle() {
      try {
        // 1. Kendi kurumu
        const anaSnap = await getDoc(doc(db, 'kurumlar', kurumId))
        if (!anaSnap.exists()) { setYukleniyor(false); return }
        const anaKurum = { id: kurumId, ...anaSnap.data() }
        setErisimKurumlar([anaKurum])

        // 2. rootKurumId == kurumId  →  root admin: tüm kampüs + alt kurumlar
        // 3. parentId    == kurumId  →  kampüs admin: sadece kendi alt kurumları
        // İki sorgu çalıştır, dedup et
        try {
          const [rootSnap, parentSnap] = await Promise.all([
            getDocs(query(collection(db, 'kurumlar'), where('rootKurumId', '==', kurumId))),
            getDocs(query(collection(db, 'kurumlar'), where('parentId',    '==', kurumId))),
          ])
          const map = new Map()
          ;[...rootSnap.docs, ...parentSnap.docs].forEach(d => map.set(d.id, { id: d.id, ...d.data() }))
          setErisimKurumlar([anaKurum, ...map.values()])
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
  }, [kurumId])

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
