import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  BookOpen, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileText, 
  Printer,
  Search,
  History,
  Award,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AcademicGradeLinker } from './AcademicGradeLinker';
import { ClassDiaryModal } from './ClassDiaryModal';
import { QRCodeSVG } from 'qrcode.react';

export const Academic: React.FC = () => {
  const { nucleo, profile, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false);
  const [academicRecords, setAcademicRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time Sync for Academic Records
  useEffect(() => {
    if (!nucleo || !profile || !user) return;

    let q = query(
      collection(db, 'academic_records'), 
      where('nucleoId', '==', nucleo),
      orderBy('studentName', 'asc')
    );

    if (profile?.poloId) {
      q = query(
        collection(db, 'academic_records'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('studentName', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAcademicRecords(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'academic_records');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [nucleo]);

  // Derived data from academicRecords
  const stats = React.useMemo(() => {
    if (academicRecords.length === 0) return { ap: 0, dp: 0, pd: 0 };
    const total = academicRecords.length;
    return {
      ap: Math.round((academicRecords.filter(r => r.status === 'Aprovado' || r.status === 'AP').length / total) * 100),
      dp: Math.round((academicRecords.filter(r => r.status === 'Reprovado' || r.status === 'DP').length / total) * 100),
      pd: Math.round((academicRecords.filter(r => r.status === 'PD' || r.status === 'Recuperação' || r.status === 'Pendente').length / total) * 100),
    };
  }, [academicRecords]);

  const filteredRecords = React.useMemo(() => {
    return academicRecords.filter(r => 
      (r.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.disciplina || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [academicRecords, searchTerm]);

  // For history view
  const [historySubjects, setHistorySubjects] = useState<any[]>([]);
  useEffect(() => {
    if (selectedStudent) {
      // Find all records for this student
      const studentHistory = academicRecords.filter(r => r.studentId === selectedStudent.studentId || r.studentId === selectedStudent.id);
      setHistorySubjects(studentHistory.map(r => ({
        code: r.disciplinaId?.slice(0, 6) || 'GRADE',
        name: r.disciplina,
        ch: r.workload || 40,
        grade: r.nota || 0,
        status: r.status === 'Aprovado' ? 'AP' : r.status === 'Reprovado' ? 'DP' : 'PD'
      })));
    }
  }, [selectedStudent, academicRecords]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AP': return <Badge className="bg-green-100 text-green-700 font-bold hover:bg-green-100">AP (Aprovado)</Badge>;
      case 'DP': return <Badge className="bg-red-100 text-red-700 font-bold hover:bg-red-100">DP (Dependência)</Badge>;
      case 'PD': return <Badge className="bg-orange-100 text-orange-700 font-bold hover:bg-orange-100">PD (Pendente)</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy tracking-tight">Gestão Acadêmica Master</h1>
          <p className="text-gray-500">Pauta eletrônica, históricos com QR Code e diplomas (Aba 11/12/14).</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2 border-navy text-navy"
            onClick={() => setIsDiaryModalOpen(true)}
          >
            <Printer size={18} /> Diário de Classe
          </Button>
          <Button className="bg-petrol hover:bg-petrol-dark gap-2">
            <FileText size={18} /> Lançar Notas em Massa
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-gray-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-navy font-bold">Visão Geral</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-navy font-bold">Histórico & Diplomas</TabsTrigger>
          <TabsTrigger value="linker" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-navy font-bold">Vínculos & Grade</TabsTrigger>
          <TabsTrigger value="complementary" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-navy font-bold">Horas Complementares</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">Aprovados (AP)</p>
                <h4 className="text-2xl font-bold text-navy">{stats.ap}%</h4>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">Reprovados (DP)</p>
                <h4 className="text-2xl font-bold text-navy">{stats.dp}%</h4>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">Pendentes (PD)</p>
                <h4 className="text-2xl font-bold text-navy">{stats.pd}%</h4>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input 
                  placeholder="Filtrar por aluno ou disciplina..." 
                  className="pl-10 bg-gray-50 border-none focus-visible:ring-petrol"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-bold text-navy">Aluno</TableHead>
                  <TableHead className="font-bold text-navy">Disciplina</TableHead>
                  <TableHead className="font-bold text-navy">Nota</TableHead>
                  <TableHead className="font-bold text-navy">Frequência</TableHead>
                  <TableHead className="font-bold text-navy">Status</TableHead>
                  <TableHead className="text-right font-bold text-navy">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-12 text-center">
                      <Loader2 className="animate-spin inline-block mr-2" /> Carregando registros...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-12 text-center text-gray-400 italic">
                      Nenhum registro acadêmico encontrado para esta modalidade/polo.
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-bold text-navy uppercase text-xs">{item.studentName}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.studentMatricula || item.studentId.slice(0, 8)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-petrol uppercase">{item.disciplina}</TableCell>
                    <TableCell className="font-bold text-navy">{item.nota ?? '-'}</TableCell>
                    <TableCell className="text-[10px] font-medium text-gray-500 uppercase">{item.faltas ?? 0} Faltas</TableCell>
                    <TableCell>{getStatusBadge(item.status === 'Aprovado' ? 'AP' : item.status === 'Reprovado' ? 'DP' : 'PD')}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-petrol font-bold uppercase text-[10px] tracking-widest gap-2"
                        onClick={() => setSelectedStudent(item)}
                      >
                        Histórico <ChevronRight size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          {!selectedStudent ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
              <History size={48} className="text-gray-200 mb-4" />
              <h3 className="text-xl font-bold text-navy">Emissão de Histórico Escolar</h3>
              <p className="text-gray-500 max-w-sm mt-2">Clique em "Ver Histórico" na aba Visão Geral para gerar o documento oficial.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8 relative overflow-hidden">
                <div className="flex justify-between items-start border-b-2 border-navy pb-6">
                  <div>
                    <h2 className="text-2xl font-black text-navy tracking-tighter">HISTÓRICO ESCOLAR OFICIAL</h2>
                    <p className="text-xs font-bold text-petrol uppercase tracking-widest">ESTEADEB - Escola de Teologia das Assembleias de Deus</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Registro de Livro</p>
                    <p className="text-sm font-bold text-navy">LIVRO: 04 | FOLHA: 128 | REG: 2026-001</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 text-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Nome do Aluno</p>
                    <p className="font-bold text-navy uppercase">{selectedStudent.studentName || selectedStudent.name}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Matrícula</p>
                    <p className="font-bold text-navy">{selectedStudent.studentMatricula || selectedStudent.matricula}</p>
                  </div>
                </div>

                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold">CÓDIGO</TableHead>
                      <TableHead className="text-[10px] font-bold">DISCIPLINA</TableHead>
                      <TableHead className="text-[10px] font-bold">C.H.</TableHead>
                      <TableHead className="text-[10px] font-bold">NOTA</TableHead>
                      <TableHead className="text-[10px] font-bold">STATUS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historySubjects.map((sub) => (
                      <TableRow key={sub.code} className="text-xs">
                        <TableCell className="font-mono font-bold text-petrol">{sub.code}</TableCell>
                        <TableCell className="font-bold text-navy">{sub.name}</TableCell>
                        <TableCell>{sub.ch}h</TableCell>
                        <TableCell className="font-bold">{sub.grade.toFixed(1)}</TableCell>
                        <TableCell><Badge className="bg-green-50 text-green-600 border-none text-[10px]">{sub.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-between items-end pt-8 border-t border-gray-100">
                  <div className="space-y-4">
                    <div className="w-48 border-b border-navy pt-8"></div>
                    <p className="text-[10px] font-bold text-navy uppercase text-center">Secretaria Acadêmica</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <QRCodeSVG value={`https://esteadeb.edu.br/verify/${selectedStudent.studentMatricula || selectedStudent.matricula}`} size={80} />
                    <p className="text-[8px] font-bold text-gray-400 uppercase">Autenticidade Garantida</p>
                  </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none rotate-12">
                  <BookOpen size={300} />
                </div>
              </div>

              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-navy text-white">
                  <div className="p-6 space-y-4">
                    <h3 className="font-bold flex items-center gap-2"><CheckCircle size={18} className="text-petrol" /> Ações de Certificação</h3>
                    <Button className="w-full bg-petrol hover:bg-petrol-dark gap-2">
                      <Printer size={18} /> Imprimir Histórico
                    </Button>
                    <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 gap-2">
                      <Award size={18} /> Gerar Diploma (Fábrica)
                    </Button>
                  </div>
                </Card>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Resumo Acadêmico</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Média Geral:</span>
                      <span className="font-bold text-navy">8.5</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">C.H. Total:</span>
                      <span className="font-bold text-navy">220h / 1.800h</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-petrol h-full w-[12%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="linker">
          <AcademicGradeLinker />
        </TabsContent>

        <TabsContent value="complementary">
          <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <Award size={48} className="text-gray-200 mb-4" />
            <h3 className="text-xl font-bold text-navy">Horas Complementares</h3>
            <p className="text-gray-500 max-w-sm mt-2">Módulo em desenvolvimento para gestão de atividades extracurriculares.</p>
          </div>
        </TabsContent>
      </Tabs>

      <ClassDiaryModal 
        isOpen={isDiaryModalOpen} 
        onClose={() => setIsDiaryModalOpen(false)} 
      />
    </div>
  );
};
