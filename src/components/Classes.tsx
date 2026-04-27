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

import { GlobalDeficitModal } from './GlobalDeficitModal';

export const Classes: React.FC = () => {
  const { nucleo, profile, user, isAdmin } = useAuth();
  const [isDeficitModalOpen, setIsDeficitModalOpen] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [polos, setPolos] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'Ativa' | 'Concluída' | 'Inativa' | 'Todas'>('Ativa');
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
    status: 'Em Andamento'
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'school_units');
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
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
        status: cls.status || 'Em Andamento'
      });
      if (cls.poloId) {
        setNewClassPolo({ id: cls.poloId, name: cls.poloName || 'MATRIZ' });
      }
    } else {
      setEditingClass(null);
      setFormData({
        name: '',
        courseName: courses[0]?.name || '',
        year: '1º Ano',
        vacancies: 40,
        status: 'Em Andamento'
      });
      // Auto-set polo if restricted
      if (profile?.poloId && profile.poloId !== 'none') {
        setNewClassPolo({ id: profile.poloId, name: profile.poloName || 'MATRIZ' });
      } else {
        setNewClassPolo({ id: '', name: 'MATRIZ' });
      }
    }
    setIsModalOpen(true);
  };

  const [newClassPolo, setNewClassPolo] = useState({ id: '', name: 'MATRIZ' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasPolo = nucleo === 'SEMIPRESENCIAL';
    const poloId = hasPolo ? (profile?.poloId && profile.poloId !== 'none' ? profile.poloId : newClassPolo.id) : '';
    const poloName = hasPolo ? (profile?.poloId && profile.poloId !== 'none' ? profile.poloName : newClassPolo.name) : 'MATRIZ';

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

  const handleStatusChange = async (id: string, currentStatus: string, newStatus: string) => {
    if (currentStatus === newStatus) return;
    try {
      await updateDoc(doc(db, 'classes', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      showToast('Status atualizado com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'classes');
      showToast('Erro ao atualizar status.', 'error');
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

  // Instant Search & Status (In-Memory Filtering)
  const filteredClasses = useMemo(() => {
    let filtered = classes;
    if (statusFilter !== 'Todas') {
      filtered = filtered.filter(c => c.status === statusFilter || (!c.status && statusFilter === 'Ativa'));
    }
    return filtered.filter(cls => 
      (cls.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cls.courseName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [classes, searchTerm, statusFilter]);

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

  const [activeTab, setActiveTab] = useState<'students' | 'diarios' | 'progresso'>('students');
  const [classModules, setClassModules] = useState<any[]>([]);
  const [curriculum, setCurriculum] = useState<any[]>([]);
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'modules_history');
    });
    return () => unsubscribe();
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass || !selectedClass.courseName || !nucleo) return;
    const qCurriculum = query(
      collection(db, 'grades'),
      where('nucleoId', '==', nucleo)
    );
    const unsubscribe = onSnapshot(qCurriculum, (snapshot) => {
      const allGrades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const expectedCourse = selectedClass.courseName.toLowerCase().trim();
      const filtered = allGrades.filter(g => {
        const gradeCourse = (g.course || '').toLowerCase().trim();
        return gradeCourse === expectedCourse;
      });
      setCurriculum(filtered);
    }, (error) => {});
    return () => unsubscribe();
  }, [selectedClass, nucleo]);

  const classProgress = useMemo(() => {
    if (!selectedClass || !curriculum.length) return { completed: [], pending: [], percentage: 0, duplicates: [] };
    
    const completedSubjects = new Set<string>();
    const completedList: any[] = [];
    
    classModules.forEach(mod => {
      if (mod.subjects) {
        Array.from(new Set(mod.subjects)).forEach((sub: unknown) => {
          const subjectName = String(sub);
          completedSubjects.add(subjectName.toLowerCase().trim());
          completedList.push({
            name: subjectName,
            period: `${mod.academicYear} / ${mod.semester}`,
            professor: mod.professorsNotes || '--',
            moduleId: mod.id,
            moduleNumber: mod.moduleNumber
          });
        });
      }
    });

    const pendingList: any[] = [];
    let matchCount = 0;
    
    const seenGrades = new Set<string>();
    const duplicates: string[] = [];

    curriculum.forEach(grade => {
      const gradeNameLower = (grade.name || '').toLowerCase().trim();
      
      if (seenGrades.has(gradeNameLower)) {
        if (!duplicates.includes(grade.name)) duplicates.push(grade.name);
      } else {
        seenGrades.add(gradeNameLower);
      }

      if (completedSubjects.has(gradeNameLower)) {
        matchCount++;
      } else {
        pendingList.push({
          name: grade.name,
          workload: grade.workload || '--'
        });
      }
    });

    const totalRequired = curriculum.length;
    const percentage = totalRequired > 0 ? Math.round((matchCount / totalRequired) * 100) : 0;

    return { completed: completedList, pending: pendingList, percentage, duplicates };
  }, [selectedClass, curriculum, classModules]);

  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    const q = query(
      collection(db, 'subject_enrollments'), 
      where('classId', '==', selectedClass.id),
      where('subjectName', '==', selectedSubject)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubjectEnrollments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subject_enrollments');
    });

    // Also fetch Academic Records to check for Exemptions (Dispensa)
    const qRecords = query(
      collection(db, 'academic_records'),
      where('turmaId', '==', selectedClass.id),
      where('disciplina', '==', selectedSubject)
    );
    const unsubscribeRecords = onSnapshot(qRecords, (snapshot) => {
      setAcademicRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'academic_records');
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
        
        // Late Joiner Check
        let isLateJoiner = false;
        if (selectedModule?.startDate && student.enrollmentDate) {
          const modDate = new Date(selectedModule.startDate);
          const enrDate = new Date(student.enrollmentDate);
          if (enrDate > modDate) {
            isLateJoiner = true;
          }
        }

        if (!isAlreadyEnrolled && !isExempt && !isLateJoiner) {
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
      showToast("Alunos aptos enturmados! Alunos com matrícula posterior à data do módulo foram ignorados.", "success");
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
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm flex-wrap">
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
              Diários
            </button>
            <button
              onClick={() => setActiveTab('progresso')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'progresso' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:text-navy"
              )}
            >
              Progresso
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
                              <div className="flex items-center gap-2">
                                <p className={cn("font-black text-navy uppercase text-sm tracking-tight", student.status === 'Evadido' || student.status === 'Trancado' ? "line-through text-slate-400" : "")}>{student.name}</p>
                                {student.status === 'Trancado' && <Badge className="bg-orange-100 text-orange-700 text-[8px] font-black uppercase">Trancado</Badge>}
                                {student.status === 'Evadido' && <Badge className="bg-red-100 text-red-700 text-[8px] font-black uppercase">Evadido</Badge>}
                                {student.status === 'Concluído' && <Badge className="bg-purple-100 text-purple-700 text-[8px] font-black uppercase">Concluído</Badge>}
                              </div>
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
        ) : activeTab === 'diarios' ? (
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
                      {Array.from(new Set(mod.subjects || [])).map((sub: unknown) => {
                        const subjectName = String(sub);
                        return (
                        <button
                          key={subjectName}
                          onClick={() => {
                            setSelectedModule(mod);
                            setSelectedSubject(subjectName);
                          }}
                          className={cn(
                            "w-full p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between group",
                            selectedSubject === subjectName ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-100 text-slate-600 hover:border-indigo-100"
                          )}
                        >
                          <span className="text-xs font-bold uppercase">{subjectName}</span>
                          <ChevronRight size={14} className={cn("transition-transform", selectedSubject === subjectName ? "translate-x-1" : "opacity-0 group-hover:opacity-100")} />
                        </button>
                      )})}
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

                <div className="bg-amber-50 border-y border-amber-100 p-4 flex items-start gap-3">
                  <div className="mt-0.5"><AlertCircle size={16} className="text-amber-600"/></div>
                  <div>
                    <h5 className="text-xs font-black uppercase text-amber-800 tracking-widest">Dica: Alunos que entraram no meio do ano</h5>
                    <p className="text-[10px] sm:text-xs text-amber-700 font-medium mt-1">Ao usar "Enturmar Todos", os alunos novatos (caronas) também receberão o status verde. Se a matrícula do aluno for <strong>POSTERIOR</strong> a essa disciplina, simplesmente <strong>desmarque-o (X)</strong> na lista abaixo. Assim o nome dele não aparecerá nos apontamentos deste módulo passado.</p>
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
                        
                        let isLateJoiner = false;
                        if (selectedModule?.startDate && student.enrollmentDate) {
                          const modDate = new Date(selectedModule.startDate);
                          const enrDate = new Date(student.enrollmentDate);
                          if (enrDate > modDate) {
                            isLateJoiner = true;
                          }
                        }

                        return (
                          <tr key={student.id} className={cn("hover:bg-slate-50/50 transition-all group", isExempt && "bg-blue-50/20 opacity-70", isLateJoiner && !isEnrolled && "bg-amber-50/10 opacity-60")}>
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
                              <div className="flex items-center gap-2">
                                <p className={cn("font-black text-navy uppercase text-sm tracking-tight", student.status === 'Evadido' || student.status === 'Trancado' ? "line-through text-slate-400" : "")}>{student.name}</p>
                                {student.status === 'Trancado' && <Badge className="bg-orange-100 text-orange-700 text-[8px] font-black uppercase tracking-widest border border-orange-200">Trancado</Badge>}
                                {student.status === 'Evadido' && <Badge className="bg-red-100 text-red-700 text-[8px] font-black uppercase tracking-widest border border-red-200">Evadido</Badge>}
                                {isLateJoiner && (
                                  <Badge className="bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-widest border border-amber-200">Data Posterior</Badge>
                                )}
                              </div>
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
        ) : activeTab === 'progresso' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <style>
              {`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #print-progress-report, #print-progress-report * {
                    visibility: visible;
                  }
                  #print-progress-report {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 20px;
                    background: white;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}
            </style>

            {classProgress.duplicates.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-red-600">
                  <AlertCircle size={32} />
                  <div>
                    <h4 className="font-black uppercase tracking-tight text-sm">Disciplinas Duplicadas Encontradas</h4>
                    <p className="text-xs font-medium text-red-500 mt-1">
                      Você possui disciplinas cadastradas mais de uma vez na matriz deste curso. Por favor, vá até a aba "Disciplinas" e exclua as duplicatas para corrigir o progresso.
                    </p>
                  </div>
                </div>
                <div className="text-xs font-black uppercase text-red-700 bg-red-100 px-4 py-2 rounded-xl">
                  {classProgress.duplicates.join(', ')}
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden p-8" id="print-progress-report">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-navy uppercase tracking-tight">Progresso da Turma: {selectedClass.name}</h3>
                  <p className="text-slate-500 font-medium">{selectedClass.courseName} • {selectedClass.year}</p>
                </div>
                <button 
                  onClick={() => window.print()} 
                  className="no-print bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-navy transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Printer size={16} /> Imprimir Relatório
                </button>
              </div>

              <div className="space-y-4 mb-10 no-print">
                <div className="flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-500">
                  <span>Conclusão Curricular</span>
                  <span className={cn(
                    classProgress.percentage === 100 ? "text-emerald-500" : "text-indigo-600"
                  )}>{classProgress.percentage}% Completo</span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000",
                      classProgress.percentage === 100 ? "bg-emerald-500" : "bg-indigo-600"
                    )}
                    style={{ width: `${classProgress.percentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Completed Subjects */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-emerald-600">
                    <CheckCircle2 size={24} />
                    <h4 className="text-lg font-black uppercase tracking-tight">Disciplinas Concluídas ({classProgress.completed.length})</h4>
                  </div>
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 print:bg-slate-100">
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Disciplina</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Período</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Professor</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right print:text-black">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                        {classProgress.completed.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma disciplina cursada</td>
                          </tr>
                        ) : (
                          classProgress.completed.map((sub, idx) => (
                            <tr key={`comp-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-black text-navy uppercase text-sm print:text-black">{sub.name}</td>
                              <td className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest print:text-gray-700">{sub.period} (Mod. {sub.moduleNumber})</td>
                              <td className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest print:text-gray-700">{sub.professor}</td>
                              <td className="p-4 text-right">
                                <Badge className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest print:border print:border-gray-500 print:text-black print:bg-transparent">Concluída</Badge>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pending Subjects */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-amber-600 outline-none">
                    <AlertCircle size={24} />
                    <h4 className="text-lg font-black uppercase tracking-tight">Disciplinas Pendentes ({classProgress.pending.length})</h4>
                  </div>
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 print:bg-slate-100">
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Disciplina</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Carga Horária</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right print:text-black">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                        {classProgress.pending.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-8 text-center text-xs font-bold text-emerald-500 uppercase tracking-widest">Matriz Curricular Completa!</td>
                          </tr>
                        ) : (
                          classProgress.pending.map((sub, idx) => (
                            <tr key={`pend-${idx}`} className="hover:bg-slate-50/50 transition-colors opacity-80 print:opacity-100">
                              <td className="p-4 font-bold text-slate-600 uppercase text-sm print:text-black">{sub.name}</td>
                              <td className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest print:text-gray-700">{sub.workload}h</td>
                              <td className="p-4 text-right">
                                <Badge className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest print:border print:border-gray-500 print:text-black print:bg-transparent">Pendente</Badge>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Print Footer Signature */}
              <div className="hidden print:block mt-16 pt-8 pb-4 text-center">
                <div className="w-64 mx-auto border-t-2 border-slate-900 pt-2">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-900">{profile?.name || user?.email}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Assinatura do Gestor</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-8 font-mono">Impresso em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} • Sistema ESTEADEB</p>
              </div>

            </div>
          </div>
        ) : null}

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
        <div className="flex gap-4">
          <button 
            onClick={() => setIsDeficitModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 transition-all text-sm font-black shadow-lg shadow-amber-200 uppercase tracking-widest"
          >
            <BookOpen size={20} />
            Déficit Global
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all text-sm font-black shadow-lg shadow-indigo-200 uppercase tracking-widest"
          >
            <Plus size={20} />
            Nova Turma
          </button>
        </div>
      </div>

      <GlobalDeficitModal 
        isOpen={isDeficitModalOpen} 
        onClose={() => setIsDeficitModalOpen(false)} 
        classes={classes} 
        nucleo={nucleo || ''} 
      />

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

      {/* Status Filter Tabs */}
      <div className="flex bg-slate-200/50 p-1 rounded-2xl max-w-fit">
        {(['Ativa', 'Concluída', 'Inativa', 'Todas'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              statusFilter === status 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            {status}
          </button>
        ))}
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
                        <p className="text-[9px] text-slate-400 font-mono mt-1 font-bold user-select-all" onClick={(e) => {
                          navigator.clipboard.writeText(cls.id);
                          showToast('ID copiado!', 'success');
                        }} title="Clique para copiar o ID Completo">ID: {cls.id}</p>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-700 text-xs font-black uppercase">{cls.courseName}</span>
                          <span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest">{cls.year}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <select
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border-0 cursor-pointer appearance-none text-center min-w-[100px]",
                            cls.status === 'Em Andamento' || cls.status === 'Ativa' || !cls.status ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 
                            cls.status === 'Inativa' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 
                            'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                          )}
                          value={cls.status === 'Ativa' ? 'Em Andamento' : cls.status || 'Em Andamento'}
                          onChange={(e) => handleStatusChange(cls.id, cls.status || 'Em Andamento', e.target.value)}
                        >
                          <option value="Em Andamento" className="text-slate-900 bg-white">Em Andamento</option>
                          <option value="Concluída" className="text-slate-900 bg-white">Concluída</option>
                          <option value="Inativa" className="text-slate-900 bg-white">Inativa</option>
                        </select>
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
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Inativa">Inativa</option>
                    <option value="Concluída">Concluída</option>
                  </select>
                </div>
              </div>

              {nucleo === 'SEMIPRESENCIAL' && isAdmin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Polo de Apoio (Admin Master)</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-indigo-50/50 border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all appearance-none"
                    value={newClassPolo.id}
                    onChange={e => {
                      const p = polos.find(poly => poly.id === e.target.value);
                      setNewClassPolo({ id: e.target.value, name: p?.name || 'MATRIZ' });
                    }}
                  >
                    <option value="">Selecione o Polo Responsável...</option>
                    {polos.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {nucleo === 'SEMIPRESENCIAL' && !isAdmin && (
                 <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Polo Vinculado</label>
                    <p className="text-sm font-bold text-navy uppercase ml-1">{profile?.poloName || 'MATRIZ'}</p>
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
