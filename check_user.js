import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC-LHinx8MljsOFYPZcbrYMU4mpYMLDDlI",
  authDomain: "okulmatik-50dc8.firebaseapp.com",
  projectId: "okulmatik-50dc8",
  storageBucket: "okulmatik-50dc8.firebasestorage.app",
  messagingSenderId: "209815032705",
  appId: "1:209815032705:web:9f08629e4c031cfaa24e80"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUser() {
  const targetEmail = 'get@gelecekkoleji.com';
  console.log(`Checking database for user: ${targetEmail}\n`);

  // 1. Check yetkiliKullanicilar
  try {
    const inviteDoc = await getDoc(doc(db, 'yetkiliKullanicilar', targetEmail));
    if (inviteDoc.exists()) {
      console.log('--- FOUND in yetkiliKullanicilar (Pending Invites) ---');
      console.log(JSON.stringify(inviteDoc.data(), null, 2));
    } else {
      console.log('Not found in yetkiliKullanicilar');
    }
  } catch (err) {
    console.error('Error reading yetkiliKullanicilar:', err.message);
  }

  // 2. Check global kullanicilar
  try {
    const q = query(collection(db, 'kullanicilar'), where('email', '==', targetEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      console.log('\n--- FOUND in global kullanicilar ---');
      snap.forEach(d => {
        console.log(`ID: ${d.id}`);
        console.log(JSON.stringify(d.data(), null, 2));
      });
    } else {
      console.log('\nNot found in global kullanicilar');
    }
  } catch (err) {
    console.error('Error reading global kullanicilar:', err.message);
  }

  // 3. Scan subcollections in all institutions
  try {
    const schoolsSnap = await getDocs(collection(db, 'kurumlar'));
    console.log(`\nScanning subcollections across ${schoolsSnap.size} institutions...`);
    
    for (const schoolDoc of schoolsSnap.docs) {
      const schoolId = schoolDoc.id;
      const schoolName = schoolDoc.data().ad;
      
      const subUsersSnap = await getDocs(collection(db, 'kurumlar', schoolId, 'kullanicilar'));
      subUsersSnap.forEach(d => {
        const data = d.data();
        if (data.email && data.email.toLowerCase() === targetEmail) {
          console.log(`\n--- FOUND in subcollection: kurumlar/${schoolId}/kullanicilar (School: ${schoolName}) ---`);
          console.log(`UID in subcollection: ${d.id}`);
          console.log(JSON.stringify(data, null, 2));
        }
      });
    }
  } catch (err) {
    console.error('Error scanning subcollections:', err.message);
  }

  console.log('\nScan complete.');
}

checkUser();
