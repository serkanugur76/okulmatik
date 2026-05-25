import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

function rastgeleSifre() {
  return Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-6).toUpperCase()
}

/**
 * Kullanıcıyı sisteme davet eder:
 * - yetkiliKullanicilar koleksiyonuna email + rol + kurumId kaydeder
 * - Google kurumu değilse Firebase Auth hesabı açar + şifre belirleme maili gönderir
 * - Google kurumuysa sadece kayıt yeterli, kullanıcı Google ile giriş yapar
 */
export async function davetEt({ email, rol, kurumId, googleAltyapisi, modulIzinler = {}, sinifAtamalari = [], sinifIdler = [], erisimKurumIdler = [], parentKurumIdler = [] }) {
  // Her durumda yetkili listesine ekle
  await setDoc(doc(db, 'yetkiliKullanicilar', email), {
    email, rol, kurumId, googleAltyapisi: !!googleAltyapisi,
    modulIzinler, sinifAtamalari, sinifIdler, erisimKurumIdler, parentKurumIdler,
    olusturmaTarihi: serverTimestamp(),
  })

  if (!googleAltyapisi) {
    // Firebase Auth hesabı oluştur (ikinci app ile, mevcut oturum bozulmasın)
    const geciciApp  = initializeApp(firebaseConfig, `davet_${Date.now()}`)
    const geciciAuth = getAuth(geciciApp)
    try {
      await createUserWithEmailAndPassword(geciciAuth, email, rastgeleSifre())
      await signOut(geciciAuth)
    } catch (err) {
      if (err.code !== 'auth/email-already-in-use') {
        await deleteApp(geciciApp)
        throw err
      }
    } finally {
      await deleteApp(geciciApp)
    }
    // Şifre belirleme maili gönder (Firebase'in kendi altyapısından gider)
    await sendPasswordResetEmail(auth, email)
  }
}

/**
 * Daveti iptal eder
 */
export async function davetIptal(email) {
  await deleteDoc(doc(db, 'yetkiliKullanicilar', email))
}
