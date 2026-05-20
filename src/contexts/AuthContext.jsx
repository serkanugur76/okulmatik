import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [kullanici, setKullanici]       = useState(null)
  const [profil, setProfil]             = useState(null)
  const [yukleniyor, setYukleniyor]     = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setKullanici(user)
        const snap = await getDoc(doc(db, 'kullanicilar', user.uid))
        setProfil(snap.exists() ? snap.data() : null)
      } else {
        setKullanici(null)
        setProfil(null)
      }
      setYukleniyor(false)
    })
    return unsub
  }, [])

  const girisYap     = (email, sifre) => signInWithEmailAndPassword(auth, email, sifre)
  const cikisYap     = ()             => signOut(auth)
  const sifreSifirla = (email)        => sendPasswordResetEmail(auth, email)

  const value = {
    kullanici, profil, yukleniyor,
    platformAdmin: profil?.rol === 'platform_admin',
    kurumAdmin:    profil?.rol === 'kurum_admin',
    ogretmen:      profil?.rol === 'ogretmen',
    kurumId:       profil?.kurumId ?? null,
    girisYap, cikisYap, sifreSifirla,
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
