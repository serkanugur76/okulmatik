import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * Firebase Auth'ta zaten var olan bir kullanıcı için sadece Firestore profili oluşturur.
 */
export async function profilOlustur({ uid, ad, email, rol, kurumId = null }) {
  await setDoc(doc(db, 'kullanicilar', uid), {
    ad, email, rol, kurumId,
    olusturmaTarihi: serverTimestamp(),
  })
  if (kurumId) {
    await setDoc(doc(db, 'kurumlar', kurumId, 'kullanicilar', uid), {
      ad, email, rol, kurumId, durum: 'aktif',
      olusturmaTarihi: serverTimestamp(),
    })
  }
  return { uid }
}

/**
 * Mevcut admin oturumunu bozmadan yeni bir Firebase Auth kullanıcısı oluşturur
 * ve Firestore'a profil kaydeder.
 */
export async function kullaniciOlustur({ ad, email, sifre, rol, kurumId = null }) {
  const geciciApp  = initializeApp(firebaseConfig, `gecici_${Date.now()}`)
  const geciciAuth = getAuth(geciciApp)
  try {
    const { user } = await createUserWithEmailAndPassword(geciciAuth, email, sifre)
    await signOut(geciciAuth)

    // Ana kullanicilar koleksiyonuna profil yaz
    await setDoc(doc(db, 'kullanicilar', user.uid), {
      ad, email, rol, kurumId,
      olusturmaTarihi: serverTimestamp(),
    })

    // Kurum üyesiyse kuruma da ekle
    if (kurumId) {
      await setDoc(doc(db, 'kurumlar', kurumId, 'kullanicilar', user.uid), {
        ad, email, rol, kurumId, durum: 'aktif',
        olusturmaTarihi: serverTimestamp(),
      })
    }

    return { uid: user.uid }
  } finally {
    await deleteApp(geciciApp)
  }
}
