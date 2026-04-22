import { getDoc, setDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';

export const seedInitialAdmin = async () => {
  try {
    const masterEmail = '000000@esteadeb.com.br';
    const masterPassword = '123456';

    // 1. Always try to ensure the Auth user exists
    try {
      await createUserWithEmailAndPassword(auth, masterEmail, masterPassword);
      console.log('Auth user for Master Admin ensured.');
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('Master Admin Auth already exists.');
      } else if (e.code === 'auth/operation-not-allowed') {
        console.error('CRITICAL: Email/Password provider is disabled in Firebase Console.');
      } else {
        console.error('Master Admin Auth creation error:', e.code);
      }
    }

    // 2. Force Create/Update Firestore doc for Master Admin with ID 000000
    const masterAdminRef = doc(db, 'app_users', '000000');
    
    try {
      const snap = await getDoc(masterAdminRef);
      if (snap.exists() && snap.data().email === masterEmail) {
        console.log('Master Admin (000000) already exists and is active.');
        return;
      }
    } catch (e: any) {
      if (e.code === 'permission-denied') {
        console.log('Seeder: Access denied to check admin status. Proceeding to update if needed.');
      }
    }

    console.log('Seeder: Ensuring Master Admin exists in Firestore...');
    await setDoc(masterAdminRef, {
      name: 'Administrador Geral',
      email: masterEmail,
      cpf: '000000',
      matricula: '000000',
      password: masterPassword,
      role: 'Direção',
      nucleoId: 'MATRIZ',
      createdAt: new Date().toISOString(),
      status: 'Ativo'
    }, { merge: true });
    console.log('Master Admin Firestore doc (000000) ensured.');
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.log('Seeder: Operation restricted (Admin likely already exists).');
      return;
    }
    console.error('Error in seeder:', error);
  }
};
