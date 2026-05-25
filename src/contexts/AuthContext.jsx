import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [kullanici, setKullanici]   = useState(null)
  const [profil, setProfil]         = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setKullanici(user)
        try {
          const profilSnap = await getDoc(doc(db, 'kullanicilar', user.uid))
          if (profilSnap.exists()) {
            setProfil(profilSnap.data())
            deleteDoc(doc(db, 'yetkiliKullanicilar', user.email)).catch(() => {})
          } else {
            // İlk giriş: yetkiliKullanicilar'da e-posta var mı?
            const yetkiSnap = await getDoc(doc(db, 'yetkiliKullanicilar', user.email))
            if (yetkiSnap.exists()) {
              const yetki = yetkiSnap.data()
              const yeniProfil = {
                ad: user.displayName || user.email.split('@')[0],
                email: user.email,
                rol: yetki.rol,
                kurumId: yetki.kurumId || null,
                modulIzinler:     yetki.modulIzinler     || {},
                sinifAtamalari:   yetki.sinifAtamalari   || [],
                sinifIdler:       yetki.sinifIdler       || [],
                erisimKurumIdler: yetki.erisimKurumIdler || [],
                parentKurumIdler: yetki.parentKurumIdler || [],
                olusturmaTarihi: serverTimestamp(),
              }
              await setDoc(doc(db, 'kullanicilar', user.uid), yeniProfil)
              if (yetki.kurumId) {
                // Hata olsa bile profili set et — kural izin vermezse admin düzeltir
                setDoc(doc(db, 'kurumlar', yetki.kurumId, 'kullanicilar', user.uid), {
                  ...yeniProfil, durum: 'aktif',
                }).catch(err => console.warn('Kurum subcollection yazılamadı:', err.message))
              }
              await deleteDoc(doc(db, 'yetkiliKullanicilar', user.email))
              setProfil(yeniProfil)
            } else {
              setProfil(null)
            }
          }
        } catch (err) {
          console.error('Firestore okuma hatası:', err)
          setProfil(null)
        }
      } else {
        setKullanici(null)
        setProfil(null)
      }
      setYukleniyor(false)
    })
    return unsub
  }, [])

  const girisYap     = (email, sifre) => signInWithEmailAndPassword(auth, email, sifre)
  const googleGiris  = ()             => signInWithPopup(auth, new GoogleAuthProvider())
  const cikisYap     = ()             => signOut(auth)
  const sifreSifirla = (email)        => sendPasswordResetEmail(auth, email)

  const value = {
    kullanici, profil, yukleniyor,
    platformAdmin: profil?.rol === 'platform_admin',
    kurumAdmin:    profil?.rol === 'kurum_admin',
    ogretmen:      profil?.rol === 'ogretmen',
    kurumId:       profil?.kurumId ?? null,
    girisYap, googleGiris, cikisYap, sifreSifirla,
  }

  return (
    <AuthContext.Provider value={value}>
      {!yukleniyor && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı')
  return ctx
}
