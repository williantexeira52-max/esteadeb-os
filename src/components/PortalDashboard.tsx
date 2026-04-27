import React, { useState, useEffect } from 'react';
import { 
  Home as HomeIcon, 
  FileText, 
  BookOpen, 
  ClipboardList, 
  Calendar as CalendarIcon, 
  LogOut, 
  Bell, 
  Wallet, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  User as UserIcon,
  Search,
  Download,
  Printer,
  CreditCard,
  DollarSign,
  ChevronDown,
  Loader2,
  Camera,
  Upload,
  MessageCircle,
  PlusCircle,
  ArrowRight,
  X as XIcon,
  PlusCircle as PlusCircleIcon,
  Layers,
  GraduationCap,
  Award,
  AlertCircle,
  MapPin,
  MessageSquare,
  FileText as FileTextIcon,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';

export const PortalDashboard: React.FC = () => {
  const { student, logoutStudent, loginStudent, profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const authStudent = student as any;
  const [activeTab, setActiveTab] = useState('Início');
  const [requests, setRequests] = useState<any[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({ subject: '', description: '', type: 'Geral' });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [subjectEnrollments, setSubjectEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicLoading, setAcademicLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [curriculumLoading, setCurriculumLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [studentDoc, setStudentDoc] = useState<any>(null);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [classDoc, setClassDoc] = useState<any>(null);
  
  const [lastSync, setLastSync] = useState<Date>(new Date());
  
  // Data States
  const [metrics, setMetrics] = useState<any>({
    completed: 0,
    inProgress: 0,
    pending: 0,
    absences: 0,
    average: 0,
    totalDisciplines: 0,
    finance: { overdue: [], upcoming: [], paid: [] }
  });
  const [grades, setGrades] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [rawCalendarEvents, setRawCalendarEvents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const [acceptingDoc, setAcceptingDoc] = useState<string | null>(null);

  const handleAcceptDocument = async (type: 'contract' | 'ficha' | 'requerimento') => {
    if (!currentStudent || !currentStudent.id) return;
    setAcceptingDoc(type);
    try {
      const fieldPrefix = type === 'contract' ? 'contract' : type === 'ficha' ? 'ficha' : 'requerimento';
      const updateData: any = {};
      updateData[`${fieldPrefix}Signed`] = true;
      updateData[`${fieldPrefix}SignatureData`] = {
        date: new Date().toISOString(),
        ip: 'Coleta Digital',
        userAgent: navigator.userAgent,
        hash: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      };

      await updateDoc(doc(db, 'students', currentStudent.id), updateData);
      
      let label = 'Contrato';
      if (type === 'ficha') label = 'Ficha de Matrícula';
      if (type === 'requerimento') label = 'Requerimento';
      
      alert(`${label} assinado com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao assinar documento.');
    } finally {
      setAcceptingDoc(null);
    }
  };

  // Global Loading Exit Logic
  useEffect(() => {
    // Fail-safe logic replaced with reactive logic ensures it only clears once streams indicate ready state
    const isDataReady = !academicLoading && !financeLoading && !curriculumLoading;
    
    if (isDataReady) {
      setLoading(false);
    }
  }, [academicLoading, financeLoading, curriculumLoading]);

  // Reactive identifiers for query matching (Reactive)
  const studentIdentifiers = React.useMemo(() => {
    if (!authStudent) return [];
    const ids = new Set<string>();
    
    // Core identifiers from login
    ids.add(authStudent.id);
    const numericId = authStudent.id.toString().replace(/\D/g, '');
    if (numericId) ids.add(numericId);

    // Dynamic identifiers from real-time document
    if (studentDoc) {
      if (studentDoc.id) ids.add(studentDoc.id);
      if (studentDoc.matricula) {
        ids.add(studentDoc.matricula);
        const numMat = studentDoc.matricula.replace(/\D/g, '');
        if (numMat) ids.add(numMat);
      }
      if (studentDoc.cpf) {
        ids.add(studentDoc.cpf);
        const numCpf = studentDoc.cpf.replace(/\D/g, '');
        if (numCpf) ids.add(numCpf);
      }
    } else if (authStudent) {
      if (authStudent.matricula) ids.add(authStudent.matricula);
      if (authStudent.cpf) ids.add(authStudent.cpf);
    }
    
    // Critical: add the current auth UID if available
    if (auth.currentUser?.uid) {
      ids.add(auth.currentUser.uid);
    }

    const finalIds = Array.from(ids).filter(Boolean);
    console.log("PortalDashboard: Student Identifiers (Query Matchers):", finalIds);
    return finalIds;
  }, [authStudent?.id, authStudent?.matricula, authStudent?.cpf, studentDoc?.id, studentDoc?.matricula, studentDoc?.cpf, auth.currentUser?.uid]);

  // Split listeners to avoid redundant re-runs and prevent Firestore internal assertion failures (ca9)
  useEffect(() => {
    if (!authStudent || !user) return;

    // 1. Real-time Student Doc (Standalone listener)
    const unsubStudent = onSnapshot(doc(db, 'students', authStudent.id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as any;
        setStudentDoc(data);
        setLastSync(new Date());
      }
    }, (error) => {
      console.warn("Student doc listener failed:", error);
      handleFirestoreError(error, OperationType.GET, 'students', true);
    });

    return () => unsubStudent();
  }, [authStudent?.id]);

  useEffect(() => {
    const fetchSystemConfig = async () => {
      try {
        const configSnap = await getDocs(query(collection(db, 'settings'), limit(10)));
        const config = configSnap.docs.find(d => d.id === 'system_config');
        if (config) {
          setSystemConfig(config.data());
        }
      } catch (error) {
        console.error("Error fetching system config:", error);
      }
    };
    fetchSystemConfig();
  }, []);

  useEffect(() => {
    const studentTurma = studentDoc?.turma || authStudent.turma || studentDoc?.className || authStudent.className;
    if (!studentTurma) return;

    const q = query(collection(db, 'classes'), where('name', '==', studentTurma), limit(1));
    const unsubClass = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setClassDoc(snap.docs[0].data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'classes', true);
    });

    return () => unsubClass();
  }, [studentDoc?.turma, authStudent.turma, studentDoc?.className, authStudent.className]);

  // CONTENT LISTENERS: Only re-run when identifiers or critical context changes
  const stableIdentifiers = React.useMemo(() => {
    return [...studentIdentifiers].sort().join(',');
  }, [studentIdentifiers]);
  
  useEffect(() => {
    if (!authStudent || studentIdentifiers.length === 0) {
      if (studentIdentifiers.length === 0) {
        setAcademicLoading(false);
        setFinanceLoading(false);
      }
      return;
    }

    // Helper to securely fetch personal data using multiple exact-match queries
    // This bypasses Firestore limitations with 'in' array evaluation against secure rules
    const createSecureMultiplexedSnapshot = (collectionName: string, idList: string[], setState: Function, setLoading?: Function, sortFn?: (a: any, b: any) => number) => {
      const dataMap = new Map<string, any>();
      let pendingLoads = idList.length;
      let hasEmitted = false;

      const attemptEmit = () => {
        if (pendingLoads <= 0) {
          const merged = Array.from(dataMap.values());
          if (sortFn) merged.sort(sortFn);
          setState([...merged]); // Force new array ref
          if (setLoading) setLoading(false);
          setLastSync(new Date());
          hasEmitted = true;
        }
      };

      const unsubs = idList.map(id => {
        return onSnapshot(
          query(collection(db, collectionName), where('studentId', '==', id)),
          (snap) => {
             snap.docChanges().forEach(change => {
               if (change.type === 'removed') {
                 dataMap.delete(change.doc.id);
               } else {
                 dataMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
               }
             });
             
             if (!hasEmitted) {
               pendingLoads--;
               attemptEmit();
             } else {
               // Subsequent real-time update
               const merged = Array.from(dataMap.values());
               if (sortFn) merged.sort(sortFn);
               setState([...merged]);
               setLastSync(new Date());
             }
          },
          (error) => {
             console.warn(`Snapshot ignored for ${collectionName} with id ${id} (Rules Evaluation)`);
             handleFirestoreError(error, OperationType.LIST, collectionName, true);
             if (!hasEmitted) {
               pendingLoads--;
               attemptEmit();
             }
          }
        );
      });

      return () => unsubs.forEach(u => u());
    };

    // 2. Real-time Academic Records (Notas)
    const unsubRecords = createSecureMultiplexedSnapshot('academic_records', studentIdentifiers, setGrades, setAcademicLoading);

    // 3. Real-time Financial Portal (Secretaria -> Aluno)
    const unsubFinance = createSecureMultiplexedSnapshot('financial_installments', studentIdentifiers, setInstallments, setFinanceLoading, (a: any, b: any) => {
      const dateA = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate || 0);
      const dateB = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate || 0);
      return dateA.getTime() - dateB.getTime();
    });

    // 4. Real-time Curriculum Matrix (Grades collection)
    const rawCourse = studentDoc?.course || authStudent.course || classDoc?.courseName;
    const studentCourse = rawCourse && rawCourse !== 'N/A' ? rawCourse.trim() : null;
    
    const unsubCurriculum = studentCourse ? onSnapshot(
      query(collection(db, 'grades')),
      (snap) => {
        const subjects = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(g => 
            g.course?.toLowerCase() === studentCourse.toLowerCase() || 
            g.course?.toUpperCase() === studentCourse.toUpperCase()
          );
        
        if (subjects.length > 0) {
          setCurriculum(subjects);
          setCurriculumLoading(false);
        } else {
          // Deep Search fallback
          const fuzzySubjects = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(g => g.course?.toLowerCase() === studentCourse.toLowerCase() || 
                         studentCourse.toLowerCase().includes(g.course?.toLowerCase()) ||
                         g.course?.toLowerCase().includes(studentCourse.toLowerCase()));
          setCurriculum(fuzzySubjects);
          setCurriculumLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'grades', true);
        setCurriculumLoading(false);
      }
    ) : (() => { setCurriculum([]); setCurriculumLoading(false); return () => {}; })();

    // 5. Global & Target Announcements
    const currentTurma = studentDoc?.turma || authStudent.turma;
    const unsubAnnouncements = onSnapshot(
      query(collection(db, 'school_announcements'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtered = data.filter((ann: any) => 
          ann.targetAudience === 'Todos os Alunos' || 
          ann.targetAudience === 'Todos' ||
          ann.targetAudience === `Turma: ${currentTurma}` ||
          ann.targetAudience === currentTurma
        );
        setAnnouncements(filtered);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'school_announcements', true);
      }
    );

    // 6. School Events (Calendar)
    const unsubCalendar = onSnapshot(
      query(collection(db, 'school_events')), 
      (snap) => {
        setRawCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.warn("Calendar load failed:", error);
        handleFirestoreError(error, OperationType.LIST, 'school_events', true);
      }
    );

    // 7. Student Requests
    const unsubRequests = createSecureMultiplexedSnapshot('requests', studentIdentifiers, (data: any[]) => {
      // Sort client-side since multiplexer doesn't sort by default without param
      const sorted = [...data].sort((a, b) => {
        const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dB.getTime() - dA.getTime();
      });
      setRequests(sorted);
    });

    // 8. Subject Enrollments
    const unsubSubjectEnrollments = createSecureMultiplexedSnapshot('subject_enrollments', studentIdentifiers, setSubjectEnrollments);

    // 9. Schedules for current class
    const studentTurmaForSchedule = studentDoc?.turma || authStudent.turma || studentDoc?.className || authStudent.className;
    
    // Improved query: search by className or classId if available
    const unsubSchedules = studentTurmaForSchedule ? onSnapshot(
      query(collection(db, 'schedules')),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtered = data.filter((s: any) => 
          s.className === studentTurmaForSchedule || 
          s.classId === studentTurmaForSchedule ||
          s.targetTurma === studentTurmaForSchedule
        );
        setSchedules(filtered);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'schedules', true);
      }
    ) : () => {};

    return () => {
      unsubRecords(); unsubFinance(); unsubCurriculum(); unsubAnnouncements(); unsubCalendar(); unsubRequests(); unsubSubjectEnrollments(); unsubSchedules();
    };
  }, [authStudent?.id, stableIdentifiers, studentDoc?.course, studentDoc?.turma, classDoc?.courseName]);

  const getFinanceValue = (f: any) => {
    if (f.status === 'Pago' && f.finalPaidValue) return f.finalPaidValue;
    if (f.amount !== undefined && f.amount !== null && f.amount !== 0) return f.amount;
    
    const base = f.baseValue || f.valor || 0;
    const disc = f.discount || f.desconto || 0;
    const netValue = base - disc;

    // Se estiver pago, não calcula atraso aqui (já deve ter f.finalPaidValue)
    if (f.status === 'Pago') return netValue;

    // Data de vencimento
    const dueDateStr = f.dueDate?.toDate ? f.dueDate.toDate().toISOString().split('T')[0] : (f.dueDate || '');
    if (!dueDateStr) return netValue;

    const dueDate = new Date(dueDateStr + 'T23:59:59');
    const today = new Date();

    if (today <= dueDate) return netValue;

    // Cálculo de atraso: 2% multa + 1% juros ao mês
    const diffTime = Math.abs(today.getTime() - dueDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const fine = netValue * 0.02;
    const dailyInterestRate = 0.01 / 30;
    const interest = netValue * (dailyInterestRate * diffDays);

    return netValue + fine + interest;
  };

  const historyData = React.useMemo(() => {
    const completed: any[] = [];
    const inProgress: any[] = [];
    const pending: any[] = [];
    
    // 1. Create a map of academic records (notas)
    const studentGradesMap = new Map();
    grades.forEach(r => {
      const id = r.disciplinaId || r.disciplina;
      studentGradesMap.set(id, r);
    });

    // 2. Create a Set of subjects currently in progress (Cursando)
    const inProgressSubjectIds = new Set();
    subjectEnrollments.forEach(se => {
      inProgressSubjectIds.add(se.disciplinaId);
      if (se.subjectName) inProgressSubjectIds.add(se.subjectName);
    });
    
    // Sort curriculum by year and module
    const sortedCurriculum = [...curriculum].sort((a: any, b: any) => {
      if (a.year !== b.year) return String(a.year).localeCompare(String(b.year));
      return Number(a.module) - Number(b.module);
    });

    sortedCurriculum.forEach(disciplina => {
      const record = studentGradesMap.get(disciplina.id) || studentGradesMap.get(disciplina.name);
      const isEnrolled = inProgressSubjectIds.has(disciplina.id) || inProgressSubjectIds.has(disciplina.name);

      const nota = record?.mediaFinal || record?.nota || 0;
      const status = record?.status || '';
      
      let itemStatus = 'Pendente';
      let gradeToDisplay = nota;

      if (status === 'Dispensada') {
        itemStatus = 'Dispensada';
        gradeToDisplay = nota;
      } else if (nota >= 7.0 || status === 'Aprovado' || record?.resultado === 'Aprovado') {
        itemStatus = 'Concluído';
      } else if (isEnrolled || status === 'Em Progresso') {
        itemStatus = 'Cursando';
      }

      const item = {
        ...disciplina,
        grade: gradeToDisplay,
        absences: record?.faltas || 0,
        status: itemStatus
      };

      if (itemStatus === 'Concluído' || itemStatus === 'Dispensada') {
        completed.push(item);
      } else if (itemStatus === 'Cursando') {
        inProgress.push(item);
      } else {
        pending.push(item);
      }
    });

    // Add orphans (Extra Enrollments) - O(1) performance lookup
    const inProgressIds = new Set(inProgress.flatMap(ip => [ip.name, ip.id, ip.disciplinaId]));
    const completedIds = new Set(completed.flatMap(c => [c.name, c.id, c.disciplinaId]));

    subjectEnrollments.forEach(se => {
      const name = se.subjectName || se.disciplinaId;
      const inInProgress = inProgressIds.has(name);
      const inCompleted = completedIds.has(name);
      
      if (!inInProgress && !inCompleted) {
        inProgress.push({
          id: se.id,
          name: name,
          year: se.year || '---',
          module: se.module || '---',
          status: 'Cursando (Extra)',
          grade: 0,
          absences: 0
        });
      }
    });

    return { completed, inProgress, pending };
  }, [curriculum, grades, subjectEnrollments]);

  // Reactive Calendar Logic: Subscribe to global events and filter/sort dynamically
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const studentTurma = studentDoc?.turma || authStudent.turma || studentDoc?.className || authStudent.className || '';
    const studentModule = studentDoc?.module || authStudent.module || classDoc?.module || '';
    
    // Support common 'Global' labels
    const globalTags = ['Todas as Turmas', 'Todos', 'Todos os Alunos', 'Institucional', 'Global', 'GENERAL'];

    const filtered = rawCalendarEvents.filter(event => {
       const target = event.targetClass || '';
       const isGlobal = globalTags.some(tag => target.toLowerCase() === tag.toLowerCase() || target === '');
       const isTurmaMatch = studentTurma && target.toLowerCase() === studentTurma.toLowerCase();
       const isModuleMatch = studentModule && target.toLowerCase() === studentModule.toLowerCase();
       
       return isGlobal || isTurmaMatch || isModuleMatch;
    });

    const parsedEvents = filtered.map(event => {
      // Create a robust date parser that neutralizes timezone shifts for YYYY-MM-DD
      const parseSafe = (raw: any): Date | null => {
         if (!raw) return null;
         if (raw.toDate) return raw.toDate();
         if (typeof raw === 'string') {
             // If full ISO timestamp with time
             if (raw.includes('T')) return new Date(raw);
             
             // Handle raw YYYY-MM-DD or DD/MM/YYYY exactly without timezone shift!
             const parts = raw.split(/[-/]/);
             if (parts.length >= 3) {
                 const p0 = Number(parts[0]), p1 = Number(parts[1]), p2 = Number(parts[2]);
                 // Set hour to 12 (noon) to be 100% immune to UTC <-> Local offset shifts
                 if (parts[0].length === 4) return new Date(p0, p1 - 1, p2, 12, 0, 0);
                 else return new Date(p2, p1 - 1, p0, 12, 0, 0);
             }
         }
         const d = new Date(raw);
         return isNaN(d.getTime()) ? null : d;
      };

      const parsedDate = parseSafe(event.startDate || event.date);
      const parsedEndDate = parseSafe(event.endDate);

      return { 
        ...event, 
        // Emmit strictly validated objects that downstream can just consume
        date: parsedDate, 
        parsedDate, 
        parsedEndDate 
      };
    }).filter(e => {
        if (!e.parsedDate) return false;
        
        // If event has an end date, check if today is before or equal to the end date
        if (e.parsedEndDate) {
            const endCompare = new Date(e.parsedEndDate);
            endCompare.setHours(23, 59, 59, 999);
            return endCompare >= today;
        }
        
        // Otherwise strictly compare start date 
        return e.parsedDate >= today;
    });

    // Sort by nearest date first
    parsedEvents.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

    // Slice to show upcoming nearest
    setCalendarEvents(parsedEvents.slice(0, 6));
  }, [rawCalendarEvents, studentDoc, authStudent, classDoc]);

  // Reactive Metrics Engine: Derived from exactly the same historyData ensuring ONE source of truth
  useEffect(() => {
    const total = curriculum.length || 0;
    
    let totalNota = 0, countNota = 0, totalFaltas = 0;

    // 1. Evaluate GPA and Absences strictly
    grades.forEach((r: any) => {
      const nota = r.mediaFinal || r.nota || 0;
      const status = r.status || '';
      if (status === 'Aprovado' || nota >= 7.0) { 
        totalNota += nota; 
        countNota++; 
      }
      totalFaltas += (r.faltas || 0);
    });

    // Group finance into Overdue, Upcoming, Paid
    const groupedFinance = {
      overdue: installments.filter((f: any) => f.status !== 'Pago' && new Date(f.dueDate?.toDate ? f.dueDate.toDate() : f.dueDate) < new Date()),
      upcoming: installments.filter((f: any) => f.status !== 'Pago' && new Date(f.dueDate?.toDate ? f.dueDate.toDate() : f.dueDate) >= new Date()),
      paid: installments.filter((f: any) => f.status === 'Pago')
    };

    setMetrics((prev: any) => {
      const next = {
        completed: historyData.completed.length,
        inProgress: historyData.inProgress.length,
        pending: historyData.pending.length,
        absences: totalFaltas,
        average: countNota > 0 ? totalNota / countNota : 0,
        totalDisciplines: total,
        finance: groupedFinance
      };
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      return next;
    });
  }, [grades, curriculum, installments, historyData]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authStudent) return;

    try {
      setUploadingPhoto(true);
      const storageRef = ref(storage, `students/${authStudent.id}/profile_${Date.now()}.jpg`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'students', authStudent.id), {
        photoURL,
        updatedAt: new Date().toISOString()
      });

      console.log("Photo updated successfully:", photoURL);
    } catch (error) {
      console.error("Error uploading photo:", error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!authStudent) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 z-[9999]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-esteadeb-blue border-t-transparent rounded-full mb-8"
        />
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/20 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse text-center"
        >
          Sincronizando Inteligência Acadêmica...
        </motion.p>
        
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
          onClick={() => setLoading(false)}
          className="mt-12 text-[10px] font-black text-esteadeb-blue uppercase tracking-widest border border-esteadeb-blue/20 px-6 py-3 rounded-xl hover:bg-esteadeb-blue/10 transition-all pointer-events-auto cursor-pointer"
        >
          Entrar Manualmente
        </motion.button>
      </div>
    );
  }

  const handleNewRequest = async () => {
    if (!newRequest.subject || !newRequest.description || !authStudent) return;
    setIsSubmittingRequest(true);
    try {
      await addDoc(collection(db, 'requests'), {
        studentId: authStudent.id,
        studentName: currentStudent.name,
        subject: newRequest.subject,
        description: newRequest.description,
        type: newRequest.type,
        status: 'Pendente',
        nucleoId: currentStudent.nucleoId || '',
        createdAt: serverTimestamp()
      });
      setIsRequestModalOpen(false);
      setNewRequest({ subject: '', description: '', type: 'Geral' });
    } catch (error) {
      console.error("Request error:", error);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const currentStudent = studentDoc || authStudent;

  if (loading || !currentStudent) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px]">Carregando seu ecossistema acadêmico...</p>
      </div>
    );
  }

  const progress = metrics.totalDisciplines > 0 
    ? Math.round((metrics.completed / metrics.totalDisciplines) * 100) 
    : 0;

  const dashboardMetrics = [
    { label: 'Concluídas', value: metrics.completed, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Média Geral', value: metrics.average.toFixed(1), icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Total Faltas', value: metrics.absences, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Cursando', value: metrics.inProgress, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  ];

  const renderAnnouncements = () => (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-3xl font-black text-navy uppercase tracking-tighter">Mural de Avisos</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Comunicados oficiais da instituição</p>
        </div>
        <Bell className="text-petrol/20" size={32} />
      </div>
      
      {announcements.length > 0 ? (
        announcements.map((ann, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "bg-white p-8 rounded-[2.5rem] border-l-[8px] border-y border-r border-slate-100 shadow-sm relative overflow-hidden group transition-all hover:bg-slate-50",
              ann.isUrgent ? "border-l-rose-500" : "border-l-petrol"
            )}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <Badge className={cn(
                  "uppercase text-[9px] font-black px-3",
                  ann.isUrgent ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-petrol"
                )}>
                  {ann.isUrgent ? 'URGENTE' : 'INFORMATIVO'}
                </Badge>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{ann.createdAt?.toDate ? ann.createdAt?.toDate().toLocaleDateString('pt-BR') : 'Recente'}</span>
              </div>
              <h3 className="text-xl font-black text-navy uppercase tracking-tight mb-4 group-hover:text-petrol transition-colors">{ann.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ann.message}</p>
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Publicado por: <span className="text-navy">{ann.createdBy || 'Administração'}</span></p>
              </div>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="py-20 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center gap-4">
          <Bell size={48} className="text-slate-200" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.5em]">Não há novos comunicados no mural.</p>
        </div>
      )}
    </div>
  );

  const renderHome = () => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
      {/* Hero Identity Card */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="md:col-span-4 bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="w-40 h-40 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200 border-2 border-slate-100 shadow-inner mb-6 relative overflow-hidden">
          {currentStudent.photoURL ? (
            <img 
              src={currentStudent.photoURL} 
              alt="Profile" 
              className="w-full h-full object-cover rounded-[2.5rem]" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon size={64} />
          )}
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-esteadeb-blue rounded-2xl flex items-center justify-center text-white shadow-lg">
            <CheckCircle size={20} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="inline-flex items-center px-4 py-1.5 bg-esteadeb-blue/10 text-esteadeb-blue rounded-full text-[10px] font-black tracking-widest uppercase border border-esteadeb-blue/20">
            {currentStudent?.status || 'Ativo'}
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            {currentStudent?.name ? currentStudent.name.split(' ')[0] : 'Aluno'}
          </h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-[200px]">
            Seu portal de inteligência acadêmica.
          </p>
        </div>
        <div className="w-full mt-10 pt-10 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível</p>
              <p className="text-sm font-bold text-slate-700 uppercase">{currentStudent.level || 'Básico'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Curso</p>
              <p className="text-[10px] font-bold text-slate-700 uppercase truncate">
                {currentStudent.course && currentStudent.course !== 'N/A' ? currentStudent.course : (classDoc?.courseName || 'N/A')}
              </p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Sua Turma</p>
             <p className="text-xs font-black text-esteadeb-blue uppercase text-center tracking-tighter">
               {currentStudent.turma || currentStudent.className || 'Não Vinculado'}
             </p>
          </div>
        </div>
      </motion.div>

      {/* Progress & Stats Group */}
      <div className="md:col-span-8 flex flex-col gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-esteadeb-blue to-navy-dark rounded-[3rem] p-10 shadow-2xl text-white relative overflow-hidden"
        >
          <div className="relative z-10">
            <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">Desempenho Geral</h2>
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-8xl font-black tracking-tighter leading-none">{progress}</span>
              <span className="text-2xl font-black text-blue-300">% Concluído</span>
            </div>
            <div className="h-4 bg-black/20 rounded-full overflow-hidden border border-white/10 p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-white rounded-full transition-all duration-1000 shadow-lg"
              />
            </div>
            <p className="mt-4 text-blue-100 font-bold text-xs uppercase tracking-widest">
              {metrics.completed} de {metrics.totalDisciplines} disciplinas masterizadas
            </p>
          </div>

          {/* New: Quick Access to Current Subjects */}
          {historyData.inProgress.length > 0 && (
            <div className="mt-8 pt-8 border-t border-white/10 relative z-10">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-6 bg-amber-400 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.6)]" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Cursando Agora</h3>
               </div>
               <div className="flex flex-wrap gap-3">
                  {historyData.inProgress.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => setActiveTab('Histórico')}
                      className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-4 group"
                    >
                      <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:scale-110 transition-transform">
                        <BookOpen size={16} />
                      </div>
                      <div>
                         <p className="text-[11px] font-black text-white uppercase tracking-tight leading-none mb-1">{item.name}</p>
                         <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">{item.year} Ano • Módulo {item.module}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
          
          <div className="absolute bottom-0 right-0 opacity-10 select-none pointer-events-none transform translate-y-1/4">
             <GraduationCap size={300} strokeWidth={4} />
          </div>
        </motion.div>

        {/* Latest Announcements in Home */}
        {announcements.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0f1115] p-8 rounded-[2.5rem] border border-blue-600/20"
          >
            <div className="flex items-center gap-3 mb-6">
              <Bell className="text-blue-500" size={20} />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Último Comunicado</h3>
            </div>
            <div className="space-y-2">
               <h4 className="text-lg font-black text-white uppercase italic">{announcements[0].title}</h4>
               <p className="text-sm text-white/40 line-clamp-2">{announcements[0].message}</p>
            </div>
            <button 
              onClick={() => setActiveTab('Avisos')}
              className="mt-6 text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 hover:text-blue-300"
            >
              Ver Mural Completo <ChevronRight size={14} />
            </button>
          </motion.div>
        )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {dashboardMetrics.map((m, i) => (
          <motion.div 
            key={m.label} 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center group hover:border-blue-200 transition-all cursor-default"
          >
            <div className={cn("p-4 rounded-2xl mb-3 group-hover:scale-110 transition-transform", m.bg, m.color)}>
              <m.icon size={24} />
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{m.value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{m.label}</p>
          </motion.div>
        ))}
      </div>
      </div>

      {/* Academic Calendar Bento */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="md:col-span-12 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl relative overflow-hidden group"
      >
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Calendário de Atividades</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Próximos eventos e prazos</p>
          </div>
          <CalendarIcon className="text-blue-600 opacity-20 group-hover:opacity-100 transition-opacity" size={40} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {calendarEvents.length > 0 ? calendarEvents.map((event, i) => {
            // Already safely parsed by the hook
            const eventDate = event.parsedDate;
            const endDate = event.parsedEndDate;

            const isValidDate = eventDate instanceof Date && !isNaN(eventDate.getTime());
            const isValidEndDate = endDate instanceof Date && !isNaN(endDate.getTime());
            
            // Check if end date is a completely different calendar day
            const hasDifferentEndDate = isValidDate && isValidEndDate && 
                (endDate.getFullYear() !== eventDate.getFullYear() || 
                 endDate.getMonth() !== eventDate.getMonth() || 
                 endDate.getDate() !== eventDate.getDate());

            return (
              <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-start gap-4 hover:bg-slate-100 transition-all group/item">
                <div className="bg-blue-600/10 text-blue-600 p-3 rounded-xl font-black text-center min-w-[60px] flex-shrink-0 group-hover/item:bg-blue-600 group-hover/item:text-white transition-all">
                  <span className="block text-lg leading-none">
                    {isValidDate ? eventDate.getDate().toString().padStart(2, '0') : '--'}
                  </span>
                  <span className="text-[9px] uppercase tracking-tighter">
                    {isValidDate ? eventDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '') : '---'}
                  </span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm uppercase leading-tight mb-1">{event.title}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                    {event.type || 'Evento'}
                    {hasDifferentEndDate && <span className="ml-1 text-slate-500">• ATÉ {endDate.getDate().toString().padStart(2, '0')}/{(endDate.getMonth() + 1).toString().padStart(2, '0')}</span>}
                  </p>
                  {event.description && <p className="text-[11px] text-slate-500 mt-2 line-clamp-1">{event.description}</p>}
                </div>
              </div>
            );
          }) : (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center gap-4 text-slate-300">
              <Clock size={48} strokeWidth={1} />
              <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhum evento programado para hoje</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  const renderBoletim = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-2xl space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Boletim Acadêmico</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Notas e rendimento do módulo vigente</p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100 overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="bg-slate-100/50">
              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Disciplina</th>
              <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Modulo</th>
              <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Faltas</th>
              <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota</th>
              <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grades.length > 0 ? grades.map((g, i) => {
              const notaFinal = g.mediaFinal || g.nota || 0;
              const statusAprovado = notaFinal >= 7 || g.status === 'Dispensada' || g.status === 'Aprovado' || g.resultado === 'Aprovado';
              
              return (
                <tr key={i} className="hover:bg-slate-100/30 transition-colors">
                  <td className="p-6 font-black text-slate-900 uppercase text-sm">{g.disciplinaNome || g.disciplina || '---'}</td>
                  <td className="p-6 text-center font-bold text-slate-500">{g.modulo || '---'}</td>
                  <td className="p-6 text-center font-bold text-slate-500">{g.faltas || 0}</td>
                  <td className={cn("p-6 text-center font-black text-lg", statusAprovado ? "text-emerald-600" : "text-rose-600")}>
                    {g.status === 'Dispensada' ? '-' : (typeof notaFinal === 'number' ? notaFinal.toFixed(1) : notaFinal)}
                  </td>
                  <td className="p-6 text-right">
                    <Badge className={cn(
                      "uppercase font-black text-[9px] px-3",
                      statusAprovado ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600",
                      g.status === 'Dispensada' && "bg-blue-500/10 text-blue-600"
                    )}>
                      {g.status === 'Dispensada' ? 'Dispensada' : (statusAprovado ? 'Aprovado' : 'Em Curso')}
                    </Badge>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="p-20 text-center">
                  <AlertTriangle className="mx-auto mb-4 text-slate-200" size={48} />
                  <p className="text-slate-300 font-bold uppercase text-xs tracking-[0.5em]">
                    {academicLoading ? 'Processando registros acadêmicos...' : 'Nenhum registro acadêmico encontrado'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );

  const renderFinanceiro = () => {
    const overdue = metrics.finance?.overdue || [];
    const upcoming = metrics.finance?.upcoming || [];
    const paid = metrics.finance?.paid || [];

    const FinanceList = ({ items, title, emptyMsg, type }: { items: any[], title: string, emptyMsg: string, type: 'overdue' | 'upcoming' | 'paid' }) => (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h3>
          <Badge className={cn(
            "text-[9px] font-black uppercase px-2 py-0.5",
            type === 'overdue' ? "bg-rose-500/10 text-rose-600" :
            type === 'paid' ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
          )}>
            {items.length} Parcelas
          </Badge>
        </div>
        
        {items.length === 0 ? (
          <div className="p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{emptyMsg}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((f, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-slate-200 hover:shadow-sm transition-all gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    type === 'overdue' ? "bg-rose-500/10 text-rose-600" :
                    type === 'paid' ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                  )}>
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 uppercase text-xs tracking-tight">Parcela {f.installmentNumber || (i + 1)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Vencimento: {f.dueDate?.toDate ? f.dueDate.toDate().toLocaleDateString('pt-BR') : (f.dueDate ? new Date(f.dueDate).toLocaleDateString('pt-BR') : '---')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end mt-2 md:mt-0 pt-4 md:pt-0 border-t border-slate-50 md:border-t-0">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Valor</p>
                    <p className="font-black text-slate-900 text-sm">R$ {getFinanceValue(f).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    {type === 'overdue' && (
                       <p className="text-[9px] font-bold text-rose-500 uppercase tracking-tighter">Com Juros e Multa</p>
                    )}
                  </div>
                  {type === 'overdue' ? (
                    <Button variant="outline" size="sm" className="bg-rose-600/5 border-rose-600/10 text-rose-600 text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white rounded-lg">
                      Negociar
                    </Button>
                  ) : type === 'paid' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[9px] uppercase px-3 py-1">PAGO</Badge>
                  ) : (
                    <Badge className="bg-blue-500/10 text-blue-600 border-none font-black text-[9px] uppercase px-3 py-1">A VENCER</Badge>
                  )
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    const otherPayments = installments.filter(i => i.type && i.type !== 'Mensalidade');

    return (
      <div className="space-y-12 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Financeiro</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Gestão de mensalidades e compromissos</p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
             <CreditCard className="text-blue-600" size={24} />
             <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Geral</p>
                <p className="text-sm font-black text-slate-900">R$ {installments.reduce((acc, c) => acc + getFinanceValue(c), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-12">
          {/* Main Installments */}
          <div className="space-y-10">
            <FinanceList items={overdue} title="Pendências em Atraso" emptyMsg="Excelente! Nenhuma pendência em atraso." type="overdue" />
            <FinanceList items={upcoming} title="Próximos Vencimentos" emptyMsg="Não há parcelas futuras registradas." type="upcoming" />
            <FinanceList items={paid} title="Histórico de Pagamentos" emptyMsg="Nenhum pagamento registrado ainda." type="paid" />
          </div>

          {/* Other Payments & Context - Bottom side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl opacity-20" />
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Taxas e Outros Pagamentos</h3>
               {otherPayments.length === 0 ? (
                 <div className="py-10 text-center grayscale opacity-30">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Layers size={24} className="text-slate-400" />
                   </div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">Não há taxas de material vinculadas.</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                   {otherPayments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">{p.type}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{p.description}</p>
                        </div>
                    <p className="font-black text-blue-600 text-xs">R$ {getFinanceValue(p).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                   ))}
                 </div>
               )}
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[3rem] border border-blue-500/10 shadow-2xl text-white">
               <div className="flex gap-4 items-start mb-6">
                  <div className="p-3 bg-white/20 rounded-2xl text-white">
                    <AlertCircle size={24} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-black uppercase tracking-tight">Política de Pagamento</h4>
                    <p className="text-xs opacity-90 leading-relaxed font-medium">Pagamentos até o dia do vencimento possuem isenção de juros institucionais. Para dúvidas técnicas sobre boletos, utilize o canal de Solicitações.</p>
                  </div>
               </div>

               <div className="pt-6 border-t border-white/20 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white text-blue-600 rounded-lg">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Chave PIX</p>
                      <p className="text-sm font-bold">40.800.393/0001-32</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start bg-black/10 p-4 rounded-2xl">
                    <MessageCircle size={18} className="mt-1" />
                    <div>
                      <p className="text-[10px] font-medium leading-relaxed">Enviar o comprovante para o WhatsApp para seguirmos com a baixa</p>
                      <p className="text-sm font-black mt-1">84 2030-4038</p>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContratos = () => {
    if (!currentStudent) return null;
    
    const rawContract = systemConfig?.contractTemplate || `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS – 2026
Pelo presente instrumento... [Léia no sistema admin]`;

    const rawFicha = `# FICHA DE MATRÍCULA – 2026
Confirmo que os dados cadastrais informados no meu perfil estão corretos e atualizados.`;

    const rawRequerimento = `# REQUERIMENTO DE MATRÍCULA / BOLSAS
Solicito minha matrícula no curso e turma vinculados ao meu perfil, aceitando as condições financeiras acordadas.`;

    const parseDoc = (text: string) => {
      return text
        .replace(/\{\{NOME\}\}|\{\{NOME_ALUNO\}\}/g, currentStudent.name || '---')
        .replace(/\{\{CPF\}\}|\{\{CPF_ALUNO\}\}/g, currentStudent.cpf || '---')
        .replace(/\{\{NASCIMENTO\}\}|\{\{DATA_NASCIMENTO\}\}/g, currentStudent.birthDate || '---')
        .replace(/\{\{MATRICULA\}\}/g, currentStudent.matricula || currentStudent.id || '---');
    };

    const docSections = [
      { 
        id: 'contract' as const, 
        title: 'Contrato de Prestação de Serviços', 
        template: rawContract, 
        signed: currentStudent.contractSigned, 
        data: currentStudent.contractSignatureData 
      },
      { 
        id: 'ficha' as const, 
        title: 'Ficha de Matrícula', 
        template: rawFicha, 
        signed: currentStudent.fichaSigned, 
        data: currentStudent.fichaSignatureData 
      },
      { 
        id: 'requerimento' as const, 
        title: 'Requerimento de Matrícula', 
        template: rawRequerimento, 
        signed: currentStudent.requerimentoSigned, 
        data: currentStudent.requerimentoSignatureData 
      }
    ];

    return (
      <div className="space-y-12 pb-20">
        <div>
          <h2 className="text-3xl font-black text-navy uppercase tracking-tighter">Aceite de Documentos</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Gerencie sua documentação acadêmica on-line</p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {docSections.map((section) => (
            <div key={section.id} className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
              <h3 className="text-xl font-black text-navy uppercase mb-6 flex items-center gap-2">
                <FileTextIcon size={20} className="text-petrol" /> {section.title}
              </h3>
              
              {section.signed ? (
                <div className="flex flex-col items-center justify-center py-6 text-center bg-emerald-50/30 rounded-3xl border border-emerald-100">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <ShieldCheck size={32} />
                  </div>
                  <h4 className="text-xl font-black text-emerald-800 uppercase tracking-tight">Documento Assinado</h4>
                  <p className="text-slate-500 font-medium mt-2 text-sm">
                    Assinado digitalmente em {new Date(section.data?.date).toLocaleString('pt-BR')}.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="prose prose-sm max-w-none prose-slate bg-slate-50 p-6 rounded-2xl border border-slate-200 h-[250px] overflow-y-auto">
                    <Markdown>{parseDoc(section.template)}</Markdown>
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => handleAcceptDocument(section.id)}
                      disabled={acceptingDoc !== null}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 flex items-center gap-2 text-xs"
                    >
                      {acceptingDoc === section.id ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                      Aceitar e Assinar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRequests = () => (
    <div className="space-y-12 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Atendimento</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Protocolos administrativos e atendimentos</p>
        </div>
        <Button 
          onClick={() => setIsRequestModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white h-14 px-8 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 flex items-center gap-3"
        >
          <PlusCircle size={20} />
          Nova Solicitação
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Meus Protocolos</h3>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{requests.length} Registros</span>
        </div>

        {requests.length === 0 ? (
          <div className="py-32 bg-white rounded-[3rem] border border-slate-100 flex flex-col items-center justify-center text-center gap-4 shadow-sm">
             <motion.div
               animate={{ y: [0, -10, 0] }}
               transition={{ duration: 3, repeat: Infinity }}
               className="p-6 bg-slate-50 rounded-full text-slate-200"
             >
               <MessageSquare size={64} />
             </motion.div>
             <p className="text-xs font-black text-slate-300 uppercase tracking-[0.5em]">Sem solicitações no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req, i) => (
              <motion.div 
                key={req.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-blue-200 transition-all shadow-sm group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      req.status === 'Respondido' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-black text-slate-900 uppercase text-sm tracking-tight">{req.subject}</p>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase px-2",
                          req.status === 'Respondido' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                        )}>
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Protocolo: {req.id.slice(0, 8)} • {(req.createdAt?.toDate ? req.createdAt.toDate() : new Date()).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-6 font-black uppercase">
                     <div className="hidden md:block">
                        <p className="text-[9px] text-slate-300 uppercase">Categoria</p>
                        <p className="text-[10px] text-slate-500">{req.type || 'Geral'}</p>
                     </div>
                     <ChevronRight className="text-slate-200" size={20} />
                  </div>
                </div>
                
                {req.response && (
                  <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 border-l-emerald-500/40 border-l-4">
                     <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Resposta Administrativa:</p>
                     <p className="text-sm text-slate-700 font-medium leading-relaxed italic">"{req.response}"</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {isRequestModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-xl rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="p-10 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Novo Chamado</h3>
                <button onClick={() => setIsRequestModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <XIcon size={32} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Solicitação</label>
                  <select 
                    value={newRequest.type}
                    onChange={(e) => setNewRequest({...newRequest, type: e.target.value})}
                    className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-slate-900 font-bold text-xs focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="Geral">Assunto Geral</option>
                    <option value="Financeiro">Dúvida Financeira</option>
                    <option value="Acadêmico">Histórico / Matrícula</option>
                    <option value="Secretaria">Secretaria Digital</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assunto</label>
                  <Input 
                    placeholder="Ex: Declaração de Matrícula"
                    value={newRequest.subject}
                    onChange={(e) => setNewRequest({...newRequest, subject: e.target.value})}
                    className="h-14 bg-slate-50 border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-600/20 border-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                  <textarea 
                    placeholder="Descreva aqui o motivo do seu contato..."
                    value={newRequest.description}
                    onChange={(e) => setNewRequest({...newRequest, description: e.target.value})}
                    className="w-full h-40 p-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none text-slate-700 font-medium text-sm transition-all resize-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              <Button 
                onClick={handleNewRequest}
                disabled={isSubmittingRequest || !newRequest.subject || !newRequest.description}
                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl"
              >
                {isSubmittingRequest ? <Loader2 className="animate-spin" /> : "Enviar Protocolo"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );

  const renderProfile = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="bg-white rounded-[3rem] p-12 border border-slate-200 shadow-2xl relative overflow-hidden">
        {/* Profile Header Block */}
        <div className="flex flex-col md:flex-row items-center gap-12 mb-16 relative z-10">
          <div className="relative group">
            <div className="w-48 h-48 rounded-[3.5rem] bg-slate-50 border-2 border-slate-100 overflow-hidden shadow-sm transition-transform group-hover:scale-[1.02]">
              {currentStudent.photoURL ? (
                <img 
                  src={currentStudent.photoURL} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-200">
                  <UserIcon size={80} />
                </div>
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
                </div>
              )}
            </div>
            <label className="absolute -bottom-4 -right-4 w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:bg-blue-500 transition-all hover:rotate-6 border-4 border-white">
              <Camera size={24} />
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </label>
          </div>

          <div className="text-center md:text-left space-y-4">
            <Badge className="bg-blue-600/10 text-blue-600 border-blue-600/20 uppercase text-[10px] font-black px-4 py-1.5 tracking-widest">
              Identidade Estudantil Verified
            </Badge>
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">{currentStudent.name}</h2>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">RA / Matricula</p>
                <p className="text-sm font-bold text-slate-700">{currentStudent.matricula}</p>
              </div>
              <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Status</p>
                <p className="text-sm font-bold text-emerald-600 uppercase">{currentStudent.status || 'Regular'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid - Read Only */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
          {[
            { label: 'CPF do Aluno', value: currentStudent.cpf || '***.***.***-**' },
            { label: 'Data de Nascimento', value: currentStudent.birthDate || 'N/A' },
            { label: 'Curso / Turma', value: `${currentStudent.course && currentStudent.course !== 'N/A' ? currentStudent.course : (classDoc?.courseName || '---')} / ${currentStudent.turma || currentStudent.className || 'Não Vinculado'}` },
            { label: 'Data da Matricula', value: currentStudent.enrollDate || 'Janeiro 2024' },
            { label: 'Endereço da Instituição', value: systemConfig?.address || 'Consulte a Administração' },
            { label: 'Email Institucional', value: systemConfig?.phone || '(11) 99999-9999' },
          ].map((info, i) => (
            <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white transition-all hover:shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">{info.label}</p>
              <p className="text-lg font-bold text-slate-800">{info.value}</p>
            </div>
          ))}
        </div>

        {/* Glass decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />
      </div>
      
      <div className="mt-8 p-8 bg-blue-600/5 rounded-3xl border border-blue-600/10 flex items-center gap-6">
        <div className="p-4 bg-blue-600/10 rounded-2xl text-blue-600">
           <AlertTriangle size={32} />
        </div>
        <div>
          <h4 className="text-slate-900 font-black uppercase tracking-tight">Aviso de Segurança</h4>
          <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
            Seus dados cadastrais são imutáveis via portal por questões de segurança acadêmica. Para alterações contratuais ou retificação de dados, entre em contato com a secretaria do seu núcleo.
          </p>
        </div>
      </div>
    </motion.div>
  );

  const renderHorarios = () => {
    const weekdaysList = [
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
      'Domingo'
    ];

    const timetable: Record<string, any[]> = {};
    weekdaysList.forEach(day => {
      timetable[day] = (schedules || []).filter(s => s.weekday === day);
    });

    return (
      <div className="space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Grade Horária</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Cronograma semanal de aulas e professores</p>
          </div>
          <Button 
            variant="outline" 
            className="bg-white border-slate-200 text-slate-900 rounded-xl uppercase text-[10px] font-black tracking-widest hover:bg-slate-50"
            onClick={() => window.print()}
          >
            <Printer className="mr-2" size={16} /> Imprimir Grade
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-6">
          {weekdaysList.map(day => (
            <div key={day} className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 relative overflow-hidden shadow-sm">
                <h3 className="text-slate-900 font-black uppercase text-[10px] tracking-[0.2em] relative z-10 text-center">{day}</h3>
                <div className="absolute -right-2 -bottom-2 opacity-5 text-slate-900 rotate-12">
                   <Clock size={48} />
                </div>
              </div>

              <div className="space-y-3">
                {timetable[day].length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300">
                    <Clock size={20} className="opacity-20 mb-2" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-center">Sem Aulas</span>
                  </div>
                ) : (
                  timetable[day].map(entry => (
                    <div 
                      key={entry.id} 
                      className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-blue-200 shadow-sm transition-all group relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className={cn(
                            "text-[8px] font-black uppercase px-2 py-0.5 border-none",
                            entry.period === 'Manhã' ? "bg-amber-500/10 text-amber-600" :
                            entry.period === 'Noite' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" :
                            "bg-emerald-500/10 text-emerald-600"
                          )}>
                            {entry.period}
                          </Badge>
                          <span className="text-[9px] font-black text-slate-400">{entry.startTime} - {entry.endTime}</span>
                        </div>

                        <div>
                          <h4 className="font-black text-slate-900 uppercase text-[11px] leading-tight tracking-tight">{entry.subjectName}</h4>
                          <p className="text-[9px] font-bold text-blue-600 uppercase mt-1">Sala {entry.room}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-50 flex items-center gap-2 text-slate-400">
                           <UserIcon size={12} className="text-slate-300" />
                           <span className="text-[9px] font-bold truncate tracking-tight">{entry.teacherName}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-12 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Histórico Acadêmico</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Sua jornada de conhecimento e conquistas</p>
        </div>
        <Button 
          variant="outline" 
          className="bg-white border-slate-200 text-slate-900 rounded-xl uppercase text-[10px] font-black tracking-widest hover:bg-slate-50"
          onClick={() => window.print()}
        >
          <Printer className="mr-2" size={16} /> Imprimir Histórico
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Concluídas', count: historyData.completed.length, color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle },
          { label: 'Cursando', count: historyData.inProgress.length, color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
          { label: 'Pendentes', count: historyData.pending.length, color: 'text-rose-600', bg: 'bg-rose-500/10', icon: AlertCircle },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
            <div className={cn("p-5 rounded-3xl", stat.bg, stat.color)}>
              <stat.icon size={32} />
            </div>
            <div>
              <h4 className={cn("text-4xl font-black tracking-tighter", stat.color)}>{stat.count}</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-16">
        {historyData.inProgress.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-2 h-10 bg-amber-500 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.2)]" />
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cursando Atualmente</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {historyData.inProgress.map(item => (
                <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-amber-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-amber-500/10 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 uppercase text-sm tracking-tight leading-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.year} Ano • Módulo {item.module}</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-600 border-none font-black text-[9px] uppercase px-3 py-1">EM PROGRESSO</Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-2 h-10 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)]" />
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Disciplinas Concluídas</h3>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Disciplina</th>
                    <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Média Final</th>
                    <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Faltas</th>
                    <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyData.completed.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-20 text-center text-slate-200 font-black uppercase text-xs tracking-[0.3em]">Nenhuma disciplina concluída ainda.</td>
                    </tr>
                  ) : (
                    historyData.completed.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-all group">
                        <td className="p-6">
                          <p className="font-black text-slate-900 uppercase text-sm tracking-tight group-hover:text-emerald-600 transition-colors">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.year} Ano • {item.workload}h</p>
                        </td>
                        <td className="p-6 text-center font-black text-emerald-600 text-xl tracking-tighter">
                          {item.status === 'Dispensada' ? '-' : (item.grade || 0).toFixed(1)}
                        </td>
                        <td className="p-6 text-center font-bold text-slate-400 text-sm">
                          {item.status === 'Dispensada' ? '-' : item.absences}
                        </td>
                        <td className="p-6 text-right">
                          {item.status === 'Dispensada' ? (
                            <Badge className="bg-blue-500/10 text-blue-600 border-none font-black text-[9px] uppercase px-4 py-1">Dispensada</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[9px] uppercase px-4 py-1">Aprovado</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-2 h-10 bg-rose-500 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.2)]" />
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Disciplinas Pendentes</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {historyData.pending.map(item => (
              <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 opacity-60 hover:opacity-100 transition-all group relative overflow-hidden shadow-sm">
                <div className="space-y-3">
                  <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl w-fit group-hover:scale-110 transition-transform">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 uppercase text-[11px] leading-tight tracking-tight">{item.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.year} Ano</p>
                  </div>
                  <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-rose-500/20 text-rose-500/50">Pendente</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-600 selection:text-white">
      {/* 🚀 Institutional Header */}
      <header className="fixed top-0 left-0 right-0 z-[500] bg-white/80 backdrop-blur-3xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
             {systemConfig?.logoUrl ? (
               <div className="h-12 flex items-center justify-center p-1 overflow-hidden">
                  <img src={systemConfig.logoUrl} alt="ESTEADEB" className="h-full object-contain" />
               </div>
             ) : (
               <div className="w-12 h-12 bg-navy-dark rounded-2xl flex items-center justify-center p-2 shadow-xl overflow-hidden">
                  <span className="text-white font-black text-xl">E</span>
               </div>
             )}
             <div className="hidden sm:block">
                <h1 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">ESTEADEB OS</h1>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1">Portal do Aluno</p>
             </div>
          </div>

          <nav className="hidden lg:flex items-center gap-2">
            {[
              { id: 'Início', icon: HomeIcon },
              { id: 'Boletim', icon: Award },
              { id: 'Horários', icon: Clock },
              { id: 'Histórico', icon: FileText },
              { id: 'Financeiro', icon: Wallet },
              { id: 'Contratos', icon: ShieldCheck },
              { id: 'Requerimentos', icon: MessageCircle },
              { id: 'Avisos', icon: Bell },
              { id: 'Meu Perfil', icon: UserIcon }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  activeTab === item.id 
                    ? "bg-slate-900 text-white shadow-lg" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <item.icon size={14} />
                {item.id}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{currentStudent?.name?.split(' ')[0] || 'Aluno'}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{currentStudent?.matricula || ''}</p>
             </div>
             
             {/* Logout button */}

             <button 
               onClick={logoutStudent}
               className="p-3 bg-rose-600/10 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all"
               title="Sair"
             >
               <LogOut size={18} />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 pt-32 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'Início' && renderHome()}
            {activeTab === 'Boletim' && renderBoletim()}
            {activeTab === 'Horários' && renderHorarios()}
            {activeTab === 'Histórico' && renderHistory()}
            {activeTab === 'Financeiro' && renderFinanceiro()}
            {activeTab === 'Contratos' && renderContratos()}
            {activeTab === 'Requerimentos' && renderRequests()}
            {activeTab === 'Avisos' && renderAnnouncements()}
            {activeTab === 'Meu Perfil' && renderProfile()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bar */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] w-[90%] max-w-[400px] bg-white/90 backdrop-blur-2xl border border-slate-200 px-4 py-3 flex items-center justify-between rounded-3xl shadow-2xl overflow-x-auto custom-scrollbar">
        {[
          { id: 'Início', icon: HomeIcon },
          { id: 'Boletim', icon: Award },
          { id: 'Histórico', icon: FileText },
          { id: 'Financeiro', icon: Wallet },
          { id: 'Requerimentos', icon: MessageCircle },
          { id: 'Meu Perfil', icon: UserIcon }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "p-3 rounded-2xl transition-all flex-shrink-0",
              activeTab === item.id ? "bg-slate-900 text-white" : "text-slate-400"
            )}
            title={item.id}
          >
            <item.icon size={20} />
          </button>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}} />
    </div>
  );
};


