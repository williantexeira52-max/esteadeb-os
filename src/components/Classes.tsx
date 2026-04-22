import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  ArrowUpCircle, 
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit2,
  Bell,
  Check,
  AlertTriangle,
  ChevronRight,
  Layers,
  BookOpen,
  Printer
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClassDiaryModal } from './ClassDiaryModal';
import { cn } from '@/lib/utils';

// Custom Toast Component for UX Upgrade
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-10 duration-300 ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      <p className="text-sm font-black uppercase tracking-wider">{message}</p>
      <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
};

export const Classes: React.FC = () => {
  const { nucleo, profile, user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [polos, setPolos] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    courseName: '',
    year: '1º Ano',
    vacancies: 40,
    status: 'Ativa'
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  // Real-time Sync for Classes
  useEffect(() => {
    if (!nucleo || !profile || !user) return;

    let q = query(
      collection(db, 'classes'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );

    if (profile?.poloId) {
      q = query(
        collection(db, 'classes'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('name', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClasses(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'classes');
      setLoading(false);
    });

    const unsubPolos = onSnapshot(
      query(
        collection(db, 'school_units'), 
        where('nucleoId', '==', nucleo),
        orderBy('name', 'asc')
      ), (snap) => {
      setPolos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubPolos();
    };
  }, [nucleo, profile, user]);

  // Real-time Sync for Courses (to populate dropdown)
  useEffect(() => {
    if (!nucleo || !user) return;
    const q = query(
      collection(db, 'courses'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setCourses(list);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Sync for All Students (for enrollment)
  useEffect(() => {
    if (!nucleo || !profile || !user) return;
    let q = query(
      collection(db, 'students'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );

    if (profile?.poloId) {
      q = query(
        collection(db, 'students'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('name', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((s: any) => !s.deleted && s.status !== 'inativo');
      
      // Strict Deduplication by Normalized CPF or ID/Name fallback
      const seen = new Set();
      const uniqueStudents = studentList.filter((s: any) => {
        const normalizedCpf = s.cpf?.toString().replace(/\D/g, '');
        const key = normalizedCpf || s.name?.toLowerCase().trim() || s.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      setAllStudents(uniqueStudents);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (cls: any = null) => {
    if (cls) {
      setEditingClass(cls);
      setFormData({
        name: cls.name || '',
        courseName: cls.courseName || '',
        year: cls.year || '1º Ano',
        vacancies: cls.vacancies || 40,
        status: cls.status || 'Ativa'
      });
    } else {
      setEditingClass(null);
      setFormData({
        name: '',
        courseName: courses[0]?.name || '',
        year: '1º Ano',
        vacancies: 40,
        status: 'Ativa'
      });
    }
    setIsModalOpen(true);
  };

  const [newClassPolo, setNewClassPolo] = useState({ id: '', name: 'MATRIZ' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasPolo = nucleo === 'SEMIPRESENCIAL';
    const poloId = hasPolo ? (profile?.poloId || newClassPolo.id) : '';
    const poloName = hasPolo ? (profile?.poloName || newClassPolo.name) : 'MATRIZ';

    try {
      if (editingClass) {
        await updateDoc(doc(db, 'classes', editingClass.id), {
          ...formData,
          poloId,
          poloName,
          updatedAt: serverTimestamp()
        });
        showToast("Turma atualizada com sucesso!", "success");
      } else {
        await addDoc(collection(db, 'classes'), {
          ...formData,
          enrolled: 0,
          nucleoId: nucleo,
          poloId,
          poloName,
          createdAt: serverTimestamp(),
          createdBy: profile?.uid || 'system'
        });
        showToast("Nova turma criada com sucesso!", "success");
      }
      setIsModalOpen(false);
    } catch (error) {
      showToast("Erro ao salvar dados no Firestore.", "error");
      handleFirestoreError(error, editingClass ? OperationType.UPDATE : OperationType.CREATE, 'classes');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    
    // OPTIMISTIC UI: Remove from screen immediately
    setClasses(prev => prev.filter(c => c.id !== id));
    setDeleteConfirm(null);

    try {
      await deleteDoc(doc(db, 'classes', id));
      showToast("Turma excluída com sucesso.", "success");
    } catch (error) {
      showToast("Erro ao excluir turma.", "error");
      handleFirestoreError(error, OperationType.DELETE, 'classes');
    }
  };

  const handlePromote = async (cls: any) => {
    let nextYear = '';
    if (cls.year === '1º Ano') nextYear = '2º Ano';
    else if (cls.year === '2º Ano') nextYear = '3º Ano';
    else {
      showToast("Ciclo máximo atingido (3º Ano).", "error");
      return;
    }

    // String manipulation to increment number in name if present (e.g., "Teologia 1" -> "Teologia 2")
    const incrementName = (name: string) => {
      const match = name.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        return name.replace(/\d+$/, (num + 1).toString());
      }
      return name;
    };

    const newName = incrementName(cls.name);

    try {
      await updateDoc(doc(db, 'classes', cls.id), {
        name: newName,
        year: nextYear,
        updatedAt: serverTimestamp()
      });
      showToast(`Turma promovida para ${newName} (${nextYear})!`, "success");
    } catch (error) {
      showToast("Erro ao promover turma.", "error");
      handleFirestoreError(error, OperationType.UPDATE, 'classes');
    }
  };

  const enrollStudent = async (student: any) => {
    if (!selectedClass) return;
    
    try {
      // Update Student
      await updateDoc(doc(db, 'students', student.id), {
        classId: selectedClass.id,
        className: selectedClass.name,
        updatedAt: serverTimestamp()
      });

      // Update Class
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        studentIds: arrayUnion(student.id),
        enrolled: increment(1),
        updatedAt: serverTimestamp()
      });

      showToast(`${student.name} matriculado com sucesso!`, "success");
    } catch (error) {
      showToast("Erro ao matricular aluno.", "error");
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    }
  };

  const unenrollStudent = async (studentId: string, studentName: string) => {
    if (!selectedClass) return;

    try {
      // Update Student
      await updateDoc(doc(db, 'students', studentId), {
        classId: null,
        className: null,
        updatedAt: serverTimestamp()
      });

      // Update Class
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        studentIds: arrayRemove(studentId),
        enrolled: increment(-1),
        updatedAt: serverTimestamp()
      });

      showToast(`${studentName} removido da turma.`, "success");
    } catch (error) {
      showToast("Erro ao remover aluno.", "error");
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    }
  };

  // Instant Search (In-Memory Filtering)
  const filteredClasses = useMemo(() => {
    return classes.filter(cls => 
      (cls.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cls.courseName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [classes, searchTerm]);

  const enrolledStudents = useMemo(() => {
    if (!selectedClass) return [];
    return allStudents.filter(s => selectedClass.studentIds?.includes(s.id) || s.classId === selectedClass.id);
  }, [allStudents, selectedClass]);

  const availableStudents = useMemo(() => {
    if (!selectedClass) return [];
    return allStudents.filter(s => 
      s.classId !== selectedClass.id && 
      !selectedClass.studentIds?.includes(s.id) &&
      (s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || String(s.matricula || '').includes(studentSearchTerm))
    );
  }, [allStudents, selectedClass, studentSearchTerm]);

  const [activeTab, setActiveTab] = useState<'students' | 'diarios'>('students');
  const [classModules, setClassModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [subjectEnrollments, setSubjectEnrollments] = useState<any[]>([]);
  const [academicRecords, setAcademicRecords] = useState<any[]>([]);
  const [isCrossEnrollmentModalOpen, setIsCrossEnrollmentModalOpen] = useState(false);
  const [crossEnrollmentSearch, setCrossEnrollmentSearch] = useState('');

  const crossEnrollmentStudents = useMemo(() => {
    return allStudents.filter(s => 
      s.classId !== selectedClass?.id && 
      !subjectEnrollments.some(e => e.studentId === s.id) &&
      (s.name.toLowerCase().includes(crossEnrollmentSearch.toLowerCase()) || String(s.matricula || '').includes(crossEnrollmentSearch))
    );
  }, [allStudents, selectedClass, subjectEnrollments, crossEnrollmentSearch]);

  const enrollExtraStudent = async (student: any) => {
    if (!selectedClass || !selectedSubject) return;
    try {
      await addDoc(collection(db, 'subject_enrollments'), {
        classId: selectedClass.id,
        studentId: student.id,
        studentName: student.name,
        studentMatricula: student.matricula,
        subjectName: selectedSubject,
        status: 'Ativo',
        type: 'Extra',
        createdAt: serverTimestamp()
      });
      setIsCrossEnrollmentModalOpen(false);
      setCrossEnrollmentSearch('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subject_enrollments');
    }
  };

  useEffect(() => {
    if (!selectedClass) return;
    const q = query(collection(db, 'modules_history'), where('classId', '==', selectedClass.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClassModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    const q = query(
      collection(db, 'subject_enrollments'), 
      where('classId', '==', selectedClass.id),
      where('subjectName', '==', selectedSubject)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubjectEnrollments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Also fetch Academic Records to check for Exemptions (Dispensa)
    const qRecords = query(
      collection(db, 'academic_records'),
      where('turmaId', '==', selectedClass.id),
      where('disciplina', '==', selectedSubject)
    );
    const unsubscribeRecords = onSnapshot(qRecords, (snapshot) => {
      setAcademicRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeRecords();
    };
  }, [selectedClass, selectedSubject]);

  const handleSelectAll = async () => {
    if (!selectedClass || !selectedSubject) return;
    
    try {
      const batch = writeBatch(db);
      
      enrolledStudents.forEach(student => {
        const isAlreadyEnrolled = subjectEnrollments.some(e => e.studentId === student.id);
        const record = academicRecords.find(r => r.studentId === student.id);
        const isExempt = record?.status === 'Dispensada';

        if (!isAlreadyEnrolled && !isExempt) {
          const newDocRef = doc(collection(db, 'subject_enrollments'));
          batch.set(newDocRef, {
            classId: selectedClass.id,
            studentId: student.id,
            studentName: student.name,
            studentMatricula: student.matricula,
            subjectName: selectedSubject,
            status: 'Ativo',
            createdAt: serverTimestamp()
          });
        }
      });
      
      await batch.commit();
      showToast("Todos os alunos aptos foram enturmados!", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subject_enrollments');
    }
  };

  const toggleSubjectEnrollment = async (student: any, isEnrolled: boolean) => {
    if (!selectedClass || !selectedSubject) return;
    
    try {
      if (isEnrolled) {
        // Unenroll
        const enrollment = subjectEnrollments.find(e => e.studentId === student.id);
        if (enrollment) {
          await deleteDoc(doc(db, 'subject_enrollments', enrollment.id));
        }
      } else {
        // Enroll
        await addDoc(collection(db, 'subject_enrollments'), {
          classId: selectedClass.id,
          studentId: student.id,
          studentName: student.name,
          studentMatricula: student.matricula,
          subjectName: selectedSubject,
          status: 'Ativo',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subject_enrollments');
    }
  };

  if (selectedClass) {
    const cls = classes.find(c => c.id === selectedClass.id) || selectedClass;
    const enrolled = cls.enrolled || 0;
    const vacancies = cls.vacancies || 0;
    const isFull = enrolled >= vacancies && vacancies > 0;

    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedClass(null)}
              className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-600"
            >
              <X size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{cls.name}</h1>
              <p className="text-slate-500 font-medium">{cls.courseName} • {cls.year}</p>
            </div>
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
            <button
              onClick={() => setActiveTab('students')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'students' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:text-navy"
              )}
            >
              Alunos
            </button>
            <button
              onClick={() => setActiveTab('diarios')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'diarios' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:text-navy"
              )}
            >
              Diários / Enturmação
            </button>
          </div>
        </div>

        {activeTab === 'students' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <h3 className="text-lg font-black text-navy uppercase tracking-tight flex items-center gap-2">
                  <Users size={20} className="text-indigo-600" />
                  Status da Turma
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <span className="text-xs font-bold text-slate-500 uppercase">Ocupação</span>
                    <div className="text-right">
                      <p className={`text-xl font-black ${isFull ? 'text-red-600' : 'text-navy'}`}>{enrolled} / {vacancies}</p>
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                        <div 
                          className={`h-full ${isFull ? 'bg-red-500' : 'bg-indigo-600'}`}
                          style={{ width: `${Math.min((enrolled / (vacancies || 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                    <Badge className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      cls.status === 'Ativa' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    )}>
                      {cls.status}
                    </Badge>
                  </div>
                </div>
                <Button 
                  onClick={() => setIsEnrollmentModalOpen(true)}
                  disabled={isFull}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"
                >
                  <Plus size={20} />
                  Matricular Aluno
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xl font-black text-navy uppercase tracking-tight">Alunos Matriculados</h3>
                  <Badge className="bg-indigo-50 text-indigo-600 font-black">{enrolledStudents.length} Alunos</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aluno</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matrícula</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {enrolledStudents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhum aluno matriculado nesta turma.</td>
                        </tr>
                      ) : (
                        enrolledStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-all group">
                            <td className="p-6">
                              <p className="font-black text-navy uppercase text-sm tracking-tight">{student.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{student.email}</p>
                            </td>
                            <td className="p-6">
                              <Badge variant="outline" className="font-mono text-[10px]">{student.matricula}</Badge>
                            </td>
                            <td className="p-6 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => unenrollStudent(student.id, student.name)}
                                className="text-red-500 hover:bg-red-50 font-black uppercase text-[10px] tracking-widest gap-2"
                              >
                                <Trash2 size={14} />
                                Remover
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-navy uppercase tracking-tight">Diários de Classe</h3>
                  <p className="text-slate-500 font-medium">Gerencie a enturmação de alunos por disciplina.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classModules.map(mod => (
                  <div key={mod.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-navy text-white uppercase text-[10px] font-black">Módulo {mod.moduleNumber}</Badge>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{mod.academicYear} • {mod.semester}</span>
                    </div>
                    <div className="space-y-2">
                      {mod.subjects?.map((sub: string) => (
                        <button
                          key={sub}
                          onClick={() => {
                            setSelectedModule(mod);
                            setSelectedSubject(sub);
                          }}
                          className={cn(
                            "w-full p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between group",
                            selectedSubject === sub ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-100 text-slate-600 hover:border-indigo-100"
                          )}
                        >
                          <span className="text-xs font-bold uppercase">{sub}</span>
                          <ChevronRight size={14} className={cn("transition-transform", selectedSubject === sub ? "translate-x-1" : "opacity-0 group-hover:opacity-100")} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {classModules.length === 0 && (
                  <div className="col-span-full p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300">
                      <Layers size={32} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum módulo histórico encontrado para esta turma.</p>
                  </div>
                )}
              </div>
            </div>

            {selectedSubject && (
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h4 className="text-xl font-black text-navy uppercase tracking-tight">Lista de Alunos: {selectedSubject}</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Módulo {selectedModule?.moduleNumber} • {selectedModule?.academicYear}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      onClick={handleSelectAll}
                      variant="outline" size="sm" className="gap-2 text-[10px] font-black uppercase tracking-widest h-10 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    >
                      <CheckCircle2 size={14} /> Enturmar Todos
                    </Button>
                    <Button 
                      onClick={() => setIsDiaryModalOpen(true)}
                      variant="outline" size="sm" className="gap-2 text-[10px] font-black uppercase tracking-widest h-10 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                      <Printer size={14} /> Diário Físico
                    </Button>
                    <Badge className="bg-emerald-100 text-emerald-700 font-black">{subjectEnrollments.length} Enturmados</Badge>
                    <Button 
                      onClick={() => setIsCrossEnrollmentModalOpen(true)}
                      variant="outline" size="sm" className="gap-2 text-[10px] font-black uppercase tracking-widest h-10 border-slate-200"
                    >
                      <Plus size={14} /> Aluno Extra
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-50">
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aluno</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matrícula</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {/* Native Students */}
                      {enrolledStudents.map((student) => {
                        const enrollment = subjectEnrollments.find(e => e.studentId === student.id);
                        const isEnrolled = !!enrollment;
                        const record = academicRecords.find(r => r.studentId === student.id);
                        const isExempt = record?.status === 'Dispensada';

                        return (
                          <tr key={student.id} className={cn("hover:bg-slate-50/50 transition-all group", isExempt && "bg-blue-50/20 opacity-70")}>
                            <td className="p-6 text-center">
                              {isExempt ? (
                                <Badge className="bg-blue-100 text-blue-600 text-[8px] font-black uppercase">Isento</Badge>
                              ) : (
                                <button 
                                  onClick={() => toggleSubjectEnrollment(student, isEnrolled)}
                                  className={cn(
                                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all mx-auto",
                                    isEnrolled ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 hover:border-emerald-200"
                                  )}
                                >
                                  {isEnrolled && <Check size={14} />}
                                </button>
                              )}
                            </td>
                            <td className="p-6">
                              <p className="font-black text-navy uppercase text-sm tracking-tight">{student.name}</p>
                              {isExempt ? (
                                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Possui Dispensa Lançada</p>
                              ) : isEnrolled ? (
                                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Enturmado nesta disciplina</p>
                              ) : (
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aguardando Enturmação</p>
                              )}
                            </td>
                            <td className="p-6">
                              <Badge variant="outline" className="font-mono text-[10px]">{student.matricula}</Badge>
                            </td>
                            <td className="p-6 text-right">
                              <Badge className="bg-slate-100 text-slate-500 text-[8px] uppercase font-black">Nativo</Badge>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Extra Students */}
                      {subjectEnrollments.filter(e => e.type === 'Extra').map((enrollment) => (
                        <tr key={enrollment.id} className="hover:bg-slate-50/50 transition-all group bg-amber-50/30">
                          <td className="p-6">
                            <button 
                              onClick={() => deleteDoc(doc(db, 'subject_enrollments', enrollment.id))}
                              className="w-6 h-6 rounded-lg bg-red-500 text-white flex items-center justify-center transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                          <td className="p-6">
                            <p className="font-black text-navy uppercase text-sm tracking-tight">{enrollment.studentName}</p>
                          </td>
                          <td className="p-6">
                            <Badge variant="outline" className="font-mono text-[10px]">{enrollment.studentMatricula}</Badge>
                          </td>
                          <td className="p-6 text-right">
                            <Badge className="bg-amber-100 text-amber-700 text-[8px] uppercase font-black">Extra (Interturmas)</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cross-Enrollment Modal */}
        {isCrossEnrollmentModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-amber-600 p-8 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <ArrowUpCircle size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Matrícula Interturmas</h2>
                    <p className="text-xs text-amber-100 font-bold uppercase tracking-widest">Adicionar aluno de outra turma em {selectedSubject}</p>
                  </div>
                </div>
                <button onClick={() => setIsCrossEnrollmentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={28} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="search"
                    placeholder="Pesquisar aluno em outras turmas..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-500 outline-none text-sm font-bold transition-all"
                    value={crossEnrollmentSearch}
                    onChange={(e) => setCrossEnrollmentSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {crossEnrollmentStudents.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest bg-slate-50 rounded-3xl">
                      Nenhum aluno encontrado para matrícula extra.
                    </div>
                  ) : (
                    crossEnrollmentStudents.map((student) => (
                      <div 
                        key={student.id}
                        className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-amber-100 transition-all group"
                      >
                        <div>
                          <p className="font-black text-navy uppercase text-sm tracking-tight">{student.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-400 font-mono">MAT: {student.matricula}</span>
                            <Badge className="bg-slate-100 text-slate-500 text-[8px] uppercase">Turma: {student.className || 'N/A'}</Badge>
                          </div>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => enrollExtraStudent(student)}
                          className="bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl px-4"
                        >
                          Matricular
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="p-8 bg-slate-50 flex justify-end">
                <Button 
                  onClick={() => setIsCrossEnrollmentModalOpen(false)}
                  className="bg-navy text-white px-8 h-12 rounded-xl font-black uppercase tracking-widest"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}
        {isEnrollmentModalOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-indigo-600 p-8 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <Users size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Matricular Alunos</h2>
                    <p className="text-xs text-indigo-100 font-bold uppercase tracking-widest">Adicionar alunos à turma {cls.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsEnrollmentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={28} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="search"
                    placeholder="Pesquisar aluno por nome ou matrícula..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none text-sm font-bold transition-all"
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {availableStudents.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest bg-slate-50 rounded-3xl">
                      Nenhum aluno disponível para matrícula.
                    </div>
                  ) : (
                    availableStudents.map((student) => (
                      <div 
                        key={student.id}
                        className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-indigo-100 transition-all group"
                      >
                        <div>
                          <p className="font-black text-navy uppercase text-sm tracking-tight">{student.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-400 font-mono">MAT: {student.matricula}</span>
                            {student.className && (
                              <Badge className="bg-slate-100 text-slate-500 text-[8px] uppercase">Já em: {student.className}</Badge>
                            )}
                          </div>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => enrollStudent(student)}
                          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl px-4"
                        >
                          Selecionar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="p-8 bg-slate-50 flex justify-end">
                <Button 
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="bg-navy text-white px-8 h-12 rounded-xl font-black uppercase tracking-widest"
                >
                  Concluir
                </Button>
              </div>
            </div>
          </div>
        )}

        <ClassDiaryModal 
          isOpen={isDiaryModalOpen} 
          onClose={() => setIsDiaryModalOpen(false)} 
          targetClass={selectedClass}
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Confirmar Exclusão</h3>
                <p className="text-slate-500 text-sm mt-2">
                  Deseja realmente apagar a turma <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  Apagar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Gestão de Turmas Master</h1>
          <p className="text-slate-500 font-medium">Controle de ocupação, níveis e promoções acadêmicas.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all text-sm font-black shadow-lg shadow-indigo-200 uppercase tracking-widest"
        >
          <Plus size={20} />
          Nova Turma
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="search"
            placeholder="Pesquisar por nome da turma ou curso vinculado..."
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none text-sm font-bold transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Ativas</p>
            <p className="text-xl font-black text-slate-900">{classes.filter(c => c.status === 'Ativa').length}</p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificação da Turma</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Curso / Ciclo Atual</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ocupação</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="font-bold uppercase tracking-widest text-xs">Sincronizando dados...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <Users size={32} className="opacity-20 text-slate-900" />
                      </div>
                      <p className="font-bold uppercase tracking-widest text-xs">Nenhuma turma encontrada.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls) => {
                  const enrolled = cls.enrolled || 0;
                  const vacancies = cls.vacancies || 0;
                  const isFull = enrolled >= vacancies && vacancies > 0;

                  return (
                    <tr key={cls.id} className="hover:bg-indigo-50/30 transition-all group">
                      <td className="p-6">
                        <p className="font-black text-slate-900 uppercase text-sm tracking-tight">{cls.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">REF: {cls.id.slice(0, 8)}</p>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-700 text-xs font-black uppercase">{cls.courseName}</span>
                          <span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest">{cls.year}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          cls.status === 'Ativa' ? 'bg-emerald-100 text-emerald-700' : 
                          cls.status === 'Inativa' ? 'bg-red-100 text-red-700' : 
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {cls.status}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className={`text-sm font-black ${isFull ? 'text-red-600' : 'text-slate-900'}`}>
                            {enrolled} / {vacancies}
                          </span>
                          <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-700 ${isFull ? 'bg-red-500' : 'bg-indigo-600'}`}
                              style={{ width: `${Math.min((enrolled / (vacancies || 1)) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => setSelectedClass(cls)}
                            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            title="Ver Detalhes / Alunos"
                          >
                            <Users size={20} />
                          </button>
                          <button 
                            onClick={() => handlePromote(cls)}
                            className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Promover Ciclo"
                          >
                            <ArrowUpCircle size={20} />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(cls)}
                            className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Editar Turma"
                          >
                            <Edit2 size={20} />
                          </button>
                          <button 
                            onClick={() => handleDelete(cls.id, cls.name)}
                            className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Excluir Permanentemente"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Exibindo <span className="text-indigo-600">{filteredClasses.length}</span> turmas no núcleo <span className="text-indigo-600">{nucleo}</span>.
          </p>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 uppercase font-black tracking-widest">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              Live Sync Active
            </div>
            <Bell size={14} />
          </div>
        </div>
      </div>

      {/* Modal Section */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <h2 className="font-black uppercase tracking-tight">
                  {editingClass ? 'Editar Registro' : 'Nova Turma'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Turma</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all"
                  placeholder="Ex: Teologia 2026 - Noite"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Curso Vinculado</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all appearance-none"
                    value={formData.courseName}
                    onChange={e => setFormData({...formData, courseName: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.name}>{course.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ciclo / Ano</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all appearance-none"
                    value={formData.year}
                    onChange={e => setFormData({...formData, year: e.target.value})}
                  >
                    <option value="1º Ano">1º Ano</option>
                    <option value="2º Ano">2º Ano</option>
                    <option value="3º Ano">3º Ano</option>
                    <option value="Módulo Único">Módulo Único</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vagas Totais</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all"
                    value={formData.vacancies}
                    onChange={e => setFormData({...formData, vacancies: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Operacional</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all appearance-none"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Ativa">Ativa</option>
                    <option value="Inativa">Inativa</option>
                    <option value="Concluída">Concluída</option>
                  </select>
                </div>
              </div>

              {nucleo === 'SEMIPRESENCIAL' && !profile?.poloId && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Polo de Apoio</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all appearance-none"
                    value={newClassPolo.id}
                    onChange={e => {
                      const p = polos.find(poly => poly.id === e.target.value);
                      setNewClassPolo({ id: e.target.value, name: p?.name || 'MATRIZ' });
                    }}
                  >
                    <option value="">Selecione o Polo...</option>
                    {polos.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border-2 border-slate-100 rounded-xl font-black text-slate-400 hover:bg-slate-50 transition-all text-sm uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-all text-sm shadow-lg shadow-indigo-100 uppercase tracking-widest"
                >
                  {editingClass ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
