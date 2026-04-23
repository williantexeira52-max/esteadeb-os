import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import * as fs from 'fs';

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const installments = await getDocs(collection(db, 'financial_installments'));
  console.log("Total installments:", installments.size);
  let countPresencial = 0;
  let countPolo = 0;
  let countOther = 0;
  
  installments.forEach(doc => {
    const data = doc.data();
    if (data.nucleoId === 'PRESENCIAL') countPresencial++;
    else if (data.poloId) countPolo++;
    else countOther++;
  });
  console.log({ countPresencial, countPolo, countOther });
  process.exit(0);
}

run().catch(console.error);
