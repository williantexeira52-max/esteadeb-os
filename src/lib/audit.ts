import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const logAction = async (userId: string, action: string, details: string) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log action", error);
  }
};

export const softDelete = async (collectionName: string, docId: string, userId: string) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: userId
    });
    await logAction(userId, `Exclusão (Lixeira): ${collectionName}/${docId}`, `Documento movido para a lixeira.`);
  } catch (error) {
    console.error("Failed to soft delete", error);
    throw error;
  }
};

export const restoreDoc = async (collectionName: string, docId: string, userId: string) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      deleted: false,
      restoredAt: serverTimestamp(),
      restoredBy: userId
    });
    await logAction(userId, `Restauração: ${collectionName}/${docId}`, `Documento restaurado da lixeira.`);
  } catch (error) {
    console.error("Failed to restore doc", error);
    throw error;
  }
};
