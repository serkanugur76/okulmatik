import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * İşlem logu yazar. Hata olursa sessizce yutulur (UI akışını bozmaz).
 *
 * @param {object} p
 * @param {object}  p.profil      - useAuth().profil  { ad, email, rol }  (uid YOKTUR — Firestore data())
 * @param {object}  [p.kullanici] - useAuth().kullanici  (Firebase Auth user — uid buradan alınır)
 * @param {string}  p.islem       - 'olustur' | 'guncelle' | 'sil' | 'yukle' | 'davet' | 'davetIptal'
 * @param {string}  p.modul       - 'kurumlar' | 'siniflar' | 'ogrenciler' | 'kullanicilar'
 *                                   | 'rubrikler' | 'sablonlar' | 'degerlendirmeler' | 'mentor'
 * @param {string}  [p.hedefAd]   - Üzerinde işlem yapılan kaydın adı/açıklaması
 * @param {string}  [p.detay]     - Ek bilgi
 * @param {string}  [p.kurumId]   - İlgili kurum ID
 */
export async function logKaydet({ profil, kullanici, islem, modul, hedefAd = '', detay = '', kurumId = '' }) {
  try {
    await addDoc(collection(db, 'islemLoglari'), {
      kullaniciId:  kullanici?.uid || profil?.uid || '',
      kullaniciAd:  profil?.ad    || profil?.email || '',
      kullaniciRol: profil?.rol   || '',
      islem,
      modul,
      hedefAd,
      detay,
      kurumId,
      tarih: serverTimestamp(),
    })
  } catch {
    // Log yazma hatası uygulamayı durdurmamalı
  }
}
