import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Firebase Config
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^VITE_([^=]+)=(.*)$/);
  if (match) envVars[`VITE_${match[1]}`] = match[2];
});

const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const courses = [
  // ZORUNLU DERSLER
  { ad: 'Türkçe', tip: 'Zorunlu', brans: 'Sınıf Öğretmeni / Türkçe', saatler: { "1": 10, "2": 10, "3": 8, "4": 8, "5": 6, "6": 6, "7": 5, "8": 5 } },
  { ad: 'Matematik', tip: 'Zorunlu', brans: 'Sınıf Öğretmeni / Matematik', saatler: { "1": 5, "2": 5, "3": 5, "4": 5, "5": 5, "6": 5, "7": 5, "8": 5 } },
  { ad: 'Hayat Bilgisi', tip: 'Zorunlu', brans: 'Sınıf Öğretmeni', saatler: { "1": 4, "2": 4, "3": 3 } },
  { ad: 'Fen Bilimleri', tip: 'Zorunlu', brans: 'Sınıf Öğretmeni / Fen Bilimleri', saatler: { "3": 3, "4": 3, "5": 4, "6": 4, "7": 4, "8": 4 } },
  { ad: 'Sosyal Bilgiler', tip: 'Zorunlu', brans: 'Sosyal Bilgiler', saatler: { "4": 3, "5": 3, "6": 3, "7": 3 } },
  { ad: 'T.C. İnkılap Tarihi ve Atatürkçülük', tip: 'Zorunlu', brans: 'Sosyal Bilgiler', saatler: { "8": 2 } },
  { ad: 'Yabancı Dil', tip: 'Zorunlu', brans: 'İngilizce', saatler: { "2": 2, "3": 2, "4": 2, "5": 3, "6": 3, "7": 4, "8": 4 } },
  { ad: 'Din Kültürü ve Ahlak Bilgisi', tip: 'Zorunlu', brans: 'Din Kültürü', saatler: { "4": 2, "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Görsel Sanatlar', tip: 'Zorunlu', brans: 'Görsel Sanatlar', saatler: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1 } },
  { ad: 'Müzik', tip: 'Zorunlu', brans: 'Müzik', saatler: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1 } },
  { ad: 'Beden Eğitimi ve Oyun', tip: 'Zorunlu', brans: 'Sınıf Öğretmeni', saatler: { "1": 5, "2": 5, "3": 5, "4": 2 } },
  { ad: 'Beden Eğitimi ve Spor', tip: 'Zorunlu', brans: 'Beden Eğitimi', saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Teknoloji ve Tasarım', tip: 'Zorunlu', brans: 'Teknoloji Tasarım', saatler: { "7": 2, "8": 2 } },
  { ad: 'Trafik Güvenliği', tip: 'Zorunlu', brans: 'Sınıf Öğretmeni', saatler: { "4": 1 } },
  { ad: 'İnsan Hakları, Vatandaşlık ve Demokrasi', tip: 'Zorunlu', brans: 'Sınıf Öğretmeni / Sosyal Bilgiler', saatler: { "4": 2 } },
  { ad: 'Bilişim Teknolojileri ve Yazılım', tip: 'Zorunlu', brans: 'Bilişim Teknolojileri', saatler: { "5": 2, "6": 2 } },
  { ad: 'Rehberlik ve Yönlendirme', tip: 'Zorunlu', brans: 'Rehber Öğretmen', saatler: { "5": 1, "6": 1, "7": 1, "8": 1 } },

  // SEÇMELİ DERSLER (Örnek Set)
  { ad: 'Matematik ve Bilim Uygulamaları', tip: 'Seçmeli', brans: 'Matematik / Fen Bilimleri', saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Okuma Becerileri', tip: 'Seçmeli', brans: 'Türkçe', saatler: { "5": 2, "6": 2 } },
  { ad: 'Yabancı Dil (Seçmeli)', tip: 'Seçmeli', brans: 'İngilizce', saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Robotik Kodlama', tip: 'Seçmeli', brans: 'Bilişim Teknolojileri', saatler: { "5": 2, "6": 2 } },
  { ad: 'Yapay Zeka Uygulamaları', tip: 'Seçmeli', brans: 'Bilişim Teknolojileri', saatler: { "7": 2, "8": 2 } },
  { ad: 'Kur\'an-ı Kerim', tip: 'Seçmeli', brans: 'Din Kültürü', saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Peygamberimizin Hayatı', tip: 'Seçmeli', brans: 'Din Kültürü', saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Görgü Kuralları ve Nezaket', tip: 'Seçmeli', brans: 'Sosyal Bilgiler', saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  { ad: 'Spor ve Fizikî Etkinlikler', tip: 'Seçmeli', brans: 'Beden Eğitimi', saatler: { "5": 2, "6": 2, "7": 2, "8": 2 } },
  
  // KURUM DERSLERİ (Etüt, Özel İng vs.) - Örnek olarak
  { ad: 'Etüt', tip: 'Kurum Dersi', brans: 'Sınıf Öğretmeni', saatler: {} },
  { ad: 'Satranç', tip: 'Kurum Dersi', brans: 'Sınıf Öğretmeni', saatler: {} },
];

const createSlug = (text) => {
  const charMap = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u' };
  let slug = text.trim().toLowerCase().replace(/[çğıöşüÇĞİÖŞÜ]/g, m => charMap[m]);
  slug = slug.replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '_');
  return slug;
}

async function populate() {
  console.log('Eski dersler temizleniyor...');
  const snap = await getDocs(collection(db, 'sistemDersleri'));
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
  console.log('Temizlendi.');

  console.log('Yeni dersler ekleniyor...');
  for (const c of courses) {
    const slug = createSlug(c.ad);
    const docId = `meb_${slug}`;
    await setDoc(doc(db, 'sistemDersleri', docId), {
      ad: c.ad,
      tip: c.tip,
      brans: c.brans,
      saatler: c.saatler,
      eklenmeTarihi: new Date()
    });
    console.log(`Eklendi: ${c.ad}`);
  }
  console.log('Bitti!');
  process.exit(0);
}

populate().catch(console.error);
