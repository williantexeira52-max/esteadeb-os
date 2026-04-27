import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  doc, 
  writeBatch, 
  serverTimestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ClipboardCheck, 
  Search, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Users,
  BookOpen,
  Layers,
  Clock,
  AlertTriangle,
  ChevronDown,
  Filter,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface StudentGrade {
  studentId: string;
  studentName: string;
  grade: number;
  absences: number;
  status: string;
}

export const GradesEntry: React.FC = () => {
  const { nucleo, profile, user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [moduleHistory, setModuleHistory] = useState<any[]>([]);
  const [students, setStudents] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    classId: '',
    year: '1º',
    module: '' as string | number,
    subjectId: ''
  });

  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Fetch Classes, Subjects and Module History
  useEffect(() => {
    if (!profile) return;
    
    // Classes filtered by nucleo and polo
    let qClasses = query(
      collection(db, 'classes'), 
      where('nucleoId', '==', nucleo), 
      orderBy('name', 'asc')
    );

    if (profile?.poloId) {
      qClasses = query(
        collection(db, 'classes'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('name', 'asc')
      );
    }

    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'classes'));

    // Grades filtered by nucleo
    const qGrades = query(
      collection(db, 'grades'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribeGrades = onSnapshot(qGrades, (snapshot) => {
      setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'grades'));

    // Module History filtered by nucleo
    const qModules = query(
      collection(db, 'modules_history'), 
      where('nucleoId', '==', nucleo),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeModules = onSnapshot(qModules, (snapshot) => {
      setModuleHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'modules_history'));

    return () => {
      unsubscribeClasses();
      unsubscribeGrades();
      unsubscribeModules();
    };
  }, [nucleo]);

  // Extract unique modules linked specifically to this class and YEAR in the Modules History
  const availableModules = useMemo(() => {
    if (!filters.classId) return [];
    
    // Filter history to find modules assigned to this specific class AND YEAR
    const classModules = moduleHistory.filter(m => {
      if (m.classId !== filters.classId) return false;
      if (!filters.year) return true;
      const mYearStr = m.year?.toString() || '';
      const fYearStr = filters.year?.toString() || '';
      return mYearStr.replace(/[^0-9]/g, '') === fYearStr.replace(/[^0-9]/g, '');
    });
    
    if (classModules.length === 0) return [];
    
    // Return unique module numbers registered for this class
    const modules = new Set<string>();
    classModules.forEach(m => {
      if (m.moduleNumber) modules.add(m.moduleNumber.toString());
    });
    
    return Array.from(modules).sort((a, b) => parseInt(a) - parseInt(b));
  }, [filters.classId, filters.year, moduleHistory]);

  const filteredSubjects = useMemo(() => {
    if (!filters.classId || !filters.module) return [];
    
    // 1. Find the module record in history (filtered by class, number AND year)
    const moduleRecord = moduleHistory.find(m => {
      if (m.classId !== filters.classId) return false;
      if (m.moduleNumber?.toString() !== filters.module?.toString()) return false;
      if (!filters.year) return true;
      const mYearStr = m.year?.toString() || '';
      const fYearStr = filters.year?.toString() || '';
      return mYearStr.replace(/[^0-9]/g, '') === fYearStr.replace(/[^0-9]/g, '');
    });

    if (!moduleRecord || !moduleRecord.subjects) return [];

    const selectedClass = classes.find(c => c.id === filters.classId);
    const classCourse = (selectedClass?.courseName || selectedClass?.course || "").toLowerCase().trim();

    // 2. Map the subject names from history to the full subject objects from grades
    // We filter by course to avoid duplicates from other courses with same names
    // And we deduplicate by name just in case there are multiple entries for the same subject in the same course
    const matchingSubjects = grades.filter(g => {
      const subjectCourse = (g.course || "").toLowerCase().trim();
      return moduleRecord.subjects.includes(g.name) && (subjectCourse === classCourse || !classCourse);
    });

    const seen = new Set();
    return matchingSubjects.filter(g => {
      if (seen.has(g.name)) return false;
      seen.add(g.name);
      return true;
    });
  }, [filters.classId, filters.module, moduleHistory, grades, classes]);

  // Auto-select module if only one is available for the class
  useEffect(() => {
    if (availableModules.length > 0 && !filters.module) {
      setFilters(prev => ({ ...prev, module: availableModules[0] }));
    } else if (filters.module && !availableModules.includes(filters.module.toString())) {
      if (availableModules.length > 0) {
        setFilters(prev => ({ ...prev, module: availableModules[0] }));
      } else {
        setFilters(prev => ({ ...prev, module: '' }));
      }
    }
  }, [availableModules, filters.module]);

  // Auto-select subject if only one matches the filters
  useEffect(() => {
    if (filteredSubjects.length === 1 && filters.subjectId !== filteredSubjects[0].id) {
      setFilters(prev => ({ ...prev, subjectId: filteredSubjects[0].id }));
    } else if (filters.subjectId && !filteredSubjects.some(s => s.id === filters.subjectId)) {
      // Reset subject if it's no longer in the filtered list
      setFilters(prev => ({ ...prev, subjectId: '' }));
    }
  }, [filteredSubjects, filters.subjectId]);

  // Sync year with selected class
  useEffect(() => {
    if (filters.classId) {
      const selectedClass = classes.find(c => c.id === filters.classId);
      if (selectedClass?.year) {
        // Extract the prefix (e.g. "1º" from "1º Ano")
        const classYearPrefix = selectedClass.year.split(' ')[0];
        if (classYearPrefix && filters.year !== classYearPrefix) {
          setFilters(prev => ({ ...prev, year: classYearPrefix }));
        }
      }
    }
  }, [filters.classId, classes]);

  // Fetch Students when Class is selected
  useEffect(() => {
    if (!filters.classId) {
      setStudents([]);
      return;
    }

    const fetchStudents = async () => {
      setLoading(true);
      try {
        // Assuming students have a 'classId' and 'poloId' field.
        let q = query(
          collection(db, 'students'), 
          where('nucleoId', '==', nucleo),
          where('classId', '==', filters.classId)
        );

        if (profile?.poloId) {
          q = query(
            collection(db, 'students'),
            where('nucleoId', '==', nucleo),
            where('classId', '==', filters.classId),
            where('poloId', '==', profile.poloId)
          );
        }
        
        const snapshot = await getDocs(q);
        
        // Also fetch existing records to populate current grades/absences
        const qRecords = query(
          collection(db, 'academic_records'),
          where('turmaId', '==', filters.classId),
          where('disciplinaId', '==', filters.subjectId),
          where('modulo', '==', filters.module)
        );
        const recordsSnapshot = await getDocs(qRecords);
        const existingRecords: Record<string, any> = {};
        recordsSnapshot.forEach(doc => {
          existingRecords[doc.data().studentId] = doc.data();
        });

        const studentList = snapshot.docs
          .map(doc => {
            const data = doc.data();
            const existing = existingRecords[doc.id];
            return {
              id: doc.id,
              studentId: doc.id,
              name: data.name,
              studentName: data.name,
              cpf: data.cpf,
              deleted: data.deleted,
              status: data.status,
              grade: existing?.nota ?? 0,
              absences: existing?.faltas ?? 0,
              calculatedStatus: calculateStatus(existing?.nota ?? 0, existing?.faltas ?? 0)
            };
          })
          .filter(s => !s.deleted && s.status !== 'inativo');

        // Strict Deduplication by Normalized CPF or ID/Name fallback
        const seen = new Set();
        const uniqueStudents = studentList.filter(s => {
          const normalizedCpf = s.cpf?.toString().replace(/\D/g, '');
          const key = normalizedCpf || s.name?.toLowerCase().trim() || s.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setStudents(uniqueStudents.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          grade: s.grade,
          absences: s.absences,
          status: s.calculatedStatus
        })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'students');
        addToast('Erro ao carregar alunos.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [filters.classId, filters.subjectId, filters.module, nucleo]);

  const calculateStatus = (grade: number, absences: number) => {
    if (absences > 2) return 'Reprovado por Falta';
    if (grade >= 7.0) return 'Aprovado';
    if (grade < 6.0) return 'Reprovado';
    return 'Recuperação';
  };

  const handleUpdateStudent = (index: number, field: 'grade' | 'absences' | 'status', value: string) => {
    const updatedStudents = [...students];
    const student = { ...updatedStudents[index] };

    if (field === 'status') {
      student.status = value;
    } else {
      const numValue = parseFloat(value) || 0;
      if (field === 'grade') {
        student.grade = Math.min(10, Math.max(0, numValue));
      } else {
        student.absences = Math.min(8, Math.max(0, Math.floor(numValue)));
      }
      student.status = calculateStatus(student.grade, student.absences);
    }

    updatedStudents[index] = student;
    setStudents(updatedStudents);
  };

  const handleSaveAll = async () => {
    if (!filters.classId || !filters.subjectId) {
      addToast('Selecione a turma e a disciplina.', 'error');
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const selectedSubject = grades.find(g => g.id === filters.subjectId);

      students.forEach(s => {
        // Pattern: studentId_disciplinaId_modulo
        const docId = `${s.studentId}_${filters.subjectId}_${filters.module}`;
        const docRef = doc(db, 'academic_records', docId);
        
        batch.set(docRef, {
          studentId: s.studentId,
          studentName: s.studentName,
          turmaId: filters.classId,
          disciplinaId: filters.subjectId,
          disciplina: selectedSubject?.name || '',
          ano: filters.year,
          modulo: filters.module,
          poloId: profile?.poloId || null,
          poloName: profile?.poloName || 'MATRIZ',
          nota: s.grade,
          faltas: s.absences,
          status: s.status,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || profile?.id || 'system',
          timestamp: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      addToast('Notas salvas com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'academic_records');
      addToast('Erro ao salvar notas.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    if (students.length === 0) {
      addToast('Selecione uma turma e disciplina com alunos para gerar o modelo.', 'error');
      return;
    }
    const data = students.map(s => ({
      'ID Aluno (NAO ALTERAR)': s.studentId,
      'Nome do Aluno': s.studentName,
      'Nota (0-10)': s.grade,
      'Faltas': s.absences
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notas");
    XLSX.writeFile(workbook, `Modelo_Notas_${filters.classId}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const updatedStudents = students.map(stu => {
          const matched = data.find(r => r['ID Aluno (NAO ALTERAR)'] === stu.studentId);
          if (matched) {
            const tempGrade = parseFloat(matched['Nota (0-10)']);
            const grade = isNaN(tempGrade) ? stu.grade : Math.max(0, Math.min(10, tempGrade));
            const tempAbsences = parseInt(matched['Faltas']);
            const absences = isNaN(tempAbsences) ? stu.absences : Math.max(0, tempAbsences);
            
            const status = (grade >= 7 && absences <= 2) ? 'Aprovado' : 'Reprovado';
            
            return {
              ...stu,
              grade,
              absences,
              status
            };
          }
          return stu;
        });
        
        setStudents(updatedStudents);
        addToast('Lote processado. Revise as notas e clique em Salvar.', 'success');
      } catch (err) {
        addToast('Erro ao ler o arquivo Excel.', 'error');
      }
      e.target.value = ''; // Reset input
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Lançamento de Notas</h1>
          <p className="text-slate-500 font-medium mt-1">Entrada massiva de avaliações e frequências por disciplina.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle size={20} />
          </div>
          <div className="pr-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Política de Faltas</p>
            <p className="text-xs font-bold text-slate-700">Máximo: 2 faltas.</p>
            <p className="text-[9px] font-bold text-amber-600 mt-0.5">* Faltas Abonadas não debitam do limite.</p>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Turma</label>
            <select 
              className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
              value={filters.classId}
              onChange={(e) => setFilters({...filters, classId: e.target.value})}
            >
              <option value="">Selecione a Turma</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Ano</label>
            <select 
              className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
              value={filters.year}
              onChange={(e) => setFilters({...filters, year: e.target.value})}
            >
              <option value="1º">1º Ano</option>
              <option value="2º">2º Ano</option>
              <option value="3º">3º Ano</option>
              <option value="4º">4º Ano</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Módulo</label>
            <select 
              className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
              value={filters.module}
              onChange={(e) => setFilters({...filters, module: e.target.value})}
              disabled={!filters.classId}
            >
              <option value="">{filters.classId ? 'Selecione o Módulo' : 'Turma primeiro'}</option>
              {availableModules.map(m => (
                <option key={m} value={m}>Módulo {m}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Disciplina</label>
            <select 
              className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
              value={filters.subjectId}
              onChange={(e) => setFilters({...filters, subjectId: e.target.value})}
              disabled={!filters.classId}
            >
              <option value="">{filters.classId ? 'Selecione a Disciplina' : 'Selecione uma Turma primeiro'}</option>
              {filteredSubjects.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-navy text-white rounded-xl">
              <Users size={20} />
            </div>
            <h3 className="font-black text-navy uppercase tracking-tight">Lista de Alunos da Turma</h3>
          </div>
          {students.length > 0 && (
            <div className="flex items-center gap-3">
              <Badge className="bg-slate-200 text-slate-700 border-none font-black px-4 py-2 hover:bg-slate-200 uppercase">
                {students.length} ALUNOS ENCONTRADOS
              </Badge>
              <Button onClick={downloadTemplate} variant="outline" className="border-petrol text-petrol hover:bg-petrol hover:text-white rounded-xl font-bold text-xs uppercase h-8">
                Baixar Molde Excel
              </Button>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase h-8 pointer-events-none">
                  Importar Notas Excel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Nome do Aluno</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-center w-32">Nota (0-10)</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-center w-32">Faltas (0-8)</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-center">Status Final</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <td colSpan={4} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-petrol animate-spin" />
                      <p className="font-bold uppercase tracking-widest text-xs text-slate-400">Buscando alunos...</p>
                    </div>
                  </td>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <td colSpan={4} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                        <Users size={40} className="opacity-20" />
                      </div>
                      <p className="font-bold uppercase tracking-widest text-xs">Selecione uma turma para carregar os alunos.</p>
                    </div>
                  </td>
                </TableRow>
              ) : (
                students.map((student, index) => (
                  <TableRow key={student.studentId} className="hover:bg-slate-50/50 transition-all group">
                    <td className="p-6">
                      <p className="font-black text-slate-900 uppercase text-sm tracking-tight">{student.studentName}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {student.studentId.slice(0, 8)}</p>
                    </td>
                    <td className="p-6">
                      <Input 
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        disabled={student.status === 'Dispensada'}
                        className="h-12 text-center font-black text-lg bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol"
                        value={student.grade}
                        onChange={(e) => handleUpdateStudent(index, 'grade', e.target.value)}
                      />
                    </td>
                    <td className="p-6">
                      <Input 
                        type="number"
                        min="0"
                        max="8"
                        disabled={student.status === 'Dispensada'}
                        className="h-12 text-center font-black text-lg bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol"
                        value={student.absences}
                        onChange={(e) => handleUpdateStudent(index, 'absences', e.target.value)}
                      />
                    </td>
                    <td className="p-6 text-center">
                      <Badge className={cn(
                        "font-black text-[10px] uppercase px-4 py-1.5 rounded-full border-none",
                        student.status === 'Aprovado' ? "bg-emerald-100 text-emerald-700" :
                        student.status === 'Recuperação' ? "bg-amber-100 text-amber-700" :
                        student.status === 'Dispensada' ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {student.status}
                      </Badge>
                    </td>
                    <td className="p-6 text-right">
                      {student.status !== 'Dispensada' ? (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                          onClick={() => handleUpdateStudent(index, 'status', 'Dispensada')}
                          title="Lançar Dispensa"
                        >
                          <ShieldCheck size={16} />
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:bg-slate-50"
                          onClick={() => handleUpdateStudent(index, 'grade', '0')}
                          title="Remover Dispensa"
                        >
                          <X size={16} />
                        </Button>
                      )}
                    </td>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {students.length > 0 && (
          <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
            <Button 
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-petrol hover:bg-petrol-dark text-white px-10 py-7 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-petrol/20 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
              Salvar Notas da Turma
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
