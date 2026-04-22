import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, updateDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const qInstallments = query(collection(db, 'financial_installments'));
  const snap = await getDocs(qInstallments);
  console.log("Total docs:", snap.size);
  let updated = 0;
  for (const actDoc of snap.docs) {
    if (!actDoc.data().nucleoId) {
      await updateDoc(doc(db, 'financial_installments', actDoc.id), {
        nucleoId: 'PRESENCIAL'
      });
      updated++;
    }
  }
  console.log("Updated", updated, "documents.");
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
