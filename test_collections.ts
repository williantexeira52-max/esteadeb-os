import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import * as fs from 'fs';

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const students = await getDocs(collection(db, 'students'));
  console.log("Students:", students.size);
  
  const transactions = await getDocs(collection(db, 'transactions'));
  console.log("Transactions:", transactions.size);
  
  const rules = await getDocs(collection(db, 'school_cash'));
  console.log("School cash:", rules.size);
  process.exit(0);
}

run().catch(console.error);
