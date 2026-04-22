import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  writeBatch, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * MISSION 1: Limpeza de "Alunos Fantasma" (Integridade Referencial)
 * Varrer a lista de turmas, verificar se cada ID de aluno presente na turma ainda existe na coleção students.
 * Se não existir, o ID deve ser removido e o contador total_alunos deve ser recalculado.
 */
export const syncTurmasIntegrity = async (nucleoId: string) => {
  console.log(`[AcademicSync] Iniciando sincronização de integridade para o núcleo: ${nucleoId}`);
  
  try {
    const classesQuery = query(collection(db, 'classes'), where('nucleoId', '==', nucleoId));
    const classesSnap = await getDocs(classesQuery);
    
    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const classDoc of classesSnap.docs) {
      const classData = classDoc.data();
      const studentIds = classData.studentIds || [];
      
      if (studentIds.length === 0) continue;

      const validStudentIds: string[] = [];
      
      // Check each student
      for (const studentId of studentIds) {
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        if (studentDoc.exists() && !studentDoc.data().deleted) {
          validStudentIds.push(studentId);
        }
      }

      // If there's a mismatch, update the class
      if (validStudentIds.length !== studentIds.length) {
        batch.update(classDoc.ref, {
          studentIds: validStudentIds,
          enrolled: validStudentIds.length,
          updatedAt: new Date()
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`[AcademicSync] Sincronização concluída. ${updatedCount} turmas corrigidas.`);
    } else {
      console.log(`[AcademicSync] Nenhuma inconsistência encontrada.`);
    }
    
    return { success: true, updatedCount };
  } catch (error) {
    console.error(`[AcademicSync] Erro na sincronização:`, error);
    throw error;
  }
};
