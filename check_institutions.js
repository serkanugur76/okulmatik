import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function run() {
  console.log("Listing all institutions and their googleAltyapisi value:");
  const snap = await getDocs(collection(db, 'kurumlar'));
  snap.forEach(d => {
    const data = d.data();
    console.log(`- ID: ${d.id} | Name: ${data.ad} | Type: ${data.tip} | Google Workspace: ${data.googleAltyapisi} | Parent: ${data.parentId}`);
  });
}
run();
