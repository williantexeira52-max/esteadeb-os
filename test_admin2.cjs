const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const db = new Firestore({
  projectId: config.projectId,
  databaseId: config.firestoreDatabaseId
});

async function run() {
  const qInstallments = db.collection('financial_installments');
  const snap = await qInstallments.get();
  console.log("Total installments:", snap.size);
  
  process.exit(0);
}

run().catch(console.error);
