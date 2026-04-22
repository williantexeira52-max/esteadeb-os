import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as fs from 'fs';

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  await signInWithEmailAndPassword(auth, 'williantexeira52@gmail.com', 'admin1234');
  
  const qInstallments = query(collection(db, 'financial_installments'), limit(20));
  const snap = await getDocs(qInstallments);
  console.log("Total docs:", snap.size);
  snap.forEach(doc => {
    console.log(doc.id, "nucleoId:", doc.data().nucleoId, "dueDate:", doc.data().dueDate);
  });
  
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
