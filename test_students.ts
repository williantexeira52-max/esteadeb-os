import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import * as fs from 'fs';

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const students = await getDocs(collection(db, 'students'));
  console.log("Total students:", students.size);
  let todayCount = 0;
  let oldCount = 0;
  
  students.forEach(doc => {
    const data = doc.data();
    if (data.createdAt && data.createdAt.toDate) {
      if (data.createdAt.toDate() > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        todayCount++;
      } else {
        oldCount++;
      }
    } else {
      // If generated from import, might be a string or missing
      todayCount++; 
    }
  });
  console.log({ todayCount, oldCount });
  process.exit(0);
}

run().catch(console.error);
