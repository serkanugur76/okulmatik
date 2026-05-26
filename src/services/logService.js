import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * İşlem logu yazar. Hata olursa sessizce yutulur (UI akışını bozmaz).
 *
 * @param {object} p
 * @param {object}  p.profil      - useAuth().profil  { uid, ad, email, rol }
 * @param {string}  p.islem       - 'olustur' | 'guncelle' | 'sil' | 'yukle' | 'davet' | 'davetIptal'
 * @param {string}  p.modul       - 'kurumlar' | 'siniflar' | 'ogrenciler' | 'kullanicilar'
 *                                   | 'rubrikler' | 'sablonlar' | 'degerlendirmeler'
 * @param {string}  [p.hedefAd]   - Üzerinde işlem yapılan kaydın adı/açıklaması
 * @param {string}  [p.detay]     - Ek bilgi
 * @param {string}  [p.kurumId]   - İlgili kurum ID
 */
export async function logKaydet({ profil, islem, modul, hedefAd = '', detay = '', kurumId = '' }) {
  try {
    await addDoc(collection(db, 'islemLoglari'), {
      kullaniciId:  profil?.uid   || '',
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
