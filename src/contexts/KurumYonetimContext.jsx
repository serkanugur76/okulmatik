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
        // 1. Kullanıcının kendi kurumu
        const anaSnap = await getDoc(doc(db, 'kurumlar', kurumId))
        if (!anaSnap.exists()) return
        const anaKurum = { id: kurumId, ...anaSnap.data() }
        const liste = [anaKurum]

        // 2. Doğrudan alt kurumlar (kampüsler veya alt kurumlar)
        const cocukSnap = await getDocs(
          query(collection(db, 'kurumlar'), where('parentId', '==', kurumId))
        )
        const cocuklar = cocukSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        liste.push(...cocuklar)

        // 3. Torunlar (alt kurumların alt kurumları)
        for (const cocuk of cocuklar) {
          const torunSnap = await getDocs(
            query(collection(db, 'kurumlar'), where('parentId', '==', cocuk.id))
          )
          liste.push(...torunSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        }

        setErisimKurumlar(liste)
      } catch (err) {
        console.error('Kurum hiyerarşi yükleme hatası:', err)
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
