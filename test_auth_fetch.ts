import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as fs from 'fs';

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  await signInWithEmailAndPassword(auth, 'williantexeira52@gmail.com', 'admin1234');
  
  const qInstallments = query(collection(db, 'financial_installments'));
  try {
    const snap = await getDocs(qInstallments);
    console.log("Total docs found:", snap.size);
  } catch (error) {
    console.error("GET DOCS ERROR:", error);
  }
  
  process.exit(0);
}

run().catch(e => {
  console.error("MAIN ERROR", e);
  process.exit(1);
});
