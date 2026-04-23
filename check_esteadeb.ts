import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const config = {
  projectId: "esteadeb-gestao",
  // No api key needed just to check if exists via admin maybe? No web sdk needs apiKey.
};
