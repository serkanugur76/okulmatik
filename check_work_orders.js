import { initializeApp } from 'firebase/app';
import { getFirestore, collectionGroup, getDocs } from 'firebase/firestore';

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

async function check() {
  console.log("Fetching all isEmirleri documents via collectionGroup...");
  try {
    const querySnapshot = await getDocs(collectionGroup(db, 'isEmirleri'));
    console.log(`Found ${querySnapshot.size} work orders.`);
    querySnapshot.forEach((doc) => {
      const parentPath = doc.ref.parent.parent.path;
      console.log(`- Path: ${doc.ref.path} (Institution: ${parentPath})`);
      console.log("  Data:", doc.data());
    });
  } catch (err) {
    console.error("Error:", err.message);
  }
}
check();
