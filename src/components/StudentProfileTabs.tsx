import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  writeBatch,
  getDocs,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  User, 
  Phone, 
  CreditCard, 
  FileUp, 
  History, 
  Save, 
  Loader2, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  X,
  Plus,
  PlusCircle,
  FileText,
  Award,
  Printer,
  ChevronRight
} from 'lucide-react';
import { differenceInMinutes } from 'date-fns';
import { ContractAutomation } from './ContractAutomation';

interface StudentProfileTabsProps {
  student: any;
  onUpdate?: () => void;
}

export const StudentProfileTabs: React.FC<StudentProfileTabsProps> = ({ student, onUpdate }) => {
  const { profile, nucleo, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('core');
  const [isSaving, setIsSaving] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [docType, setDocType] = useState<'CONTRATO' | 'FICHA' | 'REQUERIMENTO' | 'CERTIFICADO' | 'HISTORICO'>('CONTRATO');
  const [formData, setFormData] = useState({ ...student });
  const [parcels, setParcels] = useState<any[]>([]);
  const [polos, setPolos] = useState<any[]>([]);
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [academicRecords, setAcademicRecords] = useState<any[]>([]);
  const [isDispensaModalOpen, setIsDispensaModalOpen] = useState(false);
  const [allModules, setAllModules] = useState<any[]>([]);
  const [dispensaData, setDispensaData] = useState({
    moduleId: '',
    moduleName: '',
    externalGrade: '',
    institution: ''
  });
  const [newOccurrence, setNewOccurrence] = useState({ 
    type: 'PEDAGÓGICO', 
    title: '', 
    description: '', 
    isVisibleToStudent: true 
  });
  const [amendmentText, setAmendmentText] = useState<{ [key: string]: string }>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, parcelNumber: number } | null>(null);

  // Tab 2: CEP Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.cep?.length === 8) {
        fetch(`https://viacep.com.br/ws/${formData.cep}/json/`)
          .then(res => res.json())
          .then(data => {
            if (!data.erro) {
              setFormData(prev => ({
                ...prev,
                address: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                state: data.uf
              }));
            }
          });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [formData.cep]);

  // Tab 3: Financial Fetch
  useEffect(() => {
    if (!student.id) return;
    const q = query(collection(db, 'financial_installments'), where('studentId', '==', student.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setParcels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [student.id]);

  // Fetch Polos for editing
  useEffect(() => {
    const q = query(collection(db, 'school_units'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPolos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Tab 5: Occurrences Fetch
  useEffect(() => {
    if (!student.id) return;
    const q = query(
      collection(db, 'occurrences'), 
      where('studentId', '==', student.id),
      where('nucleoId', '==', nucleo)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOccurrences(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [student.id, nucleo]);

  // Tab 6: Academic Records Fetch
  useEffect(() => {
    if (!student.id) return;
    const q = query(collection(db, 'academic_records'), where('studentId', '==', student.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAcademicRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [student.id]);

  // Fetch modules for dispensa (dynamically resolve course from class)
  useEffect(() => {
    const fetchModules = async () => {
      let resolvedCourse = student.course || student.courseName;

      // Determine course from the student's class if we have classId
      if (!resolvedCourse && (student.classId || student.className || student.turma)) {
        try {
          const classesSnapshot = await getDocs(collection(db, 'classes'));
          const classesList = classesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          
          const studentClass = classesList.find(c => 
            c.id === student.classId || 
            c.name === student.className || 
            c.name === student.turma
          );
          
          if (studentClass && studentClass.courseName) {
            resolvedCourse = studentClass.courseName;
          }
        } catch (e) {
          console.error("Error cross-referencing class course", e);
        }
      }

      let q;
      if (resolvedCourse) {
        q = query(collection(db, 'grades'), where('course', '==', resolvedCourse));
      } else {
        q = query(collection(db, 'grades'), orderBy('name', 'asc')); // Fallback to all
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAllModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      
      return unsubscribe;
    };

    const unsubPromise = fetchModules();
    return () => {
      unsubPromise.then(unsub => unsub ? unsub() : null);
    };
  }, [student]);

  const handleSaveCore = async () => {
    setIsSaving(true);
    try {
      const studentRef = doc(db, 'students', student.id);
      await updateDoc(studentRef, {
        name: formData.name || '',
        cpf: formData.cpf || '',
        matricula: formData.matricula || '',
        birthDate: formData.birthDate || '',
        rg: formData.rg || '',
        rgIssuer: formData.rgIssuer || '',
        rgState: formData.rgState || '',
        birthCity: formData.birthCity || '',
        birthState: formData.birthState || '',
        fatherName: formData.fatherName || '',
        motherName: formData.motherName || '',
        maritalStatus: formData.maritalStatus || '',
        gender: formData.gender || '',
        poloId: formData.poloId || null,
        poloName: formData.poloName || 'MATRIZ',
        matriculationDate: formData.matriculationDate || '',
        profissao: formData.profissao || '',
        phone2: formData.phone2 || '',
        igrejaMembro: formData.igrejaMembro || '',
        congregacao: formData.congregacao || '',
        dataConversao: formData.dataConversao || '',
        dataBatismo: formData.dataBatismo || '',
        funcaoIgreja: formData.funcaoIgreja || '',
        nomeDesconto: formData.nomeDesconto || '',
        percentualDesconto: formData.percentualDesconto || 0,
        valorIntegral: formData.valorIntegral || 0,
        valorComDesconto: formData.valorComDesconto || 0,
        dueDayPattern: formData.dueDayPattern || '10',
        email: formData.email || '',
        phone: formData.phone || '',
        cep: formData.cep || '',
        address: formData.address || '',
        number: formData.number || '',
        complement: formData.complement || '',
        neighborhood: formData.neighborhood || '',
        city: formData.city || '',
        state: formData.state || ''
      });
      onUpdate?.();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLancarDispensa = async () => {
    if (!dispensaData.moduleId) return;
    try {
      const selectedModule = allModules.find(m => m.id === dispensaData.moduleId);
      await addDoc(collection(db, 'academic_records'), {
        studentId: student.id,
        nucleoId: student.nucleoId || '', // Essential for Firestore rules
        studentName: student.name || '',
        moduleId: dispensaData.moduleId,
        moduleName: selectedModule?.name || '',
        disciplina: selectedModule?.name || '',
        nota: parseFloat(dispensaData.externalGrade) || 0,
        grade: dispensaData.externalGrade || '0',
        status: 'Dispensado', // Maps to Exempt
        institution: dispensaData.institution || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsDispensaModalOpen(false);
      setDispensaData({ moduleId: '', moduleName: '', externalGrade: '', institution: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'academic_records');
    }
  };

  const [newInstallmentConfig, setNewInstallmentConfig] = useState({
    quantity: 12,
    dueDayPattern: student.dueDayPattern || '10',
    baseValue: student.valorIntegral || 206,
    discountValue: (student.valorIntegral || 206) - (student.valorComDesconto || 206)
  });
  const [isGeneratingInstallments, setIsGeneratingInstallments] = useState(false);

  const getFifthBusinessDay = (year: number, month: number) => {
    const calendar2026: {[key: number]: number} = {
      0: 9, 1: 10, 2: 6, 3: 9, 4: 8, 5: 8, 6: 7, 7: 7, 8: 8, 9: 7, 10: 9, 11: 7
    };
    if (year === 2026 && calendar2026[month] !== undefined) return calendar2026[month];
    let count = 0, day = 1;
    while (count < 5) {
      const d = new Date(year, month, day);
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      if (count < 5) day++;
    }
    return day;
  };

  const handleGenerateInstallments = async () => {
    if (!window.confirm(`Deseja gerar ${newInstallmentConfig.quantity} novas parcelas para este aluno?`)) return;
    setIsGeneratingInstallments(true);
    try {
      const batch = writeBatch(db);
      const startDate = new Date();
      
      for (let i = 1; i <= newInstallmentConfig.quantity; i++) {
        let installmentMonth = startDate.getMonth() + i;
        let installmentYear = startDate.getFullYear();
        while (installmentMonth > 11) {
          installmentMonth -= 12;
          installmentYear += 1;
        }

        let dueDay = 10;
        if (newInstallmentConfig.dueDayPattern === '5_UTIL') {
          dueDay = getFifthBusinessDay(installmentYear, installmentMonth);
        } else if (newInstallmentConfig.dueDayPattern === '20') {
          dueDay = 20;
        } else {
          dueDay = Number(newInstallmentConfig.dueDayPattern) || 10;
        }

        const dueDate = new Date(installmentYear, installmentMonth, dueDay);
        const parcelRef = doc(collection(db, 'financial_installments'));
        
        batch.set(parcelRef, {
          studentId: student.id,
          studentName: student.name,
          studentPhone: student.phone || '',
          studentEmail: student.email || '',
          matricula: student.matricula || '',
          nucleoId: student.nucleoId || nucleo,
          parcelNumber: parcels.length + i,
          totalParcels: parcels.length + newInstallmentConfig.quantity,
          baseValue: Number(newInstallmentConfig.baseValue),
          discount: Number(newInstallmentConfig.discountValue),
          finalPaidValue: Number(newInstallmentConfig.baseValue) - Number(newInstallmentConfig.discountValue),
          nomeDesconto: student.nomeDesconto || 'DESCONTO PADRÃO',
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'Pendente',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'financial_installments');
    } finally {
      setIsGeneratingInstallments(false);
    }
  };

  const calculateInterest = (parcel: any) => {
    const today = new Date();
    const dueDate = new Date(parcel.dueDate);
    const baseValue = Number(parcel.baseValue) || 0;
    const discount = Number(parcel.discount) || 0;
    const netValue = baseValue - discount;

    if (today <= dueDate || parcel.status === 'Pago') {
      return { interest: 0, fine: 0, total: parcel.finalPaidValue || netValue };
    }
    
    const diffTime = Math.abs(today.getTime() - dueDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const fine = netValue * 0.02; // 2% multa
    const interest = (netValue * 0.01 / 30) * diffDays; // 1% ao mês pro-rata
    const total = netValue + fine + interest;
    
    return { interest, fine, total };
  };

  const handleAddOccurrence = async () => {
    if (!newOccurrence.title) return;
    try {
      const batch = writeBatch(db);
      const occRef = doc(collection(db, 'occurrences'));
      const occData = {
        ...newOccurrence,
        studentId: student.id,
        nucleoId: nucleo,
        authorId: profile.uid,
        authorName: profile.name,
        createdAt: serverTimestamp(),
        amendments: []
      };
      
      batch.set(occRef, occData);
      
      const logRef = doc(collection(db, 'auditLogs'));
      batch.set(logRef, {
        action: 'OCORRÊNCIA_REGISTRADA',
        details: `Nova ocorrência "${newOccurrence.title}" para o aluno ${student.name}`,
        userId: profile.uid,
        timestamp: serverTimestamp(),
        nucleoId: nucleo
      });

      await batch.commit();
      setNewOccurrence({ type: 'PEDAGÓGICO', title: '', description: '', isVisibleToStudent: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'occurrences');
    }
  };

  const handleDeleteParcel = (id: string, parcelNumber: number) => {
    setDeleteConfirm({ id, parcelNumber });
  };

  const executeDeleteParcel = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'financial_installments', deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `financial_installments/${deleteConfirm.id}`);
    }
  };
  const handleAddAmendment = async (occId: string) => {
    const text = amendmentText[occId];
    if (!text) return;

    try {
      const batch = writeBatch(db);
      const occRef = doc(db, 'occurrences', occId);
      const occurrence = occurrences.find(o => o.id === occId);
      
      const newAmendment = {
        text,
        authorName: profile.name,
        createdAt: new Date().toISOString()
      };

      batch.update(occRef, {
        amendments: [...(occurrence.amendments || []), newAmendment]
      });

      const logRef = doc(collection(db, 'auditLogs'));
      batch.set(logRef, {
        action: 'ADENDO_ADICIONADO',
        details: `Adendo adicionado à ocorrência ${occId}`,
        userId: profile.uid,
        timestamp: serverTimestamp(),
        nucleoId: nucleo
      });

      await batch.commit();
      setAmendmentText(prev => ({ ...prev, [occId]: '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'occurrences');
    }
  };

  const handleOpenDoc = async (type: 'CONTRATO' | 'FICHA' | 'REQUERIMENTO' | 'CERTIFICADO' | 'HISTORICO') => {
    if (type === 'CERTIFICADO') {
      try {
        const qGrades = query(collection(db, 'grades'), where('course', '==', student.course || 'TEOLOGIA'));
        const snapGrades = await getDocs(qGrades);
        const totalRequired = snapGrades.size > 0 ? snapGrades.size : 20;

        const qRecords = query(collection(db, 'academic_records'), where('studentId', '==', student.id));
        const snapRecords = await getDocs(qRecords);
        const completedCount = snapRecords.docs.filter(d => {
          const data = d.data();
          return data.status === 'Aprovado' || 
                 data.status === 'Dispensado' || 
                 data.status === 'Dispensada' ||
                 (Number(data.nota || data.grade) >= 7);
        }).length;

        if (completedCount < totalRequired && student.status !== 'Concluído' && !isAdmin) {
          alert(`ALERTA DE INTEGRIDADE: O aluno possui apenas ${completedCount}/${totalRequired} disciplinas concluídas. Como sua função não é Admin/Direção, o certificado só pode ser emitido após a conclusão integral ou alteração do status do aluno.`);
          return;
        }
        
        if (completedCount < totalRequired && isAdmin) {
          const confirmBypass = window.confirm(`AVISO: O aluno completou ${completedCount}/${totalRequired} disciplinas. Deseja emitir o certificado mesmo assim?`);
          if (!confirmBypass) return;
        }
      } catch (err) {
        console.error("Integrity check failed:", err);
      }
    }
    
    setDocType(type);
    setIsContractOpen(true);
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-navy uppercase tracking-tighter">Perfil do Aluno</h2>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button 
            onClick={() => handleOpenDoc('FICHA')}
            variant="outline"
            className="border-navy text-navy hover:bg-navy hover:text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest h-10 px-4"
          >
            <FileText size={16} />
            Ficha
          </Button>
          <Button 
            onClick={() => handleOpenDoc('REQUERIMENTO')}
            variant="outline"
            className="border-petrol text-petrol hover:bg-petrol hover:text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest h-10 px-4"
          >
            <FileText size={16} />
            Desconto
          </Button>
          <Button 
            onClick={() => handleOpenDoc('CONTRATO')}
            className="bg-navy hover:bg-navy-dark text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest h-10 px-6 shadow-lg shadow-navy/20"
          >
            <FileText size={16} />
            Gerar Contrato
          </Button>
          <Button 
            onClick={() => handleOpenDoc('HISTORICO')}
            className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest h-10 px-6 shadow-lg shadow-slate-900/20"
          >
            <BookOpen size={16} />
            Histórico Oficial
          </Button>
          <Button 
            onClick={() => window.print()}
            variant="outline"
            className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest h-10 px-6"
          >
            <Printer size={16} />
            Imprimir Dossiê
          </Button>
          <Button 
            onClick={() => handleOpenDoc('CERTIFICADO')}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest h-10 px-6 shadow-lg shadow-amber-600/20"
          >
            <Award size={16} />
            Emitir Certificado
          </Button>
        </div>
      </div>

      {/* Print Only Section for Dossier */}
      <div id="student-dossier-print" className="hidden print:block p-10 bg-white text-black font-sans">
        <div className="border-b-4 border-navy pb-6 mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black uppercase text-navy tracking-tight">Dossiê do Aluno</h1>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">ESTEADEB - Inteligência Educacional</p>
          </div>
          <div className="text-right">
             <p className="text-xs font-black text-navy uppercase">{nucleo}</p>
             <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Gerado: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-10">
          {/* Header Info */}
          <div className="col-span-12 grid grid-cols-3 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
             <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Matrícula</p>
                <p className="text-xl font-bold text-navy">{student.matricula || 'N/A'}</p>
             </div>
             <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <p className="text-xl font-bold text-navy uppercase">{student.status || 'Ativo'}</p>
             </div>
             <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data Matrícula</p>
                <p className="text-xl font-bold text-navy">
                   {student.matriculationDate ? new Date(student.matriculationDate + 'T12:00:00').toLocaleDateString('pt-BR') : (student.createdAt?.toDate()?.toLocaleDateString('pt-BR') || '---')}
                 </p>
             </div>
          </div>

          {/* Section 1: Personal */}
          <div className="col-span-12 space-y-4">
             <h3 className="text-lg font-black text-navy uppercase border-b border-gray-200 pb-2 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-petrol rounded-full" /> Dados Pessoais
             </h3>
             <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2">
                   <p className="text-[9px] font-black text-gray-400 uppercase">Nome Completo</p>
                   <p className="text-sm font-bold">{formData.name}</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">CPF</p>
                   <p className="text-sm font-bold">{formData.cpf}</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Data Nascimento</p>
                   <p className="text-sm font-bold">{formData.birthDate || 'N/A'}</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">RG / Orgão / UF</p>
                   <p className="text-sm font-bold">{formData.rg} {formData.rgIssuer} {formData.rgState}</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Naturalidade</p>
                   <p className="text-sm font-bold">{formData.birthCity} / {formData.birthState}</p>
                </div>
                <div className="col-span-3 grid grid-cols-2 gap-6">
                   <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase">Pai</p>
                      <p className="text-sm font-bold">{formData.fatherName || 'N/A'}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase">Mãe</p>
                      <p className="text-sm font-bold">{formData.motherName || 'N/A'}</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Section 2: Contact */}
          <div className="col-span-12 space-y-4 pt-4">
             <h3 className="text-lg font-black text-navy uppercase border-b border-gray-200 pb-2 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-petrol rounded-full" /> Contato e Endereço
             </h3>
             <div className="grid grid-cols-3 gap-6">
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Telefone/WhatsApp</p>
                   <p className="text-sm font-bold">{formData.phone} / {formData.phone2}</p>
                </div>
                <div className="col-span-2">
                   <p className="text-[9px] font-black text-gray-400 uppercase">E-mail</p>
                   <p className="text-sm font-bold lowercase">{formData.email}</p>
                </div>
                <div className="col-span-3">
                   <p className="text-[9px] font-black text-gray-400 uppercase">Endereço Completo</p>
                   <p className="text-sm font-bold">
                      {formData.address}, {formData.number} {formData.complement && `- ${formData.complement}`} - {formData.neighborhood}, {formData.city}/{formData.state} - CEP: {formData.cep}
                   </p>
                </div>
             </div>
          </div>

          {/* Section 3: Eclesiastic */}
          <div className="col-span-12 space-y-4 pt-4">
             <h3 className="text-lg font-black text-navy uppercase border-b border-gray-200 pb-2 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-petrol rounded-full" /> Dados Eclesiásticos
             </h3>
             <div className="grid grid-cols-2 gap-6">
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Igreja Membro</p>
                   <p className="text-sm font-bold">{formData.igrejaMembro} - {formData.congregacao}</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Função</p>
                   <p className="text-sm font-bold">{formData.funcaoIgreja || 'Membro'}</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Conversão / Batismo</p>
                   <p className="text-sm font-bold">{formData.dataConversao || 'N/A'} / {formData.dataBatismo || 'N/A'}</p>
                </div>
             </div>
          </div>

          {/* Section 4: Academic */}
          <div className="col-span-12 space-y-4 pt-4">
             <h3 className="text-lg font-black text-navy uppercase border-b border-gray-200 pb-2 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-petrol rounded-full" /> Histórico Acadêmico
             </h3>
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-gray-100">
                    <th className="p-3 border border-gray-200 text-[9px] font-black uppercase text-gray-500">Disciplina</th>
                    <th className="p-3 border border-gray-200 text-[9px] font-black uppercase text-gray-500 text-center">Nota</th>
                    <th className="p-3 border border-gray-200 text-[9px] font-black uppercase text-gray-500 text-center">Situação</th>
                 </tr>
               </thead>
               <tbody>
                  {academicRecords.map((r, idx) => (
                    <tr key={idx}>
                       <td className="p-3 border border-gray-200 text-xs font-bold text-navy uppercase">{r.moduleName}</td>
                       <td className="p-3 border border-gray-200 text-xs font-bold text-center">{r.grade}</td>
                       <td className="p-3 border border-gray-200 text-xs font-black uppercase text-center">{r.status}</td>
                    </tr>
                  ))}
                  {academicRecords.length === 0 && (
                    <tr>
                       <td colSpan={3} className="p-10 text-center text-xs font-bold text-gray-300 uppercase tracking-widest">Nenhum registro acadêmico consolidado</td>
                    </tr>
                  )}
               </tbody>
             </table>
          </div>

          {/* Section 5: Financial Summary */}
          <div className="col-span-12 space-y-4 pt-4">
             <h3 className="text-lg font-black text-navy uppercase border-b border-gray-200 pb-2 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-petrol rounded-full" /> Resumo Financeiro
             </h3>
             <div className="grid grid-cols-3 gap-6 bg-navy/[0.02] p-6 rounded-2xl border border-navy/10">
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Val. Integral</p>
                   <p className="text-sm font-bold">R$ {student.valorIntegral || 0}</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Desconto Entregue</p>
                   <p className="text-sm font-bold text-emerald-600">{student.nomeDesconto || 'Individual'} ({student.percentualDesconto || 0}%)</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase">Val. Final Mensal</p>
                   <p className="text-sm font-black text-navy">R$ {student.valorComDesconto || 0}</p>
                </div>
             </div>
          </div>
        </div>

        <div className="mt-20 flex justify-between items-center px-10">
           <div className="text-center w-64 border-t-2 border-gray-300 pt-2">
              <p className="text-xs font-black uppercase">Secretaria Acadêmica</p>
           </div>
           <div className="text-center w-64 border-t-2 border-gray-300 pt-2">
              <p className="text-xs font-black uppercase">Assinatura do Aluno</p>
           </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Confirmar Exclusão</h3>
                <p className="text-slate-500 text-sm mt-2">
                  Deseja realmente excluir a <span className="font-bold text-slate-900">Parcela {deleteConfirm.parcelNumber}</span>?
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
                  onClick={executeDeleteParcel}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  Apagar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TabsList className="grid grid-cols-7 w-full bg-navy/5 p-1 rounded-xl">
        <TabsTrigger value="core" className="data-[state=active]:bg-white data-[state=active]:text-navy">Dados</TabsTrigger>
        <TabsTrigger value="contact" className="data-[state=active]:bg-white data-[state=active]:text-navy">Contato</TabsTrigger>
        <TabsTrigger value="academic" className="data-[state=active]:bg-white data-[state=active]:text-navy">Histórico</TabsTrigger>
        <TabsTrigger value="church" className="data-[state=active]:bg-white data-[state=active]:text-navy">Eclesiástico</TabsTrigger>
        <TabsTrigger value="finance" className="data-[state=active]:bg-white data-[state=active]:text-navy">Financeiro</TabsTrigger>
        <TabsTrigger value="ged" className="data-[state=active]:bg-white data-[state=active]:text-navy">Documentos</TabsTrigger>
        <TabsTrigger value="audit" className="data-[state=active]:bg-white data-[state=active]:text-navy">Ocorrências</TabsTrigger>
      </TabsList>

      <div className="mt-6">
        <TabsContent value="core" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-navy text-lg flex items-center gap-2">
                <User className="text-petrol" size={20} /> Dados Cadastrais
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Data de Matrícula</Label>
                <Input 
                  type="date"
                  value={formData.matriculationDate || (student.createdAt?.toDate()?.toISOString().split('T')[0] || '')} 
                  onChange={e => setFormData({...formData, matriculationDate: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-2">
                  <Label>RG</Label>
                  <Input value={formData.rg} onChange={e => setFormData({...formData, rg: e.target.value})} />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label>Órgão Emissor</Label>
                  <Input value={formData.rgIssuer} onChange={e => setFormData({...formData, rgIssuer: e.target.value})} />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label>UF RG</Label>
                  <Input value={formData.rgState} onChange={e => setFormData({...formData, rgState: e.target.value})} maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Naturalidade (Cidade)</Label>
                  <Input value={formData.birthCity} onChange={e => setFormData({...formData, birthCity: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>UF Nascimento</Label>
                  <Input value={formData.birthState} onChange={e => setFormData({...formData, birthState: e.target.value})} maxLength={2} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estado Civil</Label>
                <Select value={formData.maritalStatus} onValueChange={v => setFormData({...formData, maritalStatus: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOLTEIRO">Solteiro(a)</SelectItem>
                    <SelectItem value="CASADO">Casado(a)</SelectItem>
                    <SelectItem value="DIVORCIADO">Divorciado(a)</SelectItem>
                    <SelectItem value="VIUVO">Viúvo(a)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="O">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Polo</Label>
                <Select 
                  value={formData.poloId || 'none'} 
                  onValueChange={v => {
                    const polo = polos.find(p => p.id === v);
                    setFormData({
                      ...formData, 
                      poloId: v === 'none' ? null : v, 
                      poloName: polo ? polo.name : 'MATRIZ'
                    });
                  }}
                  disabled={!isAdmin && profile?.poloId}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">MATRIZ</SelectItem>
                    {polos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome do Pai</Label>
                <Input value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Nome da Mãe</Label>
                <Input value={formData.motherName} onChange={e => setFormData({...formData, motherName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Profissão</Label>
                <Input value={formData.profissao} onChange={e => setFormData({...formData, profissao: e.target.value})} />
              </div>

              <div className="col-span-2 mt-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-black text-navy uppercase tracking-tight mb-4 flex items-center gap-2">
                  <CreditCard size={18} className="text-petrol" /> Configuração Financeira (Bolsa/Desconto)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Desconto</Label>
                    <Input 
                      placeholder="Ex: Desconto Padrão"
                      value={formData.nomeDesconto} 
                      onChange={e => setFormData({...formData, nomeDesconto: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Percentual (%)</Label>
                    <Input 
                      type="number"
                      value={formData.percentualDesconto} 
                      onChange={e => {
                        const pct = parseFloat(e.target.value) || 0;
                        const integral = Number(formData.valorIntegral) || 0;
                        const discounted = integral * (1 - pct / 100);
                        setFormData({
                          ...formData, 
                          percentualDesconto: pct,
                          valorComDesconto: Number(discounted.toFixed(2))
                        });
                      }} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Integral (R$)</Label>
                    <Input 
                      type="number"
                      value={formData.valorIntegral} 
                      onChange={e => {
                        const integral = parseFloat(e.target.value) || 0;
                        const pct = Number(formData.percentualDesconto) || 0;
                        const discounted = integral * (1 - pct / 100);
                        setFormData({
                          ...formData, 
                          valorIntegral: integral,
                          valorComDesconto: Number(discounted.toFixed(2))
                        });
                      }} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor com Desconto (R$)</Label>
                    <Input 
                      type="number"
                      value={formData.valorComDesconto} 
                      onChange={e => {
                        const discounted = parseFloat(e.target.value) || 0;
                        const integral = Number(formData.valorIntegral) || 0;
                        let pct = 0;
                        if (integral > 0) {
                          pct = ((integral - discounted) / integral) * 100;
                        }
                        setFormData({
                          ...formData, 
                          valorComDesconto: discounted,
                          percentualDesconto: Number(pct.toFixed(2))
                        });
                      }} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vencimento Padrão</Label>
                    <Select 
                      value={formData.dueDayPattern || '10'} 
                      onValueChange={v => setFormData({...formData, dueDayPattern: v})}
                    >
                      <SelectTrigger className="bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5_UTIL">5º Dia Útil (Conforme Tabela)</SelectItem>
                        <SelectItem value="10">Todo dia 10</SelectItem>
                        <SelectItem value="20">Todo dia 20</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button className="col-span-2 bg-navy mt-4" onClick={handleSaveCore} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-navy text-lg flex items-center gap-2">
                <BookOpen className="text-petrol" size={20} /> Histórico Escolar
              </CardTitle>
              <Button size="sm" className="bg-petrol" onClick={() => setIsDispensaModalOpen(true)}>
                Lançar Dispensa
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Disciplina</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nota</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {academicRecords.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 text-xs font-bold uppercase">Nenhum registro acadêmico encontrado.</td>
                      </tr>
                    ) : (
                      academicRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="p-4">
                            <p className="font-bold text-navy text-sm">{record.disciplina || record.moduleName}</p>
                            {record.institution && <p className="text-[10px] text-slate-400">{record.institution}</p>}
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="font-mono">{(record.nota ?? record.grade)?.toString()}</Badge>
                          </td>
                          <td className="p-4">
                            <Badge className={cn(
                              "text-[10px] font-black uppercase",
                              record.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-700' : 
                              record.status === 'Dispensado' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                            )}>
                              {record.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Dispensa Modal */}
          {isDispensaModalOpen && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-petrol p-6 text-white flex justify-between items-center">
                  <h3 className="font-black uppercase tracking-tight">Lançar Dispensa de Disciplina</h3>
                  <button onClick={() => setIsDispensaModalOpen(false)}><X size={24} /></button>
                </div>
                <div className="p-8 space-y-4">
                  <div className="space-y-2">
                    <Label>Disciplina / Módulo</Label>
                    <Select value={dispensaData.moduleId} onValueChange={v => setDispensaData({...dispensaData, moduleId: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione a disciplina" /></SelectTrigger>
                      <SelectContent>
                        {allModules.filter(m => !academicRecords.some(ar => ar.moduleId === m.id)).map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nota Externa (Opcional)</Label>
                    <Input value={dispensaData.externalGrade} onChange={e => setDispensaData({...dispensaData, externalGrade: e.target.value})} placeholder="Ex: 8.5" />
                  </div>
                  <div className="space-y-2">
                    <Label>Instituição de Origem</Label>
                    <Input value={dispensaData.institution} onChange={e => setDispensaData({...dispensaData, institution: e.target.value})} placeholder="Ex: Faculdade X" />
                  </div>
                  <Button className="w-full bg-petrol mt-4 h-12 rounded-xl font-black uppercase tracking-widest" onClick={handleLancarDispensa}>
                    Salvar Dispensa
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="church" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy text-lg flex items-center gap-2">
                <BookOpen className="text-petrol" size={20} /> Dados Eclesiásticos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Igreja da qual é Membro</Label>
                <Input value={formData.igrejaMembro} onChange={e => setFormData({...formData, igrejaMembro: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Congregação</Label>
                <Input value={formData.congregacao} onChange={e => setFormData({...formData, congregacao: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Data de Conversão</Label>
                <Input type="date" value={formData.dataConversao} onChange={e => setFormData({...formData, dataConversao: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Data do Batismo em Águas</Label>
                <Input type="date" value={formData.dataBatismo} onChange={e => setFormData({...formData, dataBatismo: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Função que exerce na Igreja</Label>
                <Input value={formData.funcaoIgreja} onChange={e => setFormData({...formData, funcaoIgreja: e.target.value})} />
              </div>
              <Button className="col-span-2 bg-navy mt-4" onClick={handleSaveCore} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                Salvar Dados Eclesiásticos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy text-lg flex items-center gap-2">
                <Phone className="text-petrol" size={20} /> Contato e Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Celular 2 / WhatsApp</Label>
                <Input value={formData.phone2} onChange={e => setFormData({...formData, phone2: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>CEP (Auto-preenchimento)</Label>
                <Input value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} maxLength={8} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-2">
                  <Label>Logradouro</Label>
                  <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={formData.complement} onChange={e => setFormData({...formData, complement: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} maxLength={2} />
                </div>
              </div>
              <Button className="col-span-2 bg-navy mt-4" onClick={handleSaveCore} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                Atualizar Endereço
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-navy text-lg flex items-center gap-2">
                <CreditCard className="text-petrol" size={20} /> Extrato Financeiro
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 whitespace-nowrap">Alterar Padrão:</Label>
                  <Select 
                    value={formData.dueDayPattern || '10'} 
                    onValueChange={async (v) => {
                      setFormData({...formData, dueDayPattern: v});
                      // Auto-save this specific field if possible or just update state
                    }}
                  >
                    <SelectTrigger className="h-8 text-[10px] font-black uppercase border-slate-200 w-[140px] bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5_UTIL">5º Dia Útil</SelectItem>
                      <SelectItem value="10">Dia 10</SelectItem>
                      <SelectItem value="20">Dia 20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="outline" className="text-[10px] font-black uppercase border-slate-200 text-slate-400">
                  Status: {formData.dueDayPattern === '5_UTIL' ? 'Variável' : 'Fixo'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Pago</p>
                  <p className="text-xl font-black text-navy">
                    R$ {parcels.filter(p => p.status === 'Pago').reduce((acc, p) => acc + (p.finalPaidValue || 0), 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Em Aberto</p>
                  <p className="text-xl font-black text-navy">
                    R$ {parcels.filter(p => p.status !== 'Pago').reduce((acc, p) => acc + calculateInterest(p).total, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Plano</p>
                  <p className="text-xl font-black text-navy italic opacity-60">
                    R$ {parcels.reduce((acc, p) => {
                      const { total } = calculateInterest(p);
                      return acc + (p.status === 'Pago' ? (p.finalPaidValue || total) : total);
                    }, 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {parcels.sort((a,b) => a.parcelNumber - b.parcelNumber).map((p) => {
                    const { interest, fine, total } = calculateInterest(p);
                    return (
                      <div key={p.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-navy shadow-sm">
                            {p.parcelNumber}
                          </div>
                          <div>
                            <p className="font-bold text-navy">Parcela {p.parcelNumber}/{p.totalParcels}</p>
                            <p className="text-xs text-gray-500">Vencimento: {new Date(p.dueDate).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-6">
                          <div>
                            <p className="text-sm font-bold text-navy">R$ {total.toFixed(2)}</p>
                            {interest > 0 && (
                              <p className="text-[10px] text-red-500 font-bold uppercase">
                                + R$ {(interest + fine).toFixed(2)} (Juros/Multa)
                              </p>
                            )}
                          </div>
                          <Badge className={cn(
                            "font-bold uppercase text-[10px]",
                            p.status === 'Pago' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                          )}>
                            {p.status}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteParcel(p.id, p.parcelNumber)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ged" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy text-lg flex items-center gap-2">
                <FileUp className="text-petrol" size={20} /> Dossiê Digital (GED)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {['RG/CPF (Frente)', 'RG/CPF (Verso)', 'Comprovante Residência', 'Histórico Escolar'].map((doc) => (
                  <div key={doc} className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-petrol transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 bg-gray-50/50">
                    <FileUp size={24} className="text-gray-400" />
                    <span className="text-xs font-bold text-navy text-center">{doc}</span>
                    <span className="text-[10px] text-gray-400">PDF, PNG ou JPG</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-petrol/5 rounded-xl border border-petrol/10">
                <p className="text-xs font-bold text-petrol uppercase mb-2">Status da Documentação</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="w-1/4 h-full bg-petrol"></div>
                  </div>
                  <span className="text-xs font-bold text-navy">25%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy text-lg flex items-center gap-2">
                <History className="text-petrol" size={20} /> Livro de Ocorrências
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newOccurrence.type} onValueChange={v => setNewOccurrence({...newOccurrence, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PEDAGÓGICO">Pedagógico</SelectItem>
                        <SelectItem value="FINANCEIRO">Financeiro</SelectItem>
                        <SelectItem value="DISCIPLINAR">Disciplinar</SelectItem>
                        <SelectItem value="SECRETARIA">Secretaria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={newOccurrence.title} onChange={e => setNewOccurrence({...newOccurrence, title: e.target.value})} placeholder="Assunto da ocorrência" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição Detalhada (Editor Rico)</Label>
                  <textarea 
                    className="w-full min-h-[100px] p-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-petrol outline-none"
                    value={newOccurrence.description}
                    onChange={e => setNewOccurrence({...newOccurrence, description: e.target.value})}
                    placeholder="Descreva os fatos com detalhes..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="visible" 
                    checked={newOccurrence.isVisibleToStudent} 
                    onChange={e => setNewOccurrence({...newOccurrence, isVisibleToStudent: e.target.checked})}
                    className="w-4 h-4 text-petrol rounded border-gray-300 focus:ring-petrol"
                  />
                  <Label htmlFor="visible" className="text-xs cursor-pointer">Visível para o Aluno no Portal</Label>
                </div>
                <Button className="w-full bg-petrol" onClick={handleAddOccurrence}>Registrar Ocorrência</Button>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {occurrences.sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map((occ) => {
                    const canEdit = occ.createdAt && differenceInMinutes(new Date(), occ.createdAt.toDate()) < 30;
                    return (
                      <div key={occ.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-petrol"></div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] font-bold text-petrol border-petrol/20">{occ.type}</Badge>
                              {!occ.isVisibleToStudent && <Badge variant="secondary" className="text-[9px]">INTERNO</Badge>}
                            </div>
                            <h4 className="font-bold text-navy">{occ.title}</h4>
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold">
                            {occ.createdAt?.toDate().toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{occ.description}</p>
                        
                        {/* Amendments Section */}
                        {occ.amendments && occ.amendments.length > 0 && (
                          <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Adendos / Retificações</p>
                            {occ.amendments.map((amend: any, idx: number) => (
                              <div key={idx} className="bg-gray-50 p-2 rounded-lg text-xs">
                                <p className="text-gray-600">{amend.text}</p>
                                <p className="text-[9px] text-gray-400 mt-1">Por {amend.authorName} em {new Date(amend.createdAt).toLocaleString('pt-BR')}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col gap-3 mt-4 pt-3 border-t border-gray-50">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">Registrado por: <span className="font-bold">{occ.authorName}</span></span>
                            {!canEdit && <Badge variant="secondary" className="text-[9px] opacity-50">MUTATION LOCK (30m)</Badge>}
                          </div>
                          
                          {!canEdit && (
                            <div className="flex gap-2">
                              <Input 
                                placeholder="Adicionar adendo..." 
                                className="h-8 text-xs"
                                value={amendmentText[occ.id] || ''}
                                onChange={e => setAmendmentText(prev => ({ ...prev, [occ.id]: e.target.value }))}
                              />
                              <Button size="sm" className="h-8 px-3 text-xs bg-navy" onClick={() => handleAddAmendment(occ.id)}>
                                Adendar
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </div>

      <ContractAutomation 
        isOpen={isContractOpen} 
        onClose={() => setIsContractOpen(false)} 
        student={student} 
        type={docType}
      />
    </Tabs>
  );
};
