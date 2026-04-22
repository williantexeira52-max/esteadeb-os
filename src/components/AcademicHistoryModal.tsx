import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  doc,
  setDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  BookOpen,
  Award,
  Download,
  Printer,
  ChevronRight,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface AcademicHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
}

export const AcademicHistoryModal: React.FC<AcademicHistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  student 
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [history, setHistory] = useState<{
    completed: any[];
    pending: any[];
    inProgress: any[];
  }>({
    completed: [],
    pending: [],
    inProgress: []
  });

  useEffect(() => {
    if (isOpen && student) {
      fetchHistory();
    }
  }, [isOpen, student]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Robust course matching logic
      let studentCourse = student.course || student.courseName;
      
      // Fallback: Check if we can find the course from the class
      if (!studentCourse && student.classId) {
        const classRef = doc(db, 'classes', student.classId);
        const classSnap = await getDocFromServer(classRef);
        if (classSnap.exists()) {
          studentCourse = classSnap.data().courseName || classSnap.data().course;
        }
      }

      // Default fallback
      if (!studentCourse) studentCourse = 'TEOLOGIA';

      // 1. Fetch all Disciplines (disciplinas -> grades collection)
      const disciplinasRef = collection(db, 'grades');
      const qDisciplinas = query(
        disciplinasRef, 
        where('course', '==', studentCourse)
      );
      
      let snapDisciplinas = await getDocs(qDisciplinas);
      
      // Fallback: If no disciplines found for course, fetch ALL as fallback
      if (snapDisciplinas.empty) {
        console.warn(`No subjects found for course: ${studentCourse}. Falling back to all subjects.`);
        snapDisciplinas = await getDocs(collection(db, 'grades'));
      }
      
      // Sort in-memory to avoid composite index requirements
      const allDisciplinas = snapDisciplinas.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
          if (a.year !== b.year) return String(a.year).localeCompare(String(b.year));
          return Number(a.module) - Number(b.module);
        });

      // 2. Fetch Student Grades (academic_grades -> academic_records collection)
      const academicGradesRef = collection(db, 'academic_records');
      const qGrades = query(
        academicGradesRef, 
        where('studentId', '==', student.id)
      );
      const snapGrades = await getDocs(qGrades);
      const studentGradesMap = new Map();
      snapGrades.forEach(doc => {
        studentGradesMap.set(doc.data().disciplinaId, doc.data());
      });

      // 3. Fetch "CURSANDO" (Subjects in the student's current class)
      let inProgressSubjectIds = new Set();
      if (student.classId) {
        // Option A: Check subject_enrollments
        const qEnrollments = query(
          collection(db, 'subject_enrollments'),
          where('studentId', '==', student.id),
          where('classId', '==', student.classId)
        );
        const snapEnrollments = await getDocs(qEnrollments);
        snapEnrollments.forEach(doc => {
          inProgressSubjectIds.add(doc.data().disciplinaId || doc.data().subjectName);
        });

        // Option B: Fallback to active modules for the class
        if (inProgressSubjectIds.size === 0) {
           const qModules = query(
             collection(db, 'modules_history'),
             where('classId', '==', student.classId)
           );
           const snapModules = await getDocs(qModules);
           snapModules.forEach(doc => {
             const moduleSubjects = doc.data().subjects || [];
             moduleSubjects.forEach((sub: string) => inProgressSubjectIds.add(sub));
           });
        }
      }

      // 4. Categorize
      const completed: any[] = [];
      const inProgress: any[] = [];
      const pending: any[] = [];

      allDisciplinas.forEach((disciplina: any) => {
        const record = studentGradesMap.get(disciplina.id);
        const grade = record?.nota ?? null;
        const status = record?.status || 'PD';
        
        const item = {
          ...disciplina,
          grade: grade,
          absences: record?.faltas ?? 0,
          status: status
        };

        if ((grade !== null && grade >= 7.0) || status === 'Dispensada') {
          completed.push(item);
        } else if (inProgressSubjectIds.has(disciplina.id) || inProgressSubjectIds.has(disciplina.name)) {
          inProgress.push(item);
        } else {
          pending.push(item);
        }
      });

      setHistory({ completed, pending, inProgress });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'academic_records');
    } finally {
      setLoading(false);
    }
  };

  const handleExemption = async (disciplina: any) => {
    if (!window.confirm(`Deseja registrar DISPENSA para a disciplina "${disciplina.name}"?`)) return;
    
    setProcessing(disciplina.id);
    try {
      // Pattern: studentId_disciplinaId_modulo
      const recordId = `${student.id}_${disciplina.id}_${disciplina.module || '1'}`;
      const recordRef = doc(db, 'academic_records', recordId);
      
      await setDoc(recordRef, {
        studentId: student.id,
        studentName: student.name,
        turmaId: student.classId || 'SEM_TURMA',
        disciplinaId: disciplina.id,
        disciplina: disciplina.name,
        ano: disciplina.year || '1º',
        modulo: disciplina.module || '1',
        nota: 0,
        faltas: 0,
        status: 'Dispensada',
        updatedAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        exemptionDate: serverTimestamp(),
        administeredBy: profile?.uid
      }, { merge: true });

      await fetchHistory();
    } catch (error) {
      console.error('Exemption error:', error);
      handleFirestoreError(error, OperationType.WRITE, 'academic_records');
    } finally {
      setProcessing(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            height: auto;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print { display: none !important; }
          .print-badge { 
            border: 1px solid #e2e8f0 !important;
            color: black !important;
            background: transparent !important;
          }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #f1f5f9; }
          .grid { display: block !important; }
          .shadow-sm, .shadow-2xl, .shadow-xl { shadow: none !important; filter: none !important; }
          .rounded-[2rem], .rounded-[2.5rem] { border-radius: 0 !important; }
        }
      `}} />
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-5xl bg-slate-50 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print-area"
        >
          {/* Header */}
          <div className="p-8 bg-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-navy text-white rounded-2xl shadow-lg shadow-navy/20 no-print">
                <Award size={24} />
              </div>
              <div className="hidden no-print:flex print:block">
                 <img src="/logo-esteadeb.png" alt="ESTEADEB" className="h-12 mb-2 hidden print:block" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-navy uppercase tracking-tight">Histórico Acadêmico</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aluno: {student.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden print:block mt-1">
                  Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 no-print">
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"
              >
                <X size={24} />
              </button>
            </div>
          </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-12 h-12 text-petrol animate-spin" />
              <p className="font-black text-slate-400 uppercase tracking-[0.2em] text-xs">Sincronizando Histórico...</p>
            </div>
          ) : (
            <>
              {/* Quick Summary & Manual Exemption */}
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Concluídas', count: history.completed.length, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
                    { label: 'Cursando', count: history.inProgress.length, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
                    { label: 'Pendentes', count: history.pending.length, color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertCircle },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                      <div className={cn("p-4 rounded-2xl", stat.bg, stat.color)}>
                        <stat.icon size={28} />
                      </div>
                      <div>
                        <h4 className={cn("text-3xl font-black tracking-tight", stat.color)}>{stat.count}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Manual Exemption Section for Admins */}
                {profile?.role === 'admin' && history.pending.length > 0 && (
                  <div className="bg-white p-6 rounded-3xl border border-dashed border-blue-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500 no-print">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-navy uppercase tracking-tight">Registro de Dispensa Manual</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Selecione uma disciplina da matriz para isentar</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <select 
                        className="flex-1 md:w-64 h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold text-xs"
                        onChange={(e) => {
                          const subject = history.pending.find(p => p.id === e.target.value);
                          if (subject) handleExemption(subject);
                          e.target.value = "";
                        }}
                      >
                        <option value="">-- Selecione para Dispensar --</option>
                        {history.pending.map(p => (
                          <option key={p.id} value={p.id}>
                            [{p.year} Ano] {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Sections */}
              <div className="space-y-12">
                {/* CURSANDO */}
                {history.inProgress.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-3 ml-2">
                      <div className="w-2 h-8 bg-amber-500 rounded-full" />
                      <h3 className="text-lg font-black text-navy uppercase tracking-tight">Cursando Atualmente</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {history.inProgress.map(item => (
                        <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-amber-200 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                              <BookOpen size={20} />
                            </div>
                            <div>
                              <p className="font-black text-navy uppercase text-sm tracking-tight">{item.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.year} Ano • Módulo {item.module}</p>
                            </div>
                          </div>
                          <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[10px] uppercase">Em Progresso</Badge>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* CONCLUÍDAS */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 ml-2">
                    <div className="w-2 h-8 bg-emerald-500 rounded-full" />
                    <h3 className="text-lg font-black text-navy uppercase tracking-tight">Disciplinas Concluídas</h3>
                  </div>
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Disciplina</th>
                          <th className="p-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Média Final</th>
                          <th className="p-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Faltas</th>
                          <th className="p-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {history.completed.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-10 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma disciplina concluída ainda.</td>
                          </tr>
                        ) : (
                          history.completed.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50/30 transition-all">
                              <td className="p-5">
                                <p className="font-black text-navy uppercase text-xs tracking-tight">{item.name}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.year} Ano • {item.workload}h</p>
                              </td>
                              <td className="p-5 text-center font-black text-emerald-600 text-base">
                                {item.status === 'Dispensada' ? '-' : (item.grade || 0).toFixed(1)}
                              </td>
                              <td className="p-5 text-center font-bold text-slate-500 text-xs">
                                {item.status === 'Dispensada' ? '-' : item.absences}
                              </td>
                              <td className="p-5 text-right">
                                {item.status === 'Dispensada' ? (
                                  <Badge className="bg-blue-50 text-blue-700 border-none font-black text-[9px] uppercase px-3">Dispensada</Badge>
                                ) : (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[9px] uppercase px-3">Aprovado</Badge>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* PENDENTES */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 ml-2">
                    <div className="w-2 h-8 bg-rose-500 rounded-full" />
                    <h3 className="text-lg font-black text-navy uppercase tracking-tight">Disciplinas Pendentes</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {history.pending.map(item => (
                        <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all group relative overflow-hidden">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="p-2 bg-rose-50 text-rose-500 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                <AlertCircle size={16} />
                              </div>
                              <p className="font-black text-navy uppercase text-[11px] leading-tight">{item.name}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.year} Ano • {item.workload}h</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-rose-100 text-rose-400">Pendente</Badge>
                              
                              {profile?.role === 'admin' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleExemption(item)}
                                  disabled={processing === item.id}
                                  className="h-7 px-2 text-[8px] font-black uppercase tracking-widest text-[#002147] hover:bg-navy/5 gap-1 shrink-0"
                                >
                                  {processing === item.id ? (
                                    <Loader2 size={10} className="animate-spin" />
                                  ) : (
                                    <ShieldCheck size={10} />
                                  )}
                                  Dispensar
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                    ))}
                    {history.pending.length === 0 && !loading && (
                      <div className="col-span-full p-8 bg-emerald-50 rounded-2xl border-2 border-dashed border-emerald-100 flex flex-col items-center gap-2 text-center">
                        <CheckCircle className="text-emerald-500" />
                        <p className="text-sm font-black text-emerald-700 uppercase tracking-widest">Todas as disciplinas obrigatórias concluídas!</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-100 border-t border-slate-200 flex justify-center no-print">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">ESTEADEB • Sistema Integrado de Gestão Acadêmica</p>
        </div>
      </motion.div>
    </div>
  </>
);
};
