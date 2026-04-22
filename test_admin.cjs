const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');

const raw = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(raw);

const db = new Firestore({
  projectId: config.projectId,
  databaseId: config.firestoreDatabaseId
});

async function checkData() {
  const snapshot = await db.collection('financial_installments').limit(20).get();
  console.log("Total installments in DB:", snapshot.size);
  snapshot.forEach(doc => {
    console.log(doc.id, "nucleoId:", doc.data().nucleoId, "dueDate:", doc.data().dueDate);
  });
}

checkData().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
