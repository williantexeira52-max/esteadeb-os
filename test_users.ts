import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import * as fs from 'fs';

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const users = await getDocs(collection(db, 'app_users'));
  console.log("Users found:");
  users.forEach(doc => {
    console.log(doc.id, doc.data().name, doc.data().email, doc.data().role, doc.data().poloId);
  });
  
  process.exit(0);
}

run().catch(console.error);
