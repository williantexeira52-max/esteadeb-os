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
import { CalendarIcon, Printer, Loader2, FileText } from 'lucide-react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';

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
  const [firstClassDate, setFirstClassDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, targetClass]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Subjects (filtered by course if targetClass exists)
      const subjectsRef = collection(db, 'grades');
      let subjectsQuery = query(subjectsRef, orderBy('name', 'asc'));
      
      if (targetClass?.courseName) {
        subjectsQuery = query(subjectsRef, where('course', '==', targetClass.courseName), orderBy('name', 'asc'));
      }
      
      const subjectsSnap = await getDocs(subjectsQuery);
      setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch Teachers (Employees with role containing 'Professor' or 'Docente')
      const employeesRef = collection(db, 'app_users');
      const employeesSnap = await getDocs(employeesRef);
      setTeachers(employeesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((emp: any) => emp.role?.toLowerCase().includes('prof') || emp.role?.toLowerCase().includes('doce') || emp.role === 'Direção')
      );

      // Fetch Students in this class
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

  const handlePrint = () => {
    if (!selectedSubject || !selectedTeacher || !firstClassDate) return;
    
    const dates = Array.from({ length: 8 }, (_, i) => addDays(firstClassDate, i * 7));
    const teacherName = teachers.find(t => t.id === selectedTeacher)?.name || selectedTeacher;
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name || selectedSubject;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Diário de Classe - ESTEADEB</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 0; }
            @page landscape-page { size: A4 landscape; margin: 0; }
            
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #001F3F; -webkit-print-color-adjust: exact; }
            .page { width: 210mm; height: 297mm; padding: 20mm; box-sizing: border-box; position: relative; page-break-after: always; overflow: hidden; }
            .landscape { width: 297mm; height: 210mm; padding: 15mm; page: landscape-page; page-break-after: always; }
            
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #001F3F; padding-bottom: 15px; margin-bottom: 30px; }
            .logo { font-weight: 900; font-size: 28px; text-transform: uppercase; letter-spacing: -1px; }
            .logo span { color: #008080; }
            
            .title-box { text-align: center; margin: 60px 0; }
            .title-box h1 { font-size: 48px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -2px; line-height: 1; }
            .title-box p { font-size: 14px; font-weight: 700; color: #008080; text-transform: uppercase; letter-spacing: 4px; margin-top: 10px; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 50px; }
            .info-item { border-bottom: 2px solid #f0f0f0; padding: 15px 0; }
            .info-label { font-size: 11px; font-weight: 900; color: #888; text-transform: uppercase; tracking: 1px; }
            .info-value { font-size: 18px; font-weight: 700; margin-top: 5px; color: #001F3F; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th, td { border: 1px solid #001F3F; padding: 8px; text-align: left; }
            th { background: #f8f9fa; font-weight: 900; text-transform: uppercase; font-size: 10px; }
            
            .pauta-table th { font-size: 9px; text-align: center; padding: 10px 5px; }
            .pauta-table td { height: 35px; vertical-align: middle; }
            .date-col { width: 45px; text-align: center; background: #fcfcfc; }
            .grade-col { width: 45px; text-align: center; font-weight: 900; }
            
            .cronograma-container { border: 2px solid #001F3F; border-radius: 10px; overflow: hidden; }
            .cronograma-row { display: grid; grid-template-columns: 120px 1fr; border-bottom: 1px solid #001F3F; }
            .cronograma-row:last-child { border-bottom: none; }
            .cronograma-date { padding: 20px; border-right: 1px solid #001F3F; font-weight: 900; background: #f8f9fa; text-align: center; }
            .cronograma-content { padding: 20px; background: white; }
            .line { border-bottom: 1px dotted #ccc; height: 25px; margin-bottom: 10px; }
            .line:last-child { margin-bottom: 0; }
            
            .footer { position: absolute; bottom: 20mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; align-items: flex-end; }
            .signature-box { text-align: center; width: 220px; }
            .signature-line { border-top: 2px solid #001F3F; margin-bottom: 8px; }
            .signature-label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #001F3F; }
            
            .page-number { font-size: 10px; font-weight: 900; color: #ccc; position: absolute; bottom: 10mm; right: 20mm; }

            @media print {
              .page { margin: 0; border: none; box-shadow: none; }
              .landscape { width: 100%; height: 100%; }
            }
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
                <div class="info-value">${format(dates[0], 'MMMM/yyyy', { locale: ptBR })} - ${format(dates[7], 'MMMM/yyyy', { locale: ptBR })}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Carga Horária Total</div>
                <div class="info-value">40 Horas (08 Encontros)</div>
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
                  <div class="signature-line"></div>
                  <div class="signature-label">Direção Acadêmica</div>
                </div>
              </div>
            </div>
            <div class="page-number">PÁGINA 01</div>
          </div>

          <!-- PAGE 2: PAUTA (LANDSCAPE) -->
          <div class="page landscape">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #001F3F; padding-bottom: 10px;">
              <div>
                <h2 style="margin: 0; font-weight: 900; text-transform: uppercase; font-size: 20px; letter-spacing: -1px;">Pauta de Frequência e Avaliações</h2>
                <div style="font-size: 10px; font-weight: 700; color: #008080; text-transform: uppercase; margin-top: 2px;">${subjectName} | ${targetClass?.name || ''}</div>
              </div>
              <div style="text-align: right; font-size: 10px; font-weight: 900; color: #888;">
                ESTEADEB ERP 2026
              </div>
            </div>
            
            <table class="pauta-table">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 30px;">Nº</th>
                  <th rowspan="2">Nome Completo do Aluno</th>
                  <th colspan="8">Controle de Frequência (8 Semanas)</th>
                  <th colspan="4">Resultados Finais</th>
                </tr>
                <tr>
                  ${dates.map(d => `<th class="date-col">${format(d, 'dd/MM')}</th>`).join('')}
                  <th class="grade-col">AV1</th>
                  <th class="grade-col">AV2</th>
                  <th class="grade-col">MÉDIA</th>
                  <th class="grade-col">FALTAS</th>
                </tr>
              </thead>
              <tbody>
                ${students.length > 0 ? students.map((s, idx) => `
                  <tr>
                    <td style="text-align: center; font-weight: 700; background: #f8f9fa;">${(idx + 1).toString().padStart(2, '0')}</td>
                    <td style="font-weight: 700; text-transform: uppercase; font-size: 10px;">${s.name}</td>
                    ${dates.map(() => `<td class="date-col"></td>`).join('')}
                    <td class="grade-col"></td>
                    <td class="grade-col"></td>
                    <td class="grade-col"></td>
                    <td class="grade-col"></td>
                  </tr>
                `).join('') : Array.from({ length: 25 }).map((_, idx) => `
                  <tr>
                    <td style="text-align: center; font-weight: 700; background: #f8f9fa;">${(idx + 1).toString().padStart(2, '0')}</td>
                    <td></td>
                    ${dates.map(() => `<td class="date-col"></td>`).join('')}
                    <td class="grade-col"></td>
                    <td class="grade-col"></td>
                    <td class="grade-col"></td>
                    <td class="grade-col"></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="page-number">PÁGINA 02</div>
          </div>

          <!-- PAGE 3: CRONOGRAMA -->
          <div class="page">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #001F3F; padding-bottom: 15px;">
              <h2 style="margin: 0; font-weight: 900; text-transform: uppercase; font-size: 22px; letter-spacing: -1px;">Cronograma de Aulas</h2>
              <div style="text-align: right">
                <div class="info-label">Docente</div>
                <div style="font-weight: 900; font-size: 12px;">${teacherName}</div>
              </div>
            </div>
            
            <div class="cronograma-container">
              ${dates.map((d, i) => `
                <div class="cronograma-row">
                  <div class="cronograma-date">
                    <div style="font-size: 10px; color: #008080; margin-bottom: 5px;">AULA ${i + 1}</div>
                    <div style="font-size: 16px;">${format(d, 'dd/MM')}</div>
                    <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; margin-top: 5px; color: #888;">${format(d, 'EEEE', { locale: ptBR })}</div>
                  </div>
                  <div class="cronograma-content">
                    <div style="font-size: 9px; font-weight: 900; color: #ccc; text-transform: uppercase; margin-bottom: 10px;">Conteúdo Ministrado:</div>
                    <div class="line"></div>
                    <div class="line"></div>
                    <div class="line"></div>
                  </div>
                </div>
              `).join('')}
            </div>
            
            <div style="margin-top: 40px; padding: 25px; border: 2px solid #f0f0f0; border-radius: 20px;">
              <div class="info-label" style="margin-bottom: 15px;">Observações e Ocorrências Acadêmicas</div>
              <div style="height: 120px;"></div>
            </div>
            
            <div class="footer">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Visto do Coordenador</div>
              </div>
              <div style="font-size: 10px; font-weight: 900; color: #001F3F;">ESTEADEB 2026 - SISTEMA DE GESTÃO</div>
            </div>
            <div class="page-number">PÁGINA 03</div>
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="bg-navy p-8 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-petrol rounded-2xl">
              <FileText size={24} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Diário Físico</DialogTitle>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">Configuração de Impressão</p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione a Disciplina</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-petrol font-bold">
                  <SelectValue placeholder="Escolha a disciplina..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id} className="font-bold py-3">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Professor</label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-petrol font-bold">
                  <SelectValue placeholder="Escolha o docente..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id} className="font-bold py-3">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data da Primeira Aula</label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-start text-left font-bold bg-slate-50 border-2 border-slate-100 rounded-2xl hover:bg-slate-100",
                        !firstClassDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-5 w-5 text-petrol" />
                      {firstClassDate ? format(firstClassDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0 rounded-2xl border-slate-100 shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={firstClassDate}
                    onSelect={setFirstClassDate}
                    initialFocus
                    locale={ptBR}
                    className="rounded-2xl"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-4 text-petrol gap-2 font-bold text-xs uppercase animate-pulse">
              <Loader2 className="animate-spin" size={16} /> Carregando dados...
            </div>
          )}
        </div>

        <DialogFooter className="p-8 bg-slate-50 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 h-14 rounded-2xl font-bold uppercase tracking-widest">
            Cancelar
          </Button>
          <Button 
            onClick={handlePrint}
            disabled={!selectedSubject || !selectedTeacher || !firstClassDate}
            className="flex-1 h-14 bg-navy hover:bg-navy-dark text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-navy/20 gap-2"
          >
            <Printer size={20} /> Gerar Diário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
