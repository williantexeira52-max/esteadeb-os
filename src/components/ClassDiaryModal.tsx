import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Printer, Loader2, FileText, Settings, Users, Save, CheckCircle2, ChevronRight, AlertCircle, X } from 'lucide-react';
import { collection, getDocs, query, orderBy, where, doc, setDoc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface ClassDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClass?: any;
}

export const ClassDiaryModal: React.FC<ClassDiaryModalProps> = ({ isOpen, onClose, targetClass }) => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'config' | 'chamada' | 'exportar'>('config');

  // Diary State
  const [diaryConfig, setDiaryConfig] = useState<any>(null); // Config from DB
  const [datesConfig, setDatesConfig] = useState<{dateStr: string, active: boolean}[]>([]); // generated list
  
  const [firstClassDate, setFirstClassDate] = useState<Date | undefined>(new Date());
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]); // 0=Sun, 1=Mon...
  
  // Attendance State
  const [attendanceData, setAttendanceData] = useState<Record<string, Record<string, string>>>({}); // studentId -> dateStr -> 'P'|'F'|'A'
  const [justifications, setJustifications] = useState<Record<string, Record<string, string>>>({}); // studentId -> dateStr -> reason

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setActiveTab('config');
      setSelectedSubject('');
      setSelectedTeacher('');
      setDiaryConfig(null);
      setDatesConfig([]);
    }
  }, [isOpen, targetClass]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Subjects
      const subjectsRef = collection(db, 'grades');
      let subjectsQuery = query(subjectsRef, orderBy('name', 'asc'));
      if (targetClass?.courseName) {
        subjectsQuery = query(subjectsRef, where('course', '==', targetClass.courseName), orderBy('name', 'asc'));
      }
      const subjectsSnap = await getDocs(subjectsQuery);
      setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch Teachers
      const employeesRef = collection(db, 'app_users');
      const employeesSnap = await getDocs(employeesRef);
      setTeachers(employeesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((emp: any) => emp.role?.toLowerCase().includes('prof') || emp.role?.toLowerCase().includes('doce') || emp.role === 'Direção')
      );

      // Fetch Students
      if (targetClass?.id) {
        const studentsRef = collection(db, 'students');
        const studentsQuery = query(studentsRef, where('classId', '==', targetClass.id), orderBy('name', 'asc'));
        const studentsSnap = await getDocs(studentsQuery);
        setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    } catch (error) {
      console.error("Error fetching diary data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDiaryDocId = () => {
    if (!targetClass?.id || !selectedSubject) return null;
    return `${targetClass.id}_${selectedSubject}`;
  };

  // Load configuration and attendances
  const loadDiaryConfiguration = async () => {
    const docId = getDiaryDocId();
    if (!docId) return;

    setLoading(true);
    try {
      const docRef = doc(db, 'class_diaries', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDiaryConfig(data);
        if (data.teacherId) setSelectedTeacher(data.teacherId);
        if (data.datesConfig) setDatesConfig(data.datesConfig);
        if (data.attendance) setAttendanceData(data.attendance);
        if (data.justifications) setJustifications(data.justifications);
        if (data.firstClassDate) setFirstClassDate(new Date(data.firstClassDate));
      } else {
        setDiaryConfig(null);
        setDatesConfig([]);
        setAttendanceData({});
        setJustifications({});
      }
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSubject) {
      loadDiaryConfiguration();
    }
  }, [selectedSubject]);

  // Generate Preview Dates
  const generateDatesPreview = () => {
    if (!firstClassDate) return;
    let current = new Date(firstClassDate);
    const newDates = [];
    
    // We want 8 classes by default based on the previous logic
    for (let i = 0; i < 8; i++) {
        // default interval is 7 days if no week days selected, else we'd search next matching day.
        // For simplicity, just add 7 days per class as the original did.
        newDates.push({
            dateStr: format(addDays(current, i * 7), 'yyyy-MM-dd'),
            active: true
        });
    }
    setDatesConfig(newDates);
  };

  const toggleDateActive = (index: number) => {
    const newDates = [...datesConfig];
    newDates[index].active = !newDates[index].active;
    
    // When unchecking, automatically add a new date at the end.
    if (!newDates[index].active) {
        // Find the last date
        const lastDate = new Date(newDates[newDates.length - 1].dateStr + 'T12:00:00');
        newDates.push({
            dateStr: format(addDays(lastDate, 7), 'yyyy-MM-dd'),
            active: true
        });
    }
    setDatesConfig(newDates);
  };

  const saveConfiguration = async () => {
    const docId = getDiaryDocId();
    if (!docId || !selectedTeacher || datesConfig.length === 0) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'class_diaries', docId), {
        classId: targetClass.id,
        subjectId: selectedSubject,
        teacherId: selectedTeacher,
        datesConfig,
        firstClassDate: firstClassDate?.toISOString(),
        attendance: attendanceData,
        justifications: justifications,
      }, { merge: true });
      await loadDiaryConfiguration();
      setActiveTab('chamada');
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setAttendance = (studentId: string, dateStr: string, value: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [dateStr]: value
      }
    }));
  };

  const setJustification = (studentId: string, dateStr: string, reason: string) => {
    setJustifications(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [dateStr]: reason
      }
    }));
  };

  const saveAttendance = async () => {
    const docId = getDiaryDocId();
    if (!docId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'class_diaries', docId), {
        attendance: attendanceData,
        justifications: justifications
      });
      // Update the total absences in academic_records for each student
      const batch = writeBatch(db);
      for (const student of students) {
        const studentAtt = attendanceData[student.id] || {};
        let totalAbsences = 0;
        
        let validDatesCount = 0; // limit logic? No, just sum the 'F'
        Object.keys(studentAtt).forEach(dUrl => {
            if (studentAtt[dUrl] === 'F') totalAbsences++;
        });

        // Find academic_record
        const q = query(
          collection(db, 'academic_records'),
          where('studentId', '==', student.id),
          where('turmaId', '==', targetClass.id),
          where('disciplinaId', '==', selectedSubject)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const recRef = doc(db, 'academic_records', snap.docs[0].id);
          batch.update(recRef, { faltas: totalAbsences });
        }
      }
      await batch.commit();

      alert("Chamada salva com sucesso!");
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!selectedSubject || !selectedTeacher || datesConfig.length === 0) return;
    
    // Only active dates
    const activeDates = datesConfig.filter(d => d.active).map(d => new Date(d.dateStr + 'T12:00:00'));
    
    const teacherName = teachers.find(t => t.id === selectedTeacher)?.name || selectedTeacher;
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name || selectedSubject;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Get justification table string
    let justificationsHTML = '';
    const hasJustifs = Object.keys(justifications).length > 0;
    if (hasJustifs) {
        justificationsHTML = `
            <div style="margin-top: 30px;">
                <h3 style="font-weight: 900; margin-bottom: 10px;">Justificativas de Faltas Abonadas</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #ccc; padding: 4px;">Aluno</th>
                            <th style="border: 1px solid #ccc; padding: 4px;">Data</th>
                            <th style="border: 1px solid #ccc; padding: 4px;">Justificativa</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => {
                            const studentJustifs = justifications[s.id] || {};
                            return Object.keys(studentJustifs).filter(d => studentJustifs[d] && attendanceData[s.id]?.[d] === 'A').map(d => `
                                <tr>
                                    <td style="border: 1px solid #ccc; padding: 4px;">${s.name}</td>
                                    <td style="border: 1px solid #ccc; padding: 4px;">${format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                                    <td style="border: 1px solid #ccc; padding: 4px;">${studentJustifs[d]}</td>
                                </tr>
                            `).join('')
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    const content = `
      <html>
        <head>
          <title>Diário de Classe - ESTEADEB</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            @page landscape { size: A4 landscape; margin: 0; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #fff; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { padding: 40px; box-sizing: border-box; page-break-after: always; position: relative; height: 100vh; }
            .landscape { padding: 20px 40px; height: 210mm; width: 297mm; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #001F3F; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: 900; color: #001F3F; letter-spacing: -1px; }
            .logo span { color: #008080; }
            .title-box { text-align: center; margin: 40px 0; }
            .title-box h1 { font-size: 32px; font-weight: 900; color: #001F3F; margin: 5px 0; letter-spacing: -1px; }
            .title-box p { font-size: 12px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 2px; margin: 0; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; }
            .info-item { background: #f8f9fa; padding: 15px 20px; border-radius: 12px; border-left: 4px solid #008080; }
            .info-label { font-size: 10px; font-weight: 900; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
            .info-value { font-size: 14px; font-weight: 700; color: #001F3F; }
            .footer { position: absolute; bottom: 40px; left: 40px; right: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
            .signature-box { text-align: center; width: 200px; }
            .signature-line { border-top: 1px solid #000; margin-bottom: 8px; }
            .signature-label { font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .page-number { position: absolute; bottom: 40px; right: 40px; font-size: 10px; font-weight: 900; color: #ccc; }
            table.pauta-table { width: 100%; border-collapse: collapse; font-size: 9px; }
            .pauta-table th { background: #001F3F; color: white; padding: 8px 4px; border: 1px solid #000; font-weight: 700; text-transform: uppercase; }
            .pauta-table td { padding: 4px; border: 1px solid #000; height: 16px; }
            .date-col { width: 35px; text-align: center; }
            .grade-col { width: 45px; text-align: center; }
          </style>
        </head>
        <body>
          <!-- PAGE 1: CAPA -->
          <div class="page">
            <div class="header">
              <div class="logo">ESTEADEB <span>2026</span></div>
              <div style="text-align: right">
                <div class="info-label">Controle de Frequência e Notas</div>
                <div style="font-weight: 900; font-size: 14px;">DOCUMENTO ACADÊMICO OFICIAL</div>
              </div>
            </div>
            
            <div class="title-box">
              <p>Secretaria de Ensino</p>
              <h1>DIÁRIO DE CLASSE</h1>
              <div style="width: 120px; height: 6px; background: #008080; margin: 30px auto; border-radius: 3px;"></div>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Disciplina / Matéria</div>
                <div class="info-value">${subjectName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Professor Responsável</div>
                <div class="info-value">${teacherName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Turma Vinculada</div>
                <div class="info-value">${targetClass?.name || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Curso Acadêmico</div>
                <div class="info-value">${targetClass?.courseName || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Período Letivo</div>
                <div class="info-value">${activeDates.length > 0 ? format(activeDates[0], 'MMMM/yyyy', { locale: ptBR }) : ''}</div>
              </div>
            </div>

            <div style="margin-top: 80px; padding: 40px; border: 2px dashed #eee; border-radius: 30px; text-align: center;">
              <div style="font-size: 10px; font-weight: 900; color: #ccc; text-transform: uppercase; margin-bottom: 20px;">Espaço para Carimbo da Instituição</div>
              <div style="height: 100px;"></div>
            </div>
            
            <div class="footer">
              <div style="display: flex; gap: 50px;">
                <div class="signature-box">
                  <div class="signature-line"></div>
                  <div class="signature-label">Assinatura do Docente</div>
                </div>
                <div class="signature-box">
                  <div style="font-weight: 900; font-size: 14px;">William Carvalho</div>
                  <div class="signature-line"></div>
                  <div class="signature-label">Coordenador</div>
                </div>
              </div>
            </div>
            <div class="page-number">PÁGINA 01</div>
          </div>

          <!-- PAGE 2: PAUTA -->
          <div class="page landscape">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #001F3F; padding-bottom: 10px;">
              <div>
                <h2 style="margin: 0; font-weight: 900; text-transform: uppercase; font-size: 20px; letter-spacing: -1px;">Pauta de Frequência e Avaliações</h2>
                <div style="font-size: 10px; font-weight: 700; color: #008080; text-transform: uppercase; margin-top: 2px;">${subjectName} | ${targetClass?.name || ''}</div>
              </div>
            </div>
            
            <table class="pauta-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 30px;">Nº</th>
                  <th rowspan="2">Nome Completo do Aluno</th>
                  <th colspan="${activeDates.length}">Controle de Frequência</th>
                  <th colspan="4">Resultados Finais</th>
                </tr>
                <tr>
                  ${activeDates.map(d => `<th class="date-col">${format(d, 'dd/MM')}</th>`).join('')}
                  <th class="grade-col">AV1</th>
                  <th class="grade-col">AV2</th>
                  <th class="grade-col">MÉDIA</th>
                  <th class="grade-col">FALTAS</th>
                </tr>
              </thead>
              <tbody>
                ${students.length > 0 ? students.map((s, idx) => {
                    let totalFaltas = 0;
                    const freqCols = activeDates.map(d => {
                        const dStr = format(d, 'yyyy-MM-dd');
                        const status = attendanceData[s.id]?.[dStr];
                        if (status === 'F') totalFaltas++;
                        return `<td class="date-col" style="font-weight: 800; font-size: 11px; text-align: center; color: ${status === 'P' ? 'green' : status === 'F' ? 'red' : status === 'A' ? 'orange' : '#000'}">${status || ''}</td>`;
                    }).join('');
                    
                    return `
                  <tr>
                    <td style="text-align: center; font-weight: 700; background: #f8f9fa;">${(idx + 1).toString().padStart(2, '0')}</td>
                    <td style="font-weight: 700; text-transform: uppercase; font-size: 10px;">${s.name}</td>
                    ${freqCols}
                    <td class="grade-col"></td>
                    <td class="grade-col"></td>
                    <td class="grade-col"></td>
                    <td class="grade-col" style="font-weight: 900; text-align:center;">${totalFaltas}</td>
                  </tr>`
                }).join('') : `<tr><td colspan="15">Nenhum aluno.</td></tr>`}
              </tbody>
            </table>
            
            ${justificationsHTML}

            <div class="footer">
              <div class="signature-box" style="margin-right: 50px;">
                <div style="font-weight: 900; font-size: 12px;">William Carvalho</div>
                <div class="signature-line" style="margin-top: 2px;"></div>
                <div class="signature-label">Coordenador</div>
              </div>
            </div>

            <div class="page-number">PÁGINA 02</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const activeDatesCount = datesConfig.filter(d => d.active).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[7xl] w-[95vw] h-[95vh] rounded-3xl border-none shadow-2xl p-0 overflow-hidden flex flex-col">
        <DialogHeader className="bg-navy p-6 shrink-0 text-white flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-petrol rounded-2xl">
              <FileText size={24} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Diário de Classe</DialogTitle>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">Gestão de Frequência e Relatórios</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
            {/* Context Selectors */}
            <div className="bg-white p-6 border-b border-slate-100 flex gap-4 shrink-0 shadow-sm relative z-10">
                <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Disciplina</label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                        <SelectTrigger className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-petrol font-bold">
                        <SelectValue placeholder="Escolha a disciplina..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                        {subjects.map(s => (
                            <SelectItem key={s.id} value={s.id} className="font-bold py-3">{s.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedSubject ? (
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 bg-white border-r border-slate-100 p-4 shrink-0 flex flex-col gap-2">
                        <button 
                            onClick={() => setActiveTab('config')}
                            className={cn("flex items-center gap-3 w-full p-4 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all text-left", activeTab === 'config' ? 'bg-petrol text-white' : 'hover:bg-slate-50 text-slate-500')}
                        >
                            <Settings size={18} /> Configurar Datas
                        </button>
                        <button 
                            onClick={() => setActiveTab('chamada')}
                            disabled={!diaryConfig}
                            className={cn("flex items-center gap-3 w-full p-4 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all text-left disabled:opacity-50", activeTab === 'chamada' ? 'bg-petrol text-white' : 'hover:bg-slate-50 text-slate-500')}
                        >
                            <Users size={18} /> Tela de Chamada
                        </button>
                        <button 
                            onClick={() => setActiveTab('exportar')}
                            disabled={!diaryConfig}
                            className={cn("flex items-center gap-3 w-full p-4 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all text-left disabled:opacity-50", activeTab === 'exportar' ? 'bg-petrol text-white' : 'hover:bg-slate-50 text-slate-500')}
                        >
                            <Printer size={18} /> Exportar Diário
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-auto p-8 relative">
                        {loading && (
                            <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="animate-spin text-petrol h-10 w-10" />
                            </div>
                        )}

                        {activeTab === 'config' && (
                            <div className="max-w-3xl space-y-8">
                                <h3 className="font-black text-xl text-navy uppercase tracking-tight">1. Geração Dinâmica de Calendário</h3>
                                
                                <div className="space-y-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Professor Responsável</label>
                                        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                                            <SelectTrigger className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-petrol font-bold">
                                            <SelectValue placeholder="Escolha o docente..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                                            {teachers.map(t => (
                                                <SelectItem key={t.id} value={t.id} className="font-bold py-3">{t.name}</SelectItem>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Início</label>
                                            <Input type="date" className="h-12 border-2 rounded-2xl bg-slate-50 font-bold" value={firstClassDate ? format(firstClassDate, 'yyyy-MM-dd') : ''} onChange={(e) => setFirstClassDate(new Date(e.target.value + 'T12:00:00'))} />
                                        </div>
                                    </div>
                                    <Button onClick={generateDatesPreview} variant="outline" className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest">
                                        Gerar Pré-visualização das Datas
                                    </Button>
                                </div>

                                {datesConfig.length > 0 && (
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="font-black text-navy uppercase">Pré-visualização dos Encontros</h4>
                                                <p className="text-xs font-bold text-slate-400 uppercase">Selecione para remover feriados (recoloca no final)</p>
                                            </div>
                                            <Badge variant="outline" className="text-petrol font-black text-lg px-4 py-2 bg-petrol/5 border-none">{activeDatesCount} Aulas</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {datesConfig.map((d, i) => (
                                                <div 
                                                    key={i} 
                                                    onClick={() => toggleDateActive(i)}
                                                    className={cn("p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2", d.active ? "border-petrol bg-petrol/5 text-petrol" : "border-slate-200 bg-slate-50 opacity-50 grayscale")}
                                                >
                                                    <span className="font-black text-lg">{format(new Date(d.dateStr + 'T12:00:00'), 'dd/MM')}</span>
                                                    {d.active ? <CheckCircle2 size={20} /> : <X size={20} />}
                                                </div>
                                            ))}
                                        </div>

                                        <Button onClick={saveConfiguration} disabled={datesConfig.length === 0 || !selectedTeacher} className="w-full h-14 bg-navy hover:bg-navy-dark text-white rounded-2xl font-black uppercase tracking-widest shadow-xl mt-4">
                                            <Save className="mr-2" size={20} /> Confirmar Datas e Criar Diário no Banco
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'chamada' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                    <div>
                                        <h3 className="font-black text-xl text-navy uppercase tracking-tight">2. Lançamento de Frequência</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase mt-1">Opções: P (Presente), F (Falta), A (Abonada)</p>
                                    </div>
                                    <Button onClick={saveAttendance} className="h-12 bg-petrol text-white rounded-2xl font-black uppercase tracking-widest px-8 shadow-xl">
                                        <Save className="mr-2" size={18} /> Salvar Frequências
                                    </Button>
                                </div>

                                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[800px]">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="p-4 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest border-b border-r sticky left-0 z-10 bg-slate-50">Aluno</th>
                                                    {datesConfig.filter(d => d.active).map((d, i) => (
                                                        <th key={i} className="p-4 text-center font-black text-navy uppercase text-[10px] tracking-widest border-b min-w-[80px]">
                                                            {format(new Date(d.dateStr + 'T12:00:00'), 'dd/MM')}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map(student => (
                                                    <tr key={student.id} className="hover:bg-slate-50/50">
                                                        <td className="p-4 border-b border-slate-100 border-r font-bold text-sm text-navy uppercase sticky left-0 z-10 bg-white">
                                                            {student.name}
                                                        </td>
                                                        {datesConfig.filter(d => d.active).map((d, i) => {
                                                            const val = attendanceData[student.id]?.[d.dateStr];
                                                            const reason = justifications[student.id]?.[d.dateStr];
                                                            
                                                            const cycleStatus = () => {
                                                                let next = 'P';
                                                                if (!val) next = 'P';
                                                                else if (val === 'P') next = 'F';
                                                                else if (val === 'F') next = 'A';
                                                                else next = ''; // clear

                                                                setAttendance(student.id, d.dateStr, next);
                                                                if (next !== 'A') {
                                                                    setJustification(student.id, d.dateStr, '');
                                                                } else {
                                                                    const r = prompt("Motivo da Falta Abonada (Ex: Atestado Médico):");
                                                                    if (r) setJustification(student.id, d.dateStr, r);
                                                                    else setAttendance(student.id, d.dateStr, 'F'); // revert to F if cancelled
                                                                }
                                                            };

                                                            return (
                                                                <td key={i} className="p-2 border-b border-slate-100 text-center">
                                                                    <button 
                                                                        onClick={cycleStatus}
                                                                        title={reason ? `Abonada: ${reason}` : ''}
                                                                        className={cn(
                                                                            "w-10 h-10 rounded-xl font-black text-sm transition-all focus:ring-2",
                                                                            !val && "bg-slate-100 text-slate-300 hover:bg-slate-200",
                                                                            val === 'P' && "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 ring-emerald-500",
                                                                            val === 'F' && "bg-red-100 text-red-700 hover:bg-red-200 ring-red-500",
                                                                            val === 'A' && "bg-orange-100 text-orange-700 hover:bg-orange-200 ring-orange-500 underline decoration-dotted"
                                                                        )}
                                                                    >
                                                                        {val || '-'}
                                                                    </button>
                                                                </td>
                                                            )
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'exportar' && (
                            <div className="max-w-2xl mx-auto space-y-6 pt-10 text-center">
                                <div className="w-24 h-24 bg-petrol/10 text-petrol rounded-full flex items-center justify-center mx-auto">
                                    <Printer size={40} />
                                </div>
                                <div>
                                    <h3 className="font-black text-2xl text-navy uppercase tracking-tight">3. Relatórios Finais</h3>
                                    <p className="font-bold text-slate-400 mt-2">Gera o diário de classe completo em formato PDF, incluindo controle de faltas e justificativas de abonos, devidamente assinado.</p>
                                </div>
                                <Button 
                                    onClick={handlePrint}
                                    className="h-16 bg-navy hover:bg-navy-dark text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl px-12 transition-transform hover:scale-105"
                                >
                                    Gerar Arquivo PDF Oficial
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 space-y-4">
                    <AlertCircle size={48} className="opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-xs">Selecione uma disciplina para iniciar.</p>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
