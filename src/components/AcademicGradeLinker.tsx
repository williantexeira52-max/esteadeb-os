import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  doc, 
  getDocs, 
  writeBatch, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Link2, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ArrowRight,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const AcademicGradeLinker: React.FC = () => {
  const { nucleo, profile, user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  const [selection, setSelection] = useState({
    subjectId: '',
    courseId: ''
  });

  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!nucleo) return;
    // Fetch Courses
    const qCourses = query(
      collection(db, 'courses'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribeCourses = onSnapshot(qCourses, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Subjects (Grades)
    const qSubjects = query(
      collection(db, 'grades'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribeSubjects = onSnapshot(qSubjects, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeCourses();
      unsubscribeSubjects();
    };
  }, [nucleo]);

  const handleLink = async () => {
    if (!selection.subjectId || !selection.courseId) {
      addToast('Selecione uma disciplina e um curso.', 'error');
      return;
    }

    setLinking(true);
    try {
      const selectedSubject = subjects.find(s => s.id === selection.subjectId);
      const selectedCourse = courses.find(c => c.id === selection.courseId);

      // 1. Update the subject's course association
      await writeBatch(db).update(doc(db, 'grades', selection.subjectId), {
        course: selectedCourse.name,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || profile?.id || 'system'
      }).commit();

      // 2. Find all students in this course (via their classes)
      const classesQuery = query(
        collection(db, 'classes'), 
        where('courseName', '==', selectedCourse.name),
        where('nucleoId', '==', nucleo)
      );
      const classesSnap = await getDocs(classesQuery);
      const classIds = classesSnap.docs.map(d => d.id);

      if (classIds.length > 0) {
        const studentsQuery = query(
          collection(db, 'students'),
          where('classId', 'in', classIds),
          where('deleted', '==', false)
        );
        const studentsSnap = await getDocs(studentsQuery);
        
        const batch = writeBatch(db);
        let pdCount = 0;

        for (const studentDoc of studentsSnap.docs) {
          const studentId = studentDoc.id;
          const studentData = studentDoc.data();
          
          // Check if record already exists for this subject/module
          // Note: We use the module from the subject definition
          const recordId = `${studentId}_${selection.subjectId}_${selectedSubject.module || '1'}`;
          const recordRef = doc(db, 'academic_records', recordId);
          const recordSnap = await getDocs(query(collection(db, 'academic_records'), where('__name__', '==', recordId)));

          if (recordSnap.empty) {
            batch.set(recordRef, {
              studentId,
              studentName: studentData.name,
              turmaId: studentData.classId,
              disciplinaId: selection.subjectId,
              disciplina: selectedSubject.name,
              ano: selectedSubject.year || '1º',
              modulo: selectedSubject.module || '1',
              nota: 0,
              faltas: 0,
              status: 'PD', // PENDENTE
              nucleoId: nucleo,
              poloId: studentData.poloId || profile?.poloId || null,
              poloName: studentData.poloName || profile?.poloName || 'MATRIZ',
              updatedAt: serverTimestamp(),
              updatedBy: user?.uid || profile?.id || 'system',
              createdBy: user?.uid || profile?.id || 'system',
              timestamp: serverTimestamp()
            });
            pdCount++;
          }
        }

        if (pdCount > 0) {
          await batch.commit();
          addToast(`${pdCount} alunos marcados como PD (Pendente).`, 'success');
        } else {
          addToast('Vínculo realizado. Nenhum novo histórico pendente necessário.', 'success');
        }
      } else {
        addToast('Disciplina vinculada ao curso. Nenhuma turma ativa encontrada para este curso.', 'success');
      }

      setSelection({ subjectId: '', courseId: '' });
    } catch (error) {
      console.error('Link error:', error);
      addToast('Erro ao vincular disciplina.', 'error');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-8">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[300] space-y-2">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={cn(
              "flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-full duration-300",
              toast.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm">{toast.title}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="p-3 bg-navy text-white rounded-2xl shadow-lg shadow-navy/20">
          <Link2 size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-navy uppercase tracking-tight">Vincular Disciplina à Grade</h2>
          <p className="text-slate-500 font-medium text-sm">Integração entre Matriz Curricular e Histórico do Aluno.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
        <div className="space-y-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
            <BookOpen size={14} className="text-petrol" /> Selecionar Disciplina (Módulo)
          </label>
          <select 
            className="w-full h-14 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
            value={selection.subjectId}
            onChange={(e) => setSelection({...selection, subjectId: e.target.value})}
          >
            <option value="">Escolha a Disciplina...</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.module || 'Módulo s/n'})</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
            <Layers size={14} className="text-petrol" /> Selecionar Curso Presencial
          </label>
          <select 
            className="w-full h-14 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
            value={selection.courseId}
            onChange={(e) => setSelection({...selection, courseId: e.target.value})}
          >
            <option value="">Escolha o Curso...</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400">
            <History size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-navy uppercase tracking-tight">Lógica "PD" Ativada</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase leading-tight">
              Alunos sem nota nesta disciplina serão marcados como <span className="text-amber-600">PENDENTE</span> automaticamente.
            </p>
          </div>
        </div>

        <Button 
          onClick={handleLink}
          disabled={linking || !selection.subjectId || !selection.courseId}
          className="bg-petrol hover:bg-petrol-dark text-white px-10 py-7 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-petrol/20 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        >
          {linking ? <Loader2 className="animate-spin" /> : <Link2 size={24} />}
          Exportar para Grade
        </Button>
      </div>

      {selection.subjectId && selection.courseId && (
        <div className="flex items-center justify-center gap-4 py-4 animate-in fade-in slide-in-from-bottom-4">
          <Badge className="bg-navy text-white px-4 py-2 rounded-xl font-bold">
            {subjects.find(s => s.id === selection.subjectId)?.name}
          </Badge>
          <ArrowRight className="text-slate-300" />
          <Badge className="bg-petrol text-white px-4 py-2 rounded-xl font-bold">
            {courses.find(c => c.id === selection.courseId)?.name}
          </Badge>
        </div>
      )}
    </div>
  );
};
