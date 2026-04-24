import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  doc, 
  serverTimestamp,
  where,
  orderBy,
  Timestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Search, 
  FileText, 
  Upload, 
  MoreVertical, 
  UserPlus,
  User,
  Filter,
  Download,
  Info,
  Trash2,
  History,
  AlertTriangle,
  Award,
  CreditCard,
  Printer
} from 'lucide-react';
import { logAction, softDelete } from '../lib/audit';
import { syncTurmasIntegrity } from '../lib/academic';
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { DataActions } from './DataActions';

import { StudentProfileTabs } from './StudentProfileTabs';
import { AcademicHistoryModal } from './AcademicHistoryModal';

export const Students: React.FC = () => {
  const { nucleo, profile, setNucleo, user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [polos, setPolos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<any>(null);
  const [historyStudent, setHistoryStudent] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [newStudent, setNewStudent] = useState({
    name: '',
    cpf: '',
    birthDate: '',
    email: '',
    phone: '',
    course: 'TEOLOGIA',
    status: 'Ativo',
    rg: '',
    rgIssuer: '',
    rgState: '',
    birthCity: '',
    birthState: '',
    fatherName: '',
    motherName: '',
    maritalStatus: 'SOLTEIRO',
    gender: 'M',
    cep: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    phone2: '',
    profissao: '',
    dataConversao: '',
    dataBatismo: '',
    igrejaMembro: '',
    congregacao: '',
    funcaoIgreja: '',
    adminNotes: '',
    isLegacyMode: false,
    matricula: '',
    enrollmentDate: new Date().toISOString().split('T')[0],
    poloId: '',
    poloName: 'MATRIZ',
    modalidade: 'PRESENCIAL',
    nomeDesconto: 'DESCONTO PADRÃO',
    percentualDesconto: 0,
    valorIntegral: 206.00,
    valorComDesconto: 206.00,
    dueDayPattern: '10'
  });

  useEffect(() => {
    if (isAddDialogOpen) {
      const hasPolo = nucleo === 'SEMIPRESENCIAL';
      setNewStudent(prev => ({
        ...prev,
        modalidade: nucleo || 'PRESENCIAL',
        poloId: hasPolo && profile?.poloId && profile.poloId !== 'none' ? profile.poloId : (hasPolo ? prev.poloId : ''),
        poloName: hasPolo && profile?.poloName && profile.poloName !== 'MATRIZ' ? profile.poloName : (hasPolo ? prev.poloName : 'MATRIZ')
      }));
    }
  }, [isAddDialogOpen, nucleo, profile]);

  // CEP Auto-fill for Enrollment Form
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newStudent.cep?.length === 8) {
        fetch(`https://viacep.com.br/ws/${newStudent.cep}/json/`)
          .then(res => res.json())
          .then(data => {
            if (!data.erro) {
              setNewStudent(prev => ({
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
  }, [newStudent.cep]);

  const [otherNucleiCount, setOtherNucleiCount] = useState<{[key: string]: number}>({});
  const [visibleCount, setVisibleCount] = useState(20);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 20);
  };

  useEffect(() => {
    if (!profile || !user) return;

    let q = query(
      collection(db, 'students'), 
      where('nucleoId', '==', nucleo)
    );

    // Filter by Polo for coordinators
    if (profile.poloId) {
      q = query(
        collection(db, 'students'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((s: any) => !s.deleted && s.status !== 'inativo');
      
      const seen = new Set();
      const uniqueStudents = studentList.filter((s: any) => {
        const normalizedCpf = s.cpf?.toString().replace(/\D/g, '');
        const key = normalizedCpf || s.name?.toLowerCase().trim() || s.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      setStudents(uniqueStudents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const unsubAll = onSnapshot(collection(db, 'students'), (snap) => {
      const counts: {[key: string]: number} = { 'PRESENCIAL': 0, 'EAD': 0, 'SEMIPRESENCIAL': 0 };
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.deleted && data.status !== 'inativo' && data.nucleoId) {
          counts[data.nucleoId] = (counts[data.nucleoId] || 0) + 1;
        }
      });
      setOtherNucleiCount(counts);
    });

    const unsubPolos = onSnapshot(query(collection(db, 'school_units'), orderBy('name', 'asc')), (snap) => {
      setPolos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubAll();
      unsubPolos();
    };
  }, [nucleo, profile]);

  const generateMatricula = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const modCode = nucleo === 'PRESENCIAL' ? '01' : nucleo === 'EAD' ? '02' : '03';
    const courseCode = newStudent.course === 'TEOLOGIA' ? '10' : '20';
    const sequential = (students.length + 1).toString().padStart(3, '0');
    return `${year}${modCode}${courseCode}${sequential}`;
  };

  const getFifthBusinessDay = (year: number, month: number) => {
    // Calendário específico enviado pelo usuário para 2026
    const calendar2026: {[key: number]: number} = {
      0: 9,   // Janeiro
      1: 10,  // Fevereiro
      2: 6,   // Março
      3: 9,   // Abril
      4: 8,   // Maio
      5: 8,   // Junho
      6: 7,   // Julho
      7: 7,   // Agosto
      8: 8,   // Setembro
      9: 7,   // Outubro
      10: 9,  // Novembro
      11: 7   // Dezembro
    };

    if (year === 2026 && calendar2026[month] !== undefined) {
      return calendar2026[month];
    }

    // Lógica genérica de 5º dia útil para outros anos (Mon-Fri)
    let count = 0;
    let day = 1;
    while (count < 5) {
      const d = new Date(year, month, day);
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Ignora Sáb (6) e Dom (0)
        count++;
      }
      if (count < 5) day++;
    }
    return day;
  };

  const handleAddStudent = async () => {
    try {
      const matricula = newStudent.isLegacyMode ? newStudent.matricula : generateMatricula();
      const createdAt = newStudent.isLegacyMode ? Timestamp.fromDate(new Date(newStudent.enrollmentDate)) : serverTimestamp();
      
      const studentData = {
        ...newStudent,
        modality: nucleo, // Force modality from global state
        matricula,
        nucleoId: nucleo,
        createdAt,
        academicHistory: [],
        financialStatus: 'Regular',
        createdBy: profile?.uid || user?.uid || 'system'
      };

      const normalizedCpf = newStudent.cpf.replace(/\D/g, '');
      if (!normalizedCpf) {
        throw new Error('CPF é obrigatório para o cadastro.');
      }

      const studentRef = doc(db, 'students', normalizedCpf);
      await setDoc(studentRef, studentData);
      
      // Log action
      await logAction(profile?.uid || user?.uid || 'system', 'Matrícula Realizada', `Aluno ${newStudent.name} matriculado com ID ${matricula}`);

      setIsAddDialogOpen(false);
      setNewStudent({
        name: '',
        cpf: '',
        birthDate: '',
        email: '',
        phone: '',
        course: 'TEOLOGIA',
        status: 'Ativo',
        rg: '',
        rgIssuer: '',
        rgState: '',
        birthCity: '',
        birthState: '',
        fatherName: '',
        motherName: '',
        maritalStatus: 'SOLTEIRO',
        gender: 'M',
        cep: '',
        address: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        adminNotes: '',
        isLegacyMode: false,
        matricula: '',
        enrollmentDate: new Date().toISOString().split('T')[0],
        poloId: profile?.poloId || '',
        poloName: profile?.poloName || 'MATRIZ',
        modalidade: nucleo,
        nomeDesconto: 'DESCONTO PADRÃO',
        percentualDesconto: 0,
        valorIntegral: 206.00,
        valorComDesconto: 206.00,
        dueDayPattern: '10'
      } as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
  };

  const handleDeleteRequest = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    
    // Optimistic UI
    setStudents(prev => prev.filter(s => s.id !== id));
    setDeleteConfirm(null);

    try {
      // Soft delete student
      await updateDoc(doc(db, 'students', id), {
        deleted: true,
        status: 'inativo',
        updatedAt: serverTimestamp()
      });

      if (nucleo) syncTurmasIntegrity(nucleo);
      
      // Log action
      await logAction(profile?.uid || user?.uid || 'system', 'Exclusão de Aluno', `Aluno ${deleteConfirm.name} movido para a lixeira.`);
    } catch (error) {
      console.error("Erro ao deletar aluno:", error);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(s.matricula || '').includes(searchTerm) ||
    String(s.cpf || '').includes(searchTerm)
  );

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <AcademicHistoryModal 
        isOpen={!!historyStudent} 
        onClose={() => setHistoryStudent(null)} 
        student={historyStudent} 
      />
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
                  Deseja realmente mover o aluno <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span> para a lixeira?
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="hidden print:block mb-8 border-b-2 border-navy pb-4 w-full">
           <div className="flex justify-between items-end">
              <div>
                 <h1 className="text-2xl font-black uppercase text-navy">Relatório de Alunos</h1>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ESTEADEB - Sistema de Gestão Educacional</p>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-bold text-gray-500 uppercase">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
                 <p className="text-[10px] font-bold text-gray-500 uppercase">Núcleo: {nucleo}</p>
              </div>
           </div>
        </div>
        <div className="print:hidden">
          <h1 className="text-3xl font-bold text-navy tracking-tight">Alunos & GED</h1>
          <p className="text-gray-500">Gestão de matrículas e dossiê digital 360º.</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button 
            variant="outline" 
            onClick={() => window.print()}
            className="border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 h-10 px-4"
          >
            <Printer size={16} /> Imprimir Lista
          </Button>
          <DataActions 
            collectionName="students"
            data={students}
            title="Alunos"
            headers={[
              { key: 'matricula', label: 'Matricula' },
              { key: 'enrollmentDate', label: 'Data_Matricula', type: 'date' },
              { key: 'name', label: 'Nome' },
              { key: 'cpf', label: 'CPF' }
            ]}
            templateHeaders={[
              { key: 'matricula', label: 'Matricula' },
              { key: 'enrollmentDate', label: 'Data_Matricula', type: 'date' },
              { key: 'name', label: 'Nome' },
              { key: 'cpf', label: 'CPF' }
            ]}
            getRowId={(row) => row.cpf?.toString().replace(/\D/g, '')}
            transformRow={(row) => ({
              ...row,
              cpf: row.cpf?.toString().replace(/\D/g, '') || '', // Normalize CPF on import
              modality: 'Presencial',
              nucleoId: nucleo,
              status: 'Ativo',
              financialStatus: 'Regular'
            })}
            onImportSuccess={() => {
              if (nucleo) syncTurmasIntegrity(nucleo);
            }}
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={
              <Button className="bg-petrol hover:bg-petrol-dark gap-2">
                <UserPlus size={18} /> Nova Matrícula
              </Button>
            } />
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-navy text-xl">Ficha de Matrícula - {nucleo}</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="identificacao" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid grid-cols-6 w-full bg-navy/5 p-1 rounded-xl">
                  <TabsTrigger value="identificacao" className="text-[10px] uppercase font-bold">Identificação</TabsTrigger>
                  <TabsTrigger value="pessoais" className="text-[10px] uppercase font-bold">Pessoais</TabsTrigger>
                  <TabsTrigger value="eclesiastico" className="text-[10px] uppercase font-bold">Eclesiástico</TabsTrigger>
                  <TabsTrigger value="contato" className="text-[10px] uppercase font-bold">Contato</TabsTrigger>
                  <TabsTrigger value="financeiro" className="text-[10px] uppercase font-bold">Financeiro</TabsTrigger>
                  <TabsTrigger value="ged" className="text-[10px] uppercase font-bold">GED</TabsTrigger>
                  <TabsTrigger value="ocorrencias" className="text-[10px] uppercase font-bold">Notas</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 py-4 pr-4">
                  <TabsContent value="identificacao" className="space-y-4 mt-0">
                    <div className="flex items-center space-x-2 bg-amber-50 p-3 rounded-lg border border-amber-100 mb-4">
                      <Checkbox 
                        id="legacy" 
                        checked={newStudent.isLegacyMode}
                        onCheckedChange={(checked) => setNewStudent({
                          ...newStudent, 
                          isLegacyMode: checked as boolean,
                          matricula: checked ? generateMatricula() : '',
                          enrollmentDate: new Date().toISOString().split('T')[0]
                        })}
                      />
                      <Label htmlFor="legacy" className="text-amber-900 font-semibold cursor-pointer">
                        Inserir dados manualmente (Aluno Legado)
                      </Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className={cn(newStudent.isLegacyMode ? "text-navy" : "text-gray-400")}>
                          Número de Matrícula {newStudent.isLegacyMode ? "" : "(Auto-gerado)"}
                        </Label>
                        <Input 
                          disabled={!newStudent.isLegacyMode} 
                          value={String(newStudent.isLegacyMode ? newStudent.matricula : generateMatricula() || '')} 
                          onChange={(e) => setNewStudent({...newStudent, matricula: e.target.value})}
                          className={cn(!newStudent.isLegacyMode && "bg-gray-50 border-dashed")} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={cn(newStudent.isLegacyMode ? "text-navy" : "text-gray-400")}>
                          Data de Matrícula
                        </Label>
                        <Input 
                          type="date"
                          disabled={!newStudent.isLegacyMode} 
                          value={String(newStudent.isLegacyMode ? newStudent.enrollmentDate : new Date().toISOString().split('T')[0] || '')} 
                          onChange={(e) => setNewStudent({...newStudent, enrollmentDate: e.target.value})}
                          className={cn(!newStudent.isLegacyMode && "bg-gray-50 border-dashed")} 
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input 
                          id="name" 
                          value={newStudent.name} 
                          onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                          placeholder="Nome do aluno"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cpf">CPF</Label>
                        <Input 
                          id="cpf" 
                          value={newStudent.cpf} 
                          onChange={(e) => setNewStudent({...newStudent, cpf: e.target.value})}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Polo de Apoio</Label>
                        <Select 
                          value={newStudent.poloId || 'none'} 
                          onValueChange={(v) => {
                            const polo = polos.find(p => p.id === v);
                            setNewStudent({...newStudent, poloId: v === 'none' ? '' : v, poloName: polo ? polo.name : 'MATRIZ'});
                          }}
                          disabled={nucleo !== 'SEMIPRESENCIAL' || (profile?.poloId && profile.poloId !== 'none')}
                        >
                          <SelectTrigger className={cn((nucleo !== 'SEMIPRESENCIAL' || (profile?.poloId && profile.poloId !== 'none')) && "bg-gray-50 border-dashed")}>
                            <SelectValue placeholder={nucleo !== 'SEMIPRESENCIAL' ? 'MATRIZ' : 'Selecione o Polo'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">MATRIZ</SelectItem>
                            {polos.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Modalidade</Label>
                        <Select value={newStudent.modalidade} onValueChange={(v) => setNewStudent({...newStudent, modalidade: v})} disabled>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRESENCIAL">PRESENCIAL</SelectItem>
                            <SelectItem value="EAD">EAD</SelectItem>
                            <SelectItem value="SEMIPRESENCIAL">SEMIPRESENCIAL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status Inicial</Label>
                        <Select value={newStudent.status} onValueChange={(v) => setNewStudent({...newStudent, status: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ativo">Ativo</SelectItem>
                            <SelectItem value="Trancado">Trancado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="pessoais" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data de Nascimento</Label>
                        <Input type="date" value={newStudent.birthDate} onChange={e => setNewStudent({...newStudent, birthDate: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1 space-y-2">
                          <Label>RG</Label>
                          <Input value={newStudent.rg} onChange={e => setNewStudent({...newStudent, rg: e.target.value})} />
                        </div>
                        <div className="col-span-1 space-y-2">
                          <Label>Emissor</Label>
                          <Input value={newStudent.rgIssuer} onChange={e => setNewStudent({...newStudent, rgIssuer: e.target.value})} />
                        </div>
                        <div className="col-span-1 space-y-2">
                          <Label>UF RG</Label>
                          <Input value={newStudent.rgState} onChange={e => setNewStudent({...newStudent, rgState: e.target.value})} maxLength={2} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Naturalidade (Cidade)</Label>
                          <Input value={newStudent.birthCity} onChange={e => setNewStudent({...newStudent, birthCity: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>UF</Label>
                          <Input value={newStudent.birthState} onChange={e => setNewStudent({...newStudent, birthState: e.target.value})} maxLength={2} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Estado Civil</Label>
                        <Select value={newStudent.maritalStatus} onValueChange={v => setNewStudent({...newStudent, maritalStatus: v})}>
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
                        <Label>Sexo</Label>
                        <Select value={newStudent.gender} onValueChange={v => setNewStudent({...newStudent, gender: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">Masculino</SelectItem>
                            <SelectItem value="F">Feminino</SelectItem>
                            <SelectItem value="O">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nome do Pai</Label>
                        <Input value={newStudent.fatherName} onChange={e => setNewStudent({...newStudent, fatherName: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Nome da Mãe</Label>
                        <Input value={newStudent.motherName} onChange={e => setNewStudent({...newStudent, motherName: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Profissão</Label>
                        <Input value={newStudent.profissao} onChange={e => setNewStudent({...newStudent, profissao: e.target.value})} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="eclesiastico" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data de Conversão</Label>
                        <Input type="date" value={newStudent.dataConversao} onChange={e => setNewStudent({...newStudent, dataConversao: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Data do Batismo em Águas</Label>
                        <Input type="date" value={newStudent.dataBatismo} onChange={e => setNewStudent({...newStudent, dataBatismo: e.target.value})} />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>Igreja da qual é Membro</Label>
                        <Input value={newStudent.igrejaMembro} onChange={e => setNewStudent({...newStudent, igrejaMembro: e.target.value})} placeholder="Ex: Assembleia de Deus" />
                      </div>
                      <div className="space-y-2">
                        <Label>Congregação</Label>
                        <Input value={newStudent.congregacao} onChange={e => setNewStudent({...newStudent, congregacao: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Função / Cargo</Label>
                        <Input value={newStudent.funcaoIgreja} onChange={e => setNewStudent({...newStudent, funcaoIgreja: e.target.value})} placeholder="Ex: Diácono, Obreiro, Membro" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="contato" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>E-mail (Login/Avisos)</Label>
                        <Input type="email" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} placeholder="aluno@email.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>WhatsApp/Telefone Principal</Label>
                        <Input value={newStudent.phone} onChange={e => setNewStudent({...newStudent, phone: e.target.value})} placeholder="(00) 00000-0000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone Secundário</Label>
                        <Input value={newStudent.phone2} onChange={e => setNewStudent({...newStudent, phone2: e.target.value})} placeholder="(00) 00000-0000" />
                      </div>
                      <div className="space-y-2">
                        <Label>CEP (Auto-preenchimento)</Label>
                        <Input value={newStudent.cep} onChange={e => setNewStudent({...newStudent, cep: e.target.value})} maxLength={8} placeholder="00000000" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-2">
                          <Label>Rua</Label>
                          <Input value={newStudent.address} onChange={e => setNewStudent({...newStudent, address: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Número</Label>
                          <Input value={newStudent.number} onChange={e => setNewStudent({...newStudent, number: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Bairro</Label>
                        <Input value={newStudent.neighborhood} onChange={e => setNewStudent({...newStudent, neighborhood: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Cidade</Label>
                          <Input value={newStudent.city} onChange={e => setNewStudent({...newStudent, city: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>UF</Label>
                          <Input value={newStudent.state} onChange={e => setNewStudent({...newStudent, state: e.target.value})} maxLength={2} />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="financeiro" className="space-y-4 mt-0">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                        <CreditCard className="text-petrol" size={20} />
                        <h3 className="font-black text-navy uppercase text-sm tracking-tight">Plano Financeiro de Matrícula</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Desconto / Bolsa</Label>
                          <Input 
                            value={newStudent.nomeDesconto} 
                            onChange={e => setNewStudent({...newStudent, nomeDesconto: e.target.value})}
                            placeholder="Ex: DESCONTO PADRÃO"
                            className="bg-white border-slate-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Percentual de Desconto (%)</Label>
                          <Input 
                            type="number"
                            value={newStudent.percentualDesconto} 
                            onChange={e => {
                              const pct = parseFloat(e.target.value) || 0;
                              const integral = Number(newStudent.valorIntegral) || 0;
                              const discounted = integral * (1 - pct / 100);
                              setNewStudent({
                                ...newStudent, 
                                percentualDesconto: pct,
                                valorComDesconto: Number(discounted.toFixed(2))
                              });
                            }}
                            className="bg-white border-slate-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Integral (R$)</Label>
                          <Input 
                            type="number"
                            value={newStudent.valorIntegral} 
                            onChange={e => {
                              const integral = parseFloat(e.target.value) || 0;
                              const pct = Number(newStudent.percentualDesconto) || 0;
                              const discounted = integral * (1 - pct / 100);
                              setNewStudent({
                                ...newStudent, 
                                valorIntegral: integral,
                                valorComDesconto: Number(discounted.toFixed(2))
                              });
                            }}
                            className="bg-white border-slate-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Final (Com Desconto) (R$)</Label>
                          <Input 
                            type="number"
                            value={newStudent.valorComDesconto} 
                            onChange={e => {
                              const discounted = parseFloat(e.target.value) || 0;
                              const integral = Number(newStudent.valorIntegral) || 0;
                              let pct = 0;
                              if (integral > 0) {
                                pct = ((integral - discounted) / integral) * 100;
                              }
                              setNewStudent({
                                ...newStudent, 
                                valorComDesconto: discounted,
                                percentualDesconto: Number(pct.toFixed(2))
                              });
                            }}
                            className="bg-white border-slate-200 font-bold text-petrol"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vencimento Padrão</Label>
                          <Select 
                            value={newStudent.dueDayPattern} 
                            onValueChange={v => setNewStudent({...newStudent, dueDayPattern: v})}
                          >
                            <SelectTrigger className="bg-white border-slate-200">
                              <SelectValue placeholder="Selecione o padrão de vencimento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5_UTIL">5º Dia Útil (Conforme Tabela)</SelectItem>
                              <SelectItem value="10">Todo dia 10</SelectItem>
                              <SelectItem value="20">Todo dia 20</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <p className="text-[10px] text-amber-800 font-bold uppercase tracking-tight flex items-center gap-2">
                          <Info size={14} /> Aviso do Sistema
                        </p>
                        <p className="text-[10px] text-amber-700/70 mt-1">Ao finalizar a matrícula, o sistema irá gerar automaticamente 12 parcelas com os valores configurados acima.</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="ged" className="space-y-4 mt-0">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center gap-2">
                        <Upload className="text-gray-300" />
                        <span className="text-xs font-bold text-navy">Identidade (Frente/Verso)</span>
                        <Input type="file" className="text-[10px]" />
                      </div>
                      <div className="p-4 border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center gap-2">
                        <Upload className="text-gray-300" />
                        <span className="text-xs font-bold text-navy">Comprovante de Residência</span>
                        <Input type="file" className="text-[10px]" />
                      </div>
                      <div className="p-4 border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center gap-2">
                        <Upload className="text-gray-300" />
                        <span className="text-xs font-bold text-navy">Histórico Escolar / Certificado</span>
                        <Input type="file" className="text-[10px]" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="ocorrencias" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label>Notas Administrativas / Ocorrências Iniciais</Label>
                      <textarea 
                        className="w-full min-h-[200px] p-4 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-petrol outline-none"
                        placeholder="Insira observações administrativas relevantes para esta matrícula..."
                        value={newStudent.adminNotes}
                        onChange={e => setNewStudent({...newStudent, adminNotes: e.target.value})}
                      />
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-navy" onClick={handleAddStudent}>Finalizar Matrícula</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar por nome, matrícula ou CPF..." 
              className="pl-10 bg-gray-50 border-none focus-visible:ring-petrol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400">
            <Filter size={20} />
          </Button>
        </div>

        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-bold text-navy">Aluno</TableHead>
                <TableHead className="font-bold text-navy">Matrícula</TableHead>
                <TableHead className="font-bold text-navy">Polo / Modalidade</TableHead>
                <TableHead className="font-bold text-navy">Status</TableHead>
                <TableHead className="font-bold text-navy">Financeiro</TableHead>
                <TableHead className="text-right font-bold text-navy">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 space-y-6">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <Search size={32} className="text-slate-300" />
                      </div>
                      <div className="space-y-1 text-center">
                        <p className="text-navy font-black uppercase tracking-widest text-sm">
                          Nenhum aluno em: {nucleo}
                        </p>
                        {!(profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL') && (
                          <p className="text-xs text-slate-400 font-medium">
                            Filtro ativo: {nucleo} • Total na base: {Object.values(otherNucleiCount).reduce((a, b) => a + b, 0)}
                          </p>
                        )}
                      </div>

                      {!(profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL') && Object.entries(otherNucleiCount).some(([k, v]) => k !== nucleo && v > 0) && (
                        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 max-w-md mx-auto text-center">
                          <p className="text-[10px] text-amber-800 font-black uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
                             <AlertTriangle size={14} /> Localizamos alunos em outras modalidades:
                          </p>
                          <div className="flex justify-center flex-wrap gap-2">
                             {Object.entries(otherNucleiCount).map(([k, v]) => (
                               v > 0 && k !== nucleo && (
                                 <Button 
                                   key={k}
                                   variant="outline" 
                                   size="sm"
                                   onClick={() => setNucleo(k as any)}
                                   className="text-[10px] font-black uppercase border-amber-200 text-amber-700 bg-white hover:bg-amber-100"
                                 >
                                   Ver {v} em {k}
                                 </Button>
                               )
                             ))}
                          </div>
                          <p className="text-[10px] text-amber-600 mt-4 italic">
                            Dica: Use o seletor de "MODALIDADE" no topo da página para alternar entre os núcleos.
                          </p>
                        </div>
                      )}

                      {((profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL') || !Object.values(otherNucleiCount).some(v => v > 0)) && (
                         <div className="flex flex-col items-center gap-4">
                            {!Object.values(otherNucleiCount).some(v => v > 0) && <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] text-center">Não há registros em nenhuma modalidade</p>}
                            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-navy rounded-xl">
                               <Plus size={16} className="mr-2" /> Cadastrar Primeiro Aluno
                            </Button>
                         </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.slice(0, visibleCount).map((student) => (
                  <TableRow key={student.id} className="hover:bg-gray-50 transition-colors group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarFallback className="bg-navy text-white text-xs">{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-navy leading-none">{student.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{student.course}</p>
                            {student.className && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-[10px] text-indigo-500 uppercase font-black tracking-widest">{student.className}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-petrol">{student.matricula}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-navy uppercase tracking-tight">{student.poloName || 'MATRIZ'}</p>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase border-navy/10 text-navy/60 px-1 py-0 h-4">
                          {student.modality}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "font-bold text-[10px] uppercase",
                        student.status === 'Ativo' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                        student.status === 'Trancado' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
                        "bg-blue-100 text-blue-700 hover:bg-blue-100"
                      )}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "font-bold",
                        student.financialStatus === 'Regular' ? "border-green-200 text-green-600" : "border-red-200 text-red-600"
                      )}>
                        {student.financialStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Dialog open={!!selectedStudentForProfile && selectedStudentForProfile.id === student.id} onOpenChange={(open) => !open && setSelectedStudentForProfile(null)}>
                          <DialogTrigger render={
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-petrol hover:bg-petrol/5" 
                              title="Ver Perfil Completo"
                              onClick={() => setSelectedStudentForProfile(student)}
                            >
                              <User size={16} />
                            </Button>
                          } />
                          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-3 text-navy text-xl">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-petrol text-white">{student.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p>{student.name}</p>
                                    {student.contractSigned && (
                                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5">
                                        Contrato Assinado Digitalmente
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 font-mono uppercase tracking-widest">Dossiê Digital: {student.matricula}</p>
                                </div>
                              </DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto py-4">
                              <StudentProfileTabs student={student} onUpdate={() => setSelectedStudentForProfile(null)} />
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger render={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-navy hover:bg-navy/5" title="Histórico/Auditoria">
                              <Info size={16} />
                            </Button>
                          } />
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <History size={20} className="text-petrol" />
                                Histórico de Auditoria: {student.name}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-xs font-bold text-navy uppercase mb-2">Criação do Registro</p>
                                <p className="text-sm text-gray-600">Realizada por {student.createdBy?.slice(0, 8)} em {student.createdAt?.toDate().toLocaleString('pt-BR')}</p>
                              </div>
                              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-xs font-bold text-navy uppercase mb-2">Última Ação</p>
                                <p className="text-sm text-gray-600">{student.lastAction || 'Nenhuma alteração registrada.'}</p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                          onClick={() => setHistoryStudent(student)}
                          title="Ver Histórico Acadêmico"
                        >
                          <Award size={16} />
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-emerald-500 hover:bg-emerald-50"
                          onClick={() => {
                            const password = student.birthDate ? student.birthDate.split('-').reverse().join('') : 'Não informada';
                            const url = window.location.origin;
                            const text = `Olá ${student.name.split(' ')[0]}, toda a honra e glória a Deus por sua vida! 🙏\n\nSua matrícula na ESTEADEB no curso de *${student.course || 'TEOLOGIA'}* foi confirmada de forma bem-sucedida! 🎓\n\nEstamos felizes em tê-lo conosco! Para acompanhar suas notas, requerimentos e avisos, acesse o seu *Portal do Aluno*.\n\n🌐 *Acesse:* ${url}\n📌 *Seu RA/Matrícula:* ${student.matricula || student.id.slice(-6)}\n🔑 *Senha Inicial:* ${password}\n\nEstamos ansiosos pelas suas aulas!\n\n_Equipe ESTEADEB_`;
                            const waUrl = `https://wa.me/${student.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
                            window.open(waUrl, '_blank');
                          }}
                          title="Enviar Kit Boas-Vindas (WhatsApp)"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" /></svg>
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-400 hover:bg-red-50"
                          onClick={() => handleDeleteRequest(student.id, student.name)}
                          title="Mover para Lixeira"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {visibleCount < filteredStudents.length && (
            <div className="p-6 flex justify-center border-t border-slate-100">
              <Button 
                variant="outline" 
                onClick={handleLoadMore}
                className="h-10 px-8 rounded-xl font-bold uppercase tracking-widest text-[#2B3A67] border-[#2B3A67]/20 hover:bg-[#2B3A67]/5"
              >
                Carregar Mais Resultados
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};