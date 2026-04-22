import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import * as fs from 'fs';

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const qInstallments = query(collection(db, 'students'), limit(2));
  const snap = await getDocs(qInstallments);
  console.log("Total students:", snap.size);
  snap.forEach(doc => {
    console.log(doc.id, "nucleoId:", doc.data().nucleoId);
  });

  const q2 = query(collection(db, 'transactions'), limit(2));
  const snap2 = await getDocs(q2);
  console.log("Total transactions:", snap2.size);
  snap2.forEach(doc => {
    console.log(doc.id, "nucleoId:", doc.data().nucleoId);
  });
  
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
