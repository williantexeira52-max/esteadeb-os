import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  getDocs,
  orderBy,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  FileText, 
  Printer, 
  Download, 
  Users, 
  DollarSign, 
  GraduationCap,
  ChevronRight,
  Search,
  Calendar,
  CheckCircle2,
  X,
  Award,
  BookOpen,
  ClipboardList
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
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface Student {
  id: string;
  name: string;
  matricula: string;
  status: string;
  deleted?: boolean;
  course?: string;
  classId?: string;
  cpf?: string;
  rg?: string;
  birthDate?: string;
  birthCity?: string;
  birthState?: string;
  filiation?: string;
  completionYear?: string;
  address?: string;
  phone?: string;
}

interface Class {
  id: string;
  name: string;
  courseId?: string;
}

interface Grade {
  studentId: string;
  moduleId: string;
  moduleName: string;
  grade: number;
}

export const Reports: React.FC = () => {
  const { profile, systemConfig, user, nucleo } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [polos, setPolos] = useState<any[]>([]);
  const [selectedPoloId, setSelectedPoloId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedSignature, setSelectedSignature] = useState('director');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printContent, setPrintContent] = useState<{ title: string; html: React.ReactNode } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    let studentsQuery = query(
      collection(db, 'students'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );

    if (profile?.poloId) {
      studentsQuery = query(
        collection(db, 'students'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('name', 'asc')
      );
    } else if (selectedPoloId && selectedPoloId !== 'none') {
      studentsQuery = query(
        collection(db, 'students'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', selectedPoloId),
        orderBy('name', 'asc')
      );
    }

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
        const studentList = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Student))
          .filter(s => s.id && !s.deleted && s.status !== 'inativo');
        
        const seen = new Set();
        const uniqueStudents = studentList.filter(s => {
          const normalizedCpf = s.cpf?.toString().replace(/\D/g, '');
          const key = normalizedCpf || s.name?.toLowerCase().trim() || s.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        
        setStudents(uniqueStudents);
      }
    );

    let classesQuery = query(
      collection(db, 'classes'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    
    if (profile?.poloId) {
      classesQuery = query(
        collection(db, 'classes'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('name', 'asc')
      );
    } else if (selectedPoloId && selectedPoloId !== 'none') {
      classesQuery = query(
        collection(db, 'classes'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', selectedPoloId),
        orderBy('name', 'asc')
      );
    }

    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
        setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      }
    );

    const unsubPolos = onSnapshot(query(
      collection(db, 'school_units'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    ), (snap) => {
      setPolos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeStudents();
      unsubscribeClasses();
      unsubPolos();
    };
  }, [nucleo, profile, user, selectedPoloId]);

  const [selectedDocument, setSelectedDocument] = useState('');

  const generateDocument = () => {
    switch (selectedDocument) {
      case 'matricula': generateDeclaracaoMatricula(); break;
      case 'requerimentoMatricula': generateRequerimentoMatricula(); break;
      case 'tcc': generateAutorizacaoTcc(); break;
      case 'nadaConsta': generateNadaConsta(); break;
      case 'conclusao': generateConclusao(); break;
      case 'historico': generateHistorico(); break;
      case 'certificado': generateCertificado(); break;
      case 'desconto': generateRequerimentoDesconto(); break;
      case 'contrato': generateContrato(); break;
      default: alert('Por favor, selecione um documento.'); break;
    }
  };

  const getSignatureData = (docType?: string) => {
    if (!systemConfig) return { name: 'Sérgio Lins Pessoa', role: 'Diretor', url: '' };

    // Regra: Assinatura de Sergio Lins não aparece em Matricula, Desconto e Contrato
    // Se o selecionado for Diretor (Sergio) e o documento for um desses, retornamos vazio ou nulo
    const isSergio = selectedSignature === 'director';
    
    switch (selectedSignature) {
      case 'director': 
        return { 
          name: systemConfig.directorName || 'Sérgio Lins Pessoa', 
          role: 'Diretor', 
          url: systemConfig.directorSignatureUrl 
        };
      case 'pedagogical': 
        return { 
          name: systemConfig.pedagogicalName || 'Arlete Duarte de Almeida Costa', 
          role: 'Coordenadora Pedagógica', 
          url: systemConfig.pedagogicalSignatureUrl 
        };
      case 'secretary': 
        return { 
          name: systemConfig.secretaryName || 'Secretaria Acadêmica', 
          role: 'Secretário(a)', 
          url: systemConfig.secretarySignatureUrl 
        };
      default: 
        return { name: systemConfig.directorName || 'Sérgio Lins Pessoa', role: 'Diretor', url: '' };
    }
  };

  const generateNadaConsta = async () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    // Check financial status for "Nada Consta"
    const q = query(
      collection(db, 'financial_installments'),
      where('studentId', '==', selectedStudentId),
      where('status', 'in', ['Pendente', 'Em Atraso'])
    );
    const snapshot = await getDocs(q);
    
    // We can still print it, but just alert the user if they want to proceed
    if (!snapshot.empty) {
      const proceed = window.confirm(`ATENÇÃO: O aluno possui ${snapshot.size} parcela(s) em aberto ou atraso. Deseja emitir o Nada Consta mesmo assim?`);
      if (!proceed) return;
    }

    const sig = getSignatureData('nadaConsta');

    setPrintContent({
      title: 'Declaração de Nada Consta Financeiro',
      html: (
        <div className="p-16 space-y-12 text-slate-800 font-serif max-w-4xl mx-auto bg-white relative min-h-[1100px]">
          <div className="relative flex items-center justify-center min-h-[120px] mb-8 w-full">
            <div className="absolute left-0 top-0">
              {systemConfig?.logoUrl ? (
                <img src={systemConfig.logoUrl} alt="Logo" className="h-28 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 bg-navy/5 flex items-center justify-center rounded-xl overflow-hidden shadow-inner">
                  <GraduationCap size={48} className="text-navy" />
                </div>
              )}
            </div>
            <div className="text-center space-y-1 w-full px-32">
              <h1 className="text-5xl font-black text-navy tracking-tighter uppercase leading-none">{systemConfig?.schoolName || 'ESTEADEB'}</h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-500">{systemConfig?.legalText || 'Escola Teológica das Assembleias de Deus no Brasil'}</p>
              <div className="pt-2 flex justify-center gap-4 text-[9px] font-bold text-slate-400 border-t border-slate-100 mt-2 mx-auto max-w-xs">
                <span>CNPJ: {systemConfig?.cnpj || '40.800.393/0001-32'}</span>
                <span>•</span>
                <span>NATAL - RN</span>
              </div>
            </div>
          </div>
          
          <div className="text-center py-12">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-navy inline-block pb-2">Declaração de Quitação / Nada Consta</h2>
          </div>

          <div className="text-justify leading-[2] space-y-8 text-lg px-8">
            <p>
              Declaramos para os devidos fins que o(a) aluno(a) <strong>{student.name.toUpperCase()}</strong>, 
              portador(a) do CPF nº <strong>{student.cpf || '000.000.000-00'}</strong>, matriculado(a) sob o número de 
              RA <strong>{student.matricula || '---'}</strong> no curso de <strong>{student.course?.toUpperCase() || 'TEOLOGIA'}</strong>, 
              encontra-se na presente data com sua situação <strong>REGULAR</strong> junto à tesouraria desta instituição, 
              não constando débitos referentes a mensalidades, taxas de material ou outros encargos educacionais vencidos até o presente momento.
            </p>
            <p>
              Ressalvamos o direito de efetuar futuras cobranças de débitos que porventura venham a ser apurados ou que vencerão após a emissão deste documento.
            </p>
            <p>
              Por ser expressão da verdade, firmamos a presente declaração para que produza os efeitos legais necessários.
            </p>
          </div>

          <div className="pt-32 text-center space-y-8">
            <p className="font-bold">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}.</p>
            
            <div className="flex flex-col items-center">
              <div className="w-80 border-t-2 border-slate-900 pt-4 relative">
                {sig.url && (
                  <img src={sig.url} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
                )}
                <p className="font-black uppercase text-sm tracking-widest">{sig.name}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{sig.role}</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-0 right-0 text-center space-y-1 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-navy uppercase tracking-widest">ESTEADEB – Escola Teológica das Assembleias de Deus no Brasil</p>
            <p className="text-[9px] text-slate-400 font-bold">R. Dr. Célso Ramalho, 70 - Lagoa Seca, Natal - RN, 59022-330</p>
            <p className="text-[9px] text-slate-400 font-bold">Tel.: (84) 2030-4038 | E-mail: secretaria@esteadeb.org.br</p>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateRequerimentoMatricula = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const sig = getSignatureData('matricula');

    setPrintContent({
      title: 'Requerimento de Matrícula',
      html: (
        <div className="p-16 space-y-12 text-slate-800 font-serif max-w-4xl mx-auto bg-white relative min-h-[1100px]">
          <div className="relative flex items-center justify-center min-h-[120px] mb-8 w-full border-b pb-8 border-slate-200">
            <div className="absolute left-0 top-0">
              {systemConfig?.logoUrl ? (
                <img src={systemConfig.logoUrl} alt="Logo" className="h-28 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <GraduationCap size={48} className="text-navy" />
              )}
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-5xl font-black text-navy uppercase leading-none">{systemConfig?.schoolName || 'ESTEADEB'}</h1>
              <p className="text-sm font-bold uppercase tracking-[0.4em] text-slate-500 mt-2">Requerimento de Matrícula</p>
            </div>
          </div>
          
          <div className="text-justify leading-relaxed space-y-8 text-lg px-8">
            <p>
              À Direção da <strong>{systemConfig?.schoolName || 'ESTEADEB'}</strong>,
            </p>
            <p>
              Eu, <strong>{student.name.toUpperCase()}</strong>, portador(a) do CPF nº <strong>{student.cpf || '000.000.000-00'}</strong>, 
              residente e domiciliado(a) em <strong>{student.address || '_________________'}</strong>, 
              venho por meio deste requerer minha <strong>MATRÍCULA</strong> no curso de 
              <strong> {student.course?.toUpperCase() || 'TEOLOGIA'}</strong>, no semestre letivo corrente de <strong>{new Date().getFullYear()}</strong>.
            </p>
            <p>
              Assumo o compromisso de cumprir as normas estatutárias e regimentais desta instituição de ensino, 
              bem como de honrar com os compromissos financeiros assumidos no ato desta matrícula.
            </p>
            <p>
              Pede Deferimento.
            </p>
          </div>

          <div className="pt-24 text-center space-y-24">
            <p className="font-bold">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}.</p>
            
            <div className="grid grid-cols-2 gap-12">
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-slate-900 pt-4">
                  <p className="font-black uppercase text-sm">{student.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Assinatura do Requerente</p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-end">
                <div className="w-full border-t border-slate-900 pt-4 relative">
                  {sig.url && (
                    <img src={sig.url} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
                  )}
                  <p className="font-black uppercase text-sm tracking-widest">{sig.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{sig.role}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-0 right-0 text-center space-y-1 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-navy uppercase tracking-widest">{systemConfig?.schoolName || 'ESTEADEB'}</p>
            <p className="text-[9px] text-slate-400 font-bold">{systemConfig?.address || 'R. Dr. Célso Ramalho, 70 - Lagoa Seca, Natal - RN'}</p>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const generateDeclaracaoMatricula = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const sig = getSignatureData('matricula');

    setPrintContent({
      title: 'Declaração de Matrícula',
      html: (
        <div className="p-16 space-y-12 text-slate-800 font-serif max-w-4xl mx-auto bg-white relative min-h-[1100px]">
          <div className="relative flex items-center justify-center min-h-[120px] mb-8 w-full">
            <div className="absolute left-0 top-0">
              {systemConfig?.logoUrl ? (
                <img src={systemConfig.logoUrl} alt="Logo" className="h-28 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 bg-navy/5 flex items-center justify-center rounded-xl overflow-hidden shadow-inner">
                  <GraduationCap size={48} className="text-navy" />
                </div>
              )}
            </div>
            <div className="text-center space-y-1 w-full px-32">
              <h1 className="text-5xl font-black text-navy tracking-tighter uppercase leading-none">{systemConfig?.schoolName || 'ESTEADEB'}</h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-500">{systemConfig?.legalText || 'Escola Teológica das Assembleias de Deus no Brasil'}</p>
              <div className="pt-2 flex justify-center gap-4 text-[9px] font-bold text-slate-400 border-t border-slate-100 mt-2 mx-auto max-w-xs">
                <span>CNPJ: {systemConfig?.cnpj || '40.800.393/0001-32'}</span>
                <span>•</span>
                <span>NATAL - RN</span>
              </div>
            </div>
          </div>
          
          <div className="text-center py-12">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-navy inline-block pb-2">Declaração de Matrícula</h2>
          </div>

          <div className="text-justify leading-[2] space-y-8 text-lg px-8">
            <p>
              Declaramos para os devidos fins que o(a) aluno(a) <strong>{student.name.toUpperCase()}</strong>, 
              portador(a) do CPF nº <strong>{student.cpf || '000.000.000-00'}</strong>, encontra-se devidamente 
              <strong> MATRICULADO(A)</strong> e <strong>FREQUENTANDO</strong> regularmente o curso de 
              <strong> {student.course?.toUpperCase() || 'TEOLOGIA'}</strong> nesta instituição de ensino, 
              no ano letivo de <strong>{new Date().getFullYear()}</strong>.
            </p>
            <p>
              Por ser verdade, firmamos a presente declaração para que produza os efeitos necessários.
            </p>
          </div>

          <div className="pt-32 text-center space-y-8">
            <p className="font-bold">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}.</p>
            
            <div className="flex flex-col items-center">
              <div className="w-80 border-t-2 border-slate-900 pt-4 relative">
                {sig.url && (
                  <img src={sig.url} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
                )}
                <p className="font-black uppercase text-sm tracking-widest">{sig.name}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{sig.role}</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-0 right-0 text-center space-y-1 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-navy uppercase tracking-widest">ESTEADEB – Escola Teológica das Assembleias de Deus no Brasil</p>
            <p className="text-[9px] text-slate-400 font-bold">R. Dr. Célso Ramalho, 70 - Lagoa Seca, Natal - RN, 59022-330</p>
            <p className="text-[9px] text-slate-400 font-bold">Tel.: (84) 2030-4038 | E-mail: secretaria@esteadeb.org.br</p>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateDiarioClasse = async () => {
    const targetClass = classes.find(c => c.id === selectedClassId);
    if (!targetClass) return;

    // Fetch students
    const qStudents = query(
      collection(db, 'students'), 
      where('classId', '==', selectedClassId), 
      where('deleted', '==', false),
      where('status', 'in', ['Ativo', 'ativo', 'ATIVO', 'Matriculado', 'matriculado', 'MATRICULADO', 'Pendente', 'pendente', 'PENDENTE']),
      orderBy('name', 'asc')
    );
    const snapStudents = await getDocs(qStudents);
    const classStudents = snapStudents.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    // Generate dates (simplified: next 10 Saturdays)
    const dates = [];
    let current = new Date();
    while (dates.length < 10) {
      if (current.getDay() === 6) { // Saturday
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    setPrintContent({
      title: `Diário de Classe - ${targetClass.name}`,
      html: (
        <div className="p-8 space-y-6 text-slate-800 font-sans bg-white w-[1123px] mx-auto min-h-[794px]">
          <div className="relative flex items-center justify-center min-h-[80px] mb-6 w-full border-b-2 border-navy pb-4">
            <div className="absolute left-0 top-0">
              {systemConfig?.logoUrl ? (
                <img src={systemConfig.logoUrl} alt="Logo" className="h-16 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <GraduationCap size={40} className="text-navy" />
              )}
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-navy uppercase leading-none">Diário de Classe</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Turma: {targetClass.name} | Ano: {new Date().getFullYear()}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-[9px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-300 p-2 w-8">#</th>
                  <th className="border border-slate-300 p-2 text-left">Nome do Aluno</th>
                  {dates.map((d, i) => (
                    <th key={i} className="border border-slate-300 p-1 w-10 text-center rotate-90 h-20">
                      {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </th>
                  ))}
                  <th className="border border-slate-300 p-2 w-12 text-center">Faltas</th>
                  <th className="border border-slate-300 p-2 w-12 text-center">Média</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((s, i) => (
                  <tr key={i} className="h-8">
                    <td className="border border-slate-300 text-center font-bold">{i + 1}</td>
                    <td className="border border-slate-300 px-2 font-bold uppercase">{s.name}</td>
                    {dates.map((_, j) => (
                      <td key={j} className="border border-slate-300"></td>
                    ))}
                    <td className="border border-slate-300"></td>
                    <td className="border border-slate-300"></td>
                  </tr>
                ))}
                {/* Empty rows for manual entry */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-8">
                    <td className="border border-slate-300 text-center font-bold">{classStudents.length + i + 1}</td>
                    <td className="border border-slate-300 px-2"></td>
                    {dates.map((_, j) => (
                      <td key={j} className="border border-slate-300"></td>
                    ))}
                    <td className="border border-slate-300"></td>
                    <td className="border border-slate-300"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8">
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest">Conteúdo Ministrado:</p>
              <div className="grid grid-rows-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border-b border-slate-200 h-6"></div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-end space-y-12">
               <div className="w-64 border-t border-slate-900 pt-2 text-center relative">
                  {systemConfig?.directorSignatureUrl && (
                    <img src={systemConfig.directorSignatureUrl} alt="Assinatura" className="absolute -top-12 left-1/2 -translate-x-1/2 h-16 object-contain mix-blend-multiply" />
                  )}
                  <p className="text-[9px] font-black uppercase tracking-widest">{systemConfig?.directorName || 'Sérgio Lins Pessoa'}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Visto da Direção</p>
               </div>
               <div className="w-64 border-t border-slate-900 pt-2 text-center mt-8">
                <p className="text-[10px] font-black uppercase tracking-widest">Assinatura do Professor</p>
              </div>
            </div>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateConclusao = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const sig = getSignatureData('conclusao');

    setPrintContent({
      title: 'Declaração de Conclusão',
      html: (
        <div className="p-16 space-y-12 text-slate-800 font-serif max-w-4xl mx-auto bg-white relative min-h-[1100px]">
          <div className="relative flex items-center justify-center min-h-[120px] mb-8 w-full">
            <div className="absolute left-0 top-0">
              {systemConfig?.logoUrl ? (
                <img src={systemConfig.logoUrl} alt="Logo" className="h-28 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 bg-navy/5 flex items-center justify-center rounded-xl overflow-hidden shadow-inner">
                  <GraduationCap size={48} className="text-navy" />
                </div>
              )}
            </div>
            <div className="text-center space-y-1 w-full px-32">
              <h1 className="text-5xl font-black text-navy tracking-tighter uppercase leading-none">{systemConfig?.schoolName || 'ESTEADEB'}</h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-500">{systemConfig?.legalText || 'Escola Teológica das Assembleias de Deus no Brasil'}</p>
              <div className="pt-2 flex justify-center gap-4 text-[9px] font-bold text-slate-400 border-t border-slate-100 mt-2 mx-auto max-w-xs">
                <span>CNPJ: {systemConfig?.cnpj || '40.800.393/0001-32'}</span>
                <span>•</span>
                <span>NATAL - RN</span>
              </div>
            </div>
          </div>
          
          <div className="text-center py-12">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-navy inline-block pb-2">Declaração de Conclusão</h2>
          </div>

          <div className="text-justify leading-[2] space-y-8 text-lg px-8">
            <p>
              Declaramos, para os devidos fins, que <strong>{student.name.toUpperCase()}</strong>, 
              brasileiro(a), natural da cidade de <strong>{student.birthCity?.toUpperCase() || 'NATAL'}</strong>, 
              Estado <strong>{student.birthState?.toUpperCase() || 'RN'}</strong>, 
              nascido(a) em data de <strong>{student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR') : '___/___/______'}</strong>, 
              inscrito(a) no CPF nº <strong>{student.cpf || '000.000.000-00'}</strong>, 
              concluiu o curso de <strong>{student.course?.toUpperCase() || 'TEOLOGIA'}</strong> 
              no ano de <strong>{student.completionYear || new Date().getFullYear()}</strong> nesta instituição de ensino.
            </p>
            <p>
              Por ser verdade, firmamos a presente declaração para que produza os efeitos necessários.
            </p>
          </div>

          <div className="pt-32 text-center space-y-8">
            <p className="font-bold">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}.</p>
            
            <div className="flex flex-col items-center">
              <div className="w-80 border-t-2 border-slate-900 pt-4 relative">
                {sig.url && (
                  <img src={sig.url} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
                )}
                <p className="font-black uppercase text-sm tracking-widest">{sig.name}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{sig.role}</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-0 right-0 text-center space-y-1 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-navy uppercase tracking-widest">ESTEADEB – Escola Teológica das Assembleias de Deus no Brasil</p>
            <p className="text-[9px] text-slate-400 font-bold">R. Dr. Célso Ramalho, 70 - Lagoa Seca, Natal - RN, 59022-330</p>
            <p className="text-[9px] text-slate-400 font-bold">Tel.: (84) 2030-4038 | E-mail: secretaria@esteadeb.org.br</p>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateHistorico = async () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const sig = getSignatureData('historico');

    // Fetch grades for this student
    const q = query(collection(db, 'grades'), where('studentId', '==', selectedStudentId));
    const snapshot = await getDocs(q);
    const studentGrades = snapshot.docs.map(doc => doc.data() as Grade);

    setPrintContent({
      title: 'Histórico Escolar',
      html: (
        <div className="p-8 space-y-8 text-slate-800 font-sans max-w-5xl mx-auto bg-white print:p-0">
          <div className="relative flex items-center justify-center min-h-[120px] mb-8 w-full border-b-4 border-navy pb-6">
            <div className="absolute left-0 top-0">
              {systemConfig?.logoUrl ? (
                <img src={systemConfig.logoUrl} alt="Logo" className="h-28 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 bg-navy/5 flex items-center justify-center rounded-xl overflow-hidden shadow-inner">
                  <GraduationCap size={48} className="text-navy" />
                </div>
              )}
            </div>
            <div className="text-center space-y-1 w-full px-32">
              <h1 className="text-4xl font-black text-navy uppercase leading-none">{systemConfig?.schoolName || 'ESTEADEB'}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{systemConfig?.address || 'Rua Doutor Celso Ramalho, 70 - Lagoa Seca | Fone: 3223-1203'}</p>
              <div className="pt-2 flex justify-center gap-4 text-[9px] font-bold text-slate-400 border-t border-slate-100 mt-2 mx-auto max-w-xs">
                <span>CNPJ: {systemConfig?.cnpj || '40.800.393/0001-32'}</span>
                <span>•</span>
                <span>HISTÓRICO ESCOLAR</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-8 gap-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-[11px]">
            <div className="col-span-2 border-b border-slate-200 pb-1">
              <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Aluno</p>
              <p className="font-bold text-navy uppercase">{student.name}</p>
            </div>
            <div className="border-b border-slate-200 pb-1">
              <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Data de Nascimento</p>
              <p className="font-bold text-navy">{student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR') : '---'}</p>
            </div>
            <div className="border-b border-slate-200 pb-1">
              <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Cidade</p>
              <p className="font-bold text-navy uppercase">{student.birthCity || '---'}</p>
            </div>
            <div className="border-b border-slate-200 pb-1">
              <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Estado</p>
              <p className="font-bold text-navy uppercase">{student.birthState || '---'}</p>
            </div>
            <div className="border-b border-slate-200 pb-1">
              <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">CPF</p>
              <p className="font-bold text-navy">{student.cpf || '---'}</p>
            </div>
            <div className="col-span-2 border-b border-slate-200 pb-1">
              <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Filiação</p>
              <p className="font-bold text-navy uppercase">{student.filiation || '---'}</p>
            </div>
            <div className="border-b border-slate-200 pb-1">
              <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Identidade (RG)</p>
              <p className="font-bold text-navy">{student.rg || '---'}</p>
            </div>
            <div className="col-span-3 border-b border-slate-200 pb-1">
              <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Curso</p>
              <p className="font-bold text-navy uppercase">{student.course || 'TEOLOGIA'}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="h-10">
                  <TableHead className="border-r border-slate-200 text-center font-black text-[9px] uppercase w-16">Período</TableHead>
                  <TableHead className="border-r border-slate-200 text-center font-black text-[9px] uppercase w-16">Módulo</TableHead>
                  <TableHead className="border-r border-slate-200 font-black text-[9px] uppercase">Disciplinas</TableHead>
                  <TableHead className="border-r border-slate-200 text-center font-black text-[9px] uppercase w-16">C/H</TableHead>
                  <TableHead className="border-r border-slate-200 text-center font-black text-[9px] uppercase w-16">Média Final</TableHead>
                  <TableHead className="text-center font-black text-[9px] uppercase w-20">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentGrades.length > 0 ? studentGrades.map((g, i) => (
                  <TableRow key={i} className="h-8 text-[10px] border-b border-slate-100">
                    <TableCell className="border-r border-slate-200 text-center font-bold">---</TableCell>
                    <TableCell className="border-r border-slate-200 text-center font-bold">---</TableCell>
                    <TableCell className="border-r border-slate-200 font-bold uppercase">{g.moduleName}</TableCell>
                    <TableCell className="border-r border-slate-200 text-center font-bold">30</TableCell>
                    <TableCell className="border-r border-slate-200 text-center font-bold">{g.grade.toFixed(1)}</TableCell>
                    <TableCell className="text-center font-bold">{g.grade >= 7 ? 'AP' : 'RP'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow className="h-20">
                    <TableCell colSpan={6} className="text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Nenhum registro acadêmico encontrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[9px]">
            <div className="space-y-2">
              <p className="font-black uppercase tracking-widest text-navy border-b border-slate-100 pb-1">Legenda – Situação Acadêmica</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-bold text-slate-500">
                <p>AP – Aprovado</p>
                <p>RF – Reprovado por Falta</p>
                <p>RP – Reprovado</p>
                <p>AD – Aproveitamento de Disciplina</p>
                <p>CS – Cursando</p>
                <p>PD – Pendente</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-black uppercase tracking-widest text-navy border-b border-slate-100 pb-1">Resumo Acadêmico</p>
              <div className="space-y-1 font-bold text-slate-700">
                <div className="flex justify-between"><span>Carga Horária Mínima:</span> <span>1.800 h/a</span></div>
                <div className="flex justify-between"><span>Carga Horária Cumprida:</span> <span>{studentGrades.length * 30} h/a</span></div>
                <div className="flex justify-between"><span>Situação Final:</span> <span className="text-petrol uppercase">{student.status}</span></div>
              </div>
            </div>
          </div>

          <div className="pt-12 flex justify-between items-end">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações:</p>
              <div className="w-96 h-12 border-b border-slate-200"></div>
            </div>
            <div className="text-right space-y-8">
              <p className="font-bold text-xs">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
              <div className="flex flex-col items-center">
                <div className="w-64 border-t border-slate-900 pt-2 text-center relative">
                  {sig.url && (
                    <img src={sig.url} alt="Assinatura" className="absolute -top-12 left-1/2 -translate-x-1/2 h-16 object-contain mix-blend-multiply" />
                  )}
                  <p className="font-black uppercase text-[10px]">{sig.name}</p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{sig.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateCertificado = async () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    // Academic Integrity Check
    try {
      const qGrades = query(collection(db, 'grades'), where('course', '==', student.course || 'TEOLOGIA'));
      const snapGrades = await getDocs(qGrades);
      const totalRequired = snapGrades.size > 0 ? snapGrades.size : 20; // Default fallback

      const qRecords = query(collection(db, 'academic_records'), where('studentId', '==', student.id));
      const snapRecords = await getDocs(qRecords);
      const completedCount = snapRecords.docs.filter(d => d.data().status === 'Aprovado' || d.data().status === 'Dispensada' || (d.data().nota >= 7)).length;

      if (completedCount < totalRequired && student.status !== 'Concluído') {
        alert(`ALERTA DE INTEGRIDADE: O aluno possui apenas ${completedCount}/${totalRequired} disciplinas concluídas. O certificado só pode ser emitido após a conclusão integral da matriz.`);
        return;
      }
    } catch (err) {
      console.error("Integrity check failed:", err);
    }

    const sig = getSignatureData('certificado');

    setPrintContent({
      title: 'Certificado de Conclusão',
      html: (
        <div className="p-0 text-slate-800 font-sans max-w-[1123px] mx-auto bg-white relative overflow-hidden min-h-[794px] flex flex-col items-center justify-center print:w-[1123px] print:h-[794px]">
          {/* Main Border System */}
          <div className="absolute inset-4 border-[3px] border-navy z-10"></div>
          <div className="absolute inset-6 border border-amber-400 z-10"></div>
          
          {/* Vertical "CERTIFICADO" Text */}
          <div className="absolute left-8 top-1/2 -translate-y-1/2 -rotate-90 origin-center z-20">
            <span className="text-7xl font-black tracking-[0.2em] text-white stroke-navy stroke-2" style={{ WebkitTextStroke: '2px #001F3F', color: 'transparent' }}>CERTIFICADO</span>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 rotate-90 origin-center z-20">
            <span className="text-7xl font-black tracking-[0.2em] text-white stroke-navy stroke-2" style={{ WebkitTextStroke: '2px #001F3F', color: 'transparent' }}>CERTIFICADO</span>
          </div>

          {/* Decorative Gold Waves */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-200/40 via-amber-500/20 to-transparent rounded-bl-full z-0"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-amber-200/40 via-amber-500/20 to-transparent rounded-tr-full z-0"></div>
          
          {/* Content Container */}
          <div className="relative z-30 flex flex-col items-center text-center w-full px-32 space-y-8">
            {/* Header with Logo in the Corner */}
            <div className="relative w-full flex items-start justify-center min-h-[100px]">
              <div className="absolute left-0 top-0">
                {systemConfig?.logoUrl ? (
                  <img src={systemConfig.logoUrl} alt="Logo" className="h-32 w-auto object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <GraduationCap size={80} className="text-navy" />
                )}
              </div>
              <div className="text-center">
                <h1 className="text-6xl font-black text-navy tracking-tighter uppercase leading-none select-none">{systemConfig?.schoolName || 'ESTEADEB'}</h1>
                <p className="text-sm font-bold uppercase tracking-[0.4em] text-slate-800 mt-2">Escola Teológica das</p>
                <p className="text-sm font-bold uppercase tracking-[0.4em] text-slate-800">Assembleias de Deus no Brasil</p>
              </div>
            </div>

            {/* Main Statement */}
            <div className="space-y-6 max-w-4xl">
              <p className="text-sm font-medium leading-relaxed text-slate-700">
                O Diretor da Escola Teológica das Assembleias de Deus no Brasil – ESTEADEB, no uso de suas atribuições,<br />
                tendo em vista a conclusão em <strong>{student.completionYear || new Date().getFullYear()}</strong> do <em>Curso Livre em Teologia</em> no respectivo grau de
              </p>
              
              <h2 className="text-2xl font-black text-navy uppercase tracking-widest py-2">
                {student.course?.toUpperCase() || 'BACHAREL LIVRE EM TEOLOGIA'}
              </h2>

              <h3 className="text-5xl font-serif font-black text-navy py-4 tracking-tight">
                {student.name}
              </h3>

              <p className="text-sm font-medium leading-relaxed text-slate-700">
                Brasileiro(a), natural da cidade de <strong>{student.birthCity || 'Touros'}</strong>, Estado do <strong>{student.birthState || 'Rio Grande do Norte'}</strong>, nascido em<br />
                <strong>{student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '17 de abril de 1992'}</strong>, cédula de identidade nº <strong>{student.rg || '2.274.537 SSP/RN'}</strong> e CPF nº <strong>{student.cpf || '105.524.714-96'}</strong>.
              </p>

              <p className="text-sm font-medium text-slate-700 pt-4">
                Outorga-lhe o presente Certificado a fim de que possa gozar de todos os direitos e prerrogativas legais.
              </p>
            </div>

            {/* Date and Signatures */}
            <div className="w-full space-y-12 pt-8">
              <p className="text-sm font-bold text-slate-800">
                Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>

              <div className="grid grid-cols-3 gap-8 items-end">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-full border-t border-slate-900 pt-2 relative">
                    {systemConfig?.pedagogicalSignatureUrl && (
                      <img src={systemConfig.pedagogicalSignatureUrl} alt="Assinatura" className="absolute -top-12 left-1/2 -translate-x-1/2 h-16 object-contain mix-blend-multiply" />
                    )}
                    <p className="font-bold text-[10px] uppercase">Arlete Duarte de Almeida Costa</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">Coordenadora Pedagógica</p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-full border-t border-slate-900 pt-2">
                    <p className="font-bold text-[10px] uppercase">Diplomado</p>
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-2">
                  <div className="w-full border-t border-slate-900 pt-2 relative">
                    {systemConfig?.directorSignatureUrl && (
                      <img src={systemConfig.directorSignatureUrl} alt="Assinatura" className="absolute -top-12 left-1/2 -translate-x-1/2 h-16 object-contain mix-blend-multiply" />
                    )}
                    <p className="font-bold text-[10px] uppercase">Sérgio Lins Pessoa, MSc.</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">Diretor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 1ª via Box */}
          <div className="absolute bottom-10 left-10 border-2 border-slate-900 px-4 py-1 z-40">
            <span className="text-xs font-black uppercase tracking-widest">1ª via</span>
          </div>

          {/* Decorative Gold Elements */}
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl"></div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateContrato = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const sig = getSignatureData('contrato');

    setPrintContent({
      title: 'Contrato de Prestação de Serviços',
      html: (
        <div className="p-16 space-y-8 text-slate-800 font-serif max-w-4xl mx-auto bg-white relative min-h-[1100px] text-sm">
          <div className="text-center font-black text-xl uppercase tracking-widest border-b-2 border-navy pb-4">
            Contrato de Prestação de Serviços Educacionais
          </div>
          
          <div className="text-justify leading-relaxed space-y-6">
            <p>
              Pelo presente instrumento particular, de um lado, a <strong>{systemConfig?.schoolName || 'ESTEADEB'}</strong>, 
              inscrita no CNPJ sob o nº <strong>{systemConfig?.cnpj || '40.800.393/0001-32'}</strong>, doravante denominada CONTRATADA;
            </p>

            <p>
              E, de outro lado, o(a) aluno(a) <strong>{student.name.toUpperCase()}</strong>, 
              inscrito(a) no CPF nº <strong>{student.cpf || '***.***.***-**'}</strong>, doravante denominado(a) CONTRATANTE;
            </p>

            <p className="font-bold border-l-4 border-navy pl-4 bg-slate-50 p-2">CLÁUSULA 1 – DO OBJETO</p>
            <p>1.1. O presente contrato tem como objeto a prestação de serviços educacionais do Curso de Teologia ao aluno, conforme a grade curricular e o calendário acadêmico da instituição.</p>

            <p className="font-bold border-l-4 border-navy pl-4 bg-slate-50 p-2">CLÁUSULA 2 – DO VALOR E FORMA DE PAGAMENTO</p>
            <p>2.1. O CONTRATANTE pagará à CONTRATADA o valor mensal estabelecido no ato da matrícula, com vencimento até o dia pactuado.</p>
            <p>2.2. O não pagamento no prazo implicará multa de 2% sobre o valor da parcela, além de juros moratórios de 1% ao mês.</p>

            <p className="font-bold border-l-4 border-navy pl-4 bg-slate-50 p-2">CLÁUSULA 3 – DA NATUREZA DO CURSO</p>
            <p>3.1. O curso ofertado pela CONTRATADA é classificado como Curso Livre de Teologia, focado em formação eclesiástica.</p>
          </div>

          <div className="pt-24 text-center space-y-12">
            <p className="font-bold italic">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}.</p>
            
            <div className="grid grid-cols-2 gap-12 pt-8">
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-slate-900 pt-2">
                  <p className="font-black uppercase text-[10px]">{student.name}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Contratante</p>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full border-t border-slate-900 pt-2 relative">
                  {sig.url && (
                    <img src={sig.url} alt="Assinatura" className="absolute -top-12 left-1/2 -translate-x-1/2 h-16 object-contain mix-blend-multiply" />
                  )}
                  <p className="font-black uppercase text-[10px] tracking-widest">{sig.name || 'DIRETORIA'}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Contratada</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateRequerimentoDesconto = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const sig = getSignatureData('desconto');

    setPrintContent({
      title: 'Requerimento de Desconto',
      html: (
        <div className="p-16 space-y-12 text-slate-800 font-serif max-w-4xl mx-auto bg-white relative min-h-[1100px]">
          <div className="relative flex items-center justify-center min-h-[120px] mb-8 w-full border-b pb-8">
             <div className="text-center space-y-2">
                <h1 className="text-3xl font-black text-navy uppercase">{systemConfig?.schoolName || 'ESTEADEB'}</h1>
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Requerimento de Desconto Institucional</p>
             </div>
          </div>
          
          <div className="text-justify leading-relaxed space-y-8 text-lg">
            <p>
              Eu, <strong>{student.name.toUpperCase()}</strong>, aluno(a) matriculado(a) nesta instituição, 
              venho por meio deste requerer a concessão de desconto em minhas parcelas educacionais.
            </p>

            <div className="bg-slate-50 p-8 rounded-3xl border-2 border-slate-100 space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Dados do Benefício</h3>
              <div className="grid grid-cols-1 gap-2">
                <p className="font-bold">Modalidade: <span className="text-navy">{student.course || 'TEOLOGIA'}</span></p>
                <p className="font-bold">Desconto Solicitado: <span className="text-navy">BOLSA INSTITUCIONAL</span></p>
              </div>
            </div>

            <p className="text-sm italic">
              Declaro estar ciente de que a manutenção do desconto está condicionada ao pagamento rigorosamente em dia, 
              e que o atraso implicará na perda automática do benefício no mês correspondente.
            </p>
          </div>

          <div className="pt-32 text-center space-y-24">
            <div className="flex flex-col items-center">
              <div className="w-80 border-t-2 border-slate-900 pt-4">
                <p className="font-black uppercase text-sm">{student.name}</p>
                <p className="text-xs text-slate-400 font-bold uppercase">Assinatura do Aluno</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-12">
               <div className="text-left border-2 border-slate-100 p-6 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-4">Parecer Administrativo</p>
                  <p className="font-bold text-sm">(&nbsp;&nbsp;) DEFERIDO</p>
                  <p className="font-bold text-sm mt-2">(&nbsp;&nbsp;) INDEFERIDO</p>
               </div>
               <div className="flex flex-col items-center justify-end">
                <div className="w-full border-t-2 border-slate-900 pt-4 relative">
                  {sig.url && (
                    <img src={sig.url} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
                  )}
                  <p className="font-black uppercase text-xs tracking-widest">{sig.name || 'DIRETORIA'}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Responsável</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateAutorizacaoTcc = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const sig = getSignatureData('tcc');

    setPrintContent({
      title: 'Autorização para Orientação de TCC',
      html: (
        <div className="p-16 space-y-12 text-slate-800 font-serif max-w-4xl mx-auto bg-white relative min-h-[1100px]">
          <div className="relative flex items-center justify-center min-h-[120px] mb-8 w-full">
            <div className="absolute left-0 top-0">
              {systemConfig?.logoUrl ? (
                <img src={systemConfig.logoUrl} alt="Logo" className="h-28 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 bg-navy/5 flex items-center justify-center rounded-xl overflow-hidden shadow-inner">
                  <GraduationCap size={48} className="text-navy" />
                </div>
              )}
            </div>
            <div className="text-center space-y-1 w-full px-32">
              <h1 className="text-5xl font-black text-navy tracking-tighter uppercase leading-none">{systemConfig?.schoolName || 'ESTEADEB'}</h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-500">{systemConfig?.legalText || 'Escola Teológica das Assembleias de Deus no Brasil'}</p>
              <div className="pt-2 flex justify-center gap-4 text-[9px] font-bold text-slate-400 border-t border-slate-100 mt-2 mx-auto max-w-xs">
                <span>CNPJ: {systemConfig?.cnpj || '40.800.393/0001-32'}</span>
                <span>•</span>
                <span>NATAL - RN</span>
              </div>
            </div>
          </div>
          
          <div className="text-center py-12">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-navy inline-block pb-2">Declaração de Autorização para Orientação Acadêmica</h2>
          </div>

          <div className="text-justify leading-[2] space-y-8 text-lg px-8">
            <p className="font-bold">À Coordenação Acadêmica e ao Corpo Docente,</p>
            <p>
              Declaramos, para os devidos fins de acompanhamento do Trabalho de Conclusão de Curso (TCC), que o(a) aluno(a) abaixo identificado(a) encontra-se com vínculo acadêmico ativo e devidamente habilitado para o desenvolvimento de suas atividades de pesquisa e escrita junto a esta instituição.
            </p>
            
            <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 font-sans space-y-3 my-8">
              <div className="flex">
                <span className="font-black uppercase text-xs tracking-widest text-slate-400 w-48">Nome do Aluno:</span>
                <span className="font-bold uppercase text-navy">{student.name}</span>
              </div>
              <div className="flex">
                <span className="font-black uppercase text-xs tracking-widest text-slate-400 w-48">Status de Matrícula:</span>
                <span className="font-bold text-petrol">REGULAR <span className="text-slate-400 font-medium">(TCC Pendente)</span></span>
              </div>
              <div className="flex">
                <span className="font-black uppercase text-xs tracking-widest text-slate-400 w-48">Finalidade:</span>
                <span className="font-bold uppercase text-navy">Solicitação de Orientação e Suporte Pedagógico</span>
              </div>
            </div>

            <p>
              Desta forma, o referido discente está <strong>AUTORIZADO</strong> a buscar orientações, submeter correções e solicitar o suporte necessário junto aos professores responsáveis, seguindo o cronograma e as normas estabelecidas para a conclusão do núcleo acadêmico.
            </p>
            <p>
              Esta autorização valida o acesso do aluno ao corpo docente para fins exclusivamente pedagógicos até a entrega da versão final e avaliação do trabalho.
            </p>
          </div>

          <div className="pt-32 text-center space-y-8">
            <p className="font-bold">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}.</p>
            
            <div className="flex flex-col items-center">
              <div className="w-80 border-t-2 border-slate-900 pt-4 relative">
                {sig.url && (
                  <img src={sig.url} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
                )}
                <p className="font-black uppercase text-sm tracking-widest">{sig.name}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{sig.role}</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-0 right-0 text-center space-y-1 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-navy uppercase tracking-widest">ESTEADEB – Escola Teológica das Assembleias de Deus no Brasil</p>
            <p className="text-[9px] text-slate-400 font-bold">R. Dr. Célso Ramalho, 70 - Lagoa Seca, Natal - RN, 59022-330</p>
            <p className="text-[9px] text-slate-400 font-bold">Tel.: (84) 2030-4038 | E-mail: secretaria@esteadeb.org.br</p>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateIR = async () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const q = query(
      collection(db, 'financial_installments'),
      where('studentId', '==', selectedStudentId),
      where('status', '==', 'Pago')
    );
    const snapshot = await getDocs(q);
    const paidInstallments = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(data => data.dueDate.startsWith(selectedYear) && data.paymentMethod !== 'Permuta de Serviço')
      .sort((a, b) => new Date(a.paymentDate || a.dueDate).getTime() - new Date(b.paymentDate || b.dueDate).getTime());

    const totalPaid = paidInstallments.reduce((acc, curr) => acc + (curr.finalPaidValue || curr.baseValue || 0), 0);
    const studentName = student.name;
    const studentCpf = student.cpf || 'Não Informado';

    setPrintContent({
      title: 'Declaração para fins de Imposto de Renda',
      html: (
        <div className="p-12 text-slate-800 font-sans max-w-4xl mx-auto bg-white whitespace-pre-wrap">
          <div className="flex justify-between items-end border-b-4 border-navy pb-4 mb-8">
            <div className="flex items-center gap-4">
              {systemConfig?.logoUrl ? (
                <img src={systemConfig.logoUrl} alt="Logo" className="h-16 object-contain" />
              ) : (
                <div className="w-16 h-16 rounded-xl flex items-center justify-center border-2 border-navy text-navy font-black text-xs">
                  ESTD
                </div>
              )}
              <div>
                <p className="text-[12px] font-black text-navy uppercase tracking-widest">ESTEADEB – Escola Teológica da Assembleia de Deus no RN</p>
                <p className="text-[10px] text-slate-500 font-bold">R. Dr. Célso Ramalho, 70 - Lagoa Seca, Natal - RN</p>
                <p className="text-[10px] text-slate-500 font-bold">CNPJ: 40.800.393/0001-32 | (84) 2030-4038</p>
              </div>
            </div>
          </div>

          <h1 className="text-xl font-bold text-center mb-8 uppercase">Declaração para fins de Imposto de Renda</h1>
          
          <p className="text-justify leading-relaxed mb-8 text-sm">
            Declaramos, para fins de comprovação junto à Receita Federal do Brasil, que o Sr(a). <span className="font-bold">{studentName}</span>, 
            inscrito(a) no CPF nº <span className="font-bold">{studentCpf}</span>, efetuou pagamentos referentes a mensalidades 
            educacionais à <span className="font-bold">ESTEADEB – Escola Teológica da Assembleia de Deus no Estado do Rio Grande do Norte</span>, 
            inscrita no CNPJ nº 40.800.393/0001-32, no ano-calendário de <span className="font-bold">{selectedYear}</span>, conforme discriminação abaixo:
          </p>

          <table className="w-full text-sm mb-8 border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="font-bold text-left py-2">Data Pgto.</th>
                <th className="font-bold text-left py-2">Nº da Parcela</th>
                <th className="font-bold text-left py-2">Referência</th>
                <th className="font-bold text-right py-2">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {paidInstallments.map((inst, index) => {
                const dateParts = inst.paymentDate ? inst.paymentDate.split('-') : inst.dueDate.split('-');
                const monthName = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1).toLocaleString('pt-BR', { month: 'long' });
                const docId = inst.id.substring(0, 4).toUpperCase();
                
                return (
                  <tr key={index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-2">{inst.paymentDate ? new Date(inst.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR') : new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="py-2">{docId}</td>
                    <td className="py-2 capitalize">{`${monthName}/${dateParts[0]}`}</td>
                    <td className="py-2 text-right">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inst.finalPaidValue || inst.baseValue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="text-right font-bold mt-8">
            Valor total pago no ano-calendário de {selectedYear}: <span className="text-lg">{formatCurrency(totalPaid)}</span>
          </div>

          <div className="pt-24 mt-8 flex flex-col items-center justify-center">
            <div className="w-80 border-t border-black pt-4 relative text-center">
              {systemConfig?.directorSignatureUrl && (
                <img src={systemConfig.directorSignatureUrl} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
              )}
              <p className="font-black uppercase text-[12px]">{systemConfig?.directorName || 'Sérgio Lins Pessoa'}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Diretor / Representante Legal</p>
            </div>
            <p className="text-xs uppercase text-slate-400 font-bold tracking-widest mt-8">
              Natal/RN, {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateMonthlyRevenue = async () => {
    const q = query(
      collection(db, 'financial_installments'),
      orderBy('dueDate', 'asc')
    );
    const snapshot = await getDocs(q);
    const allInstallments = snapshot.docs
      .map(doc => doc.data())
      .filter(data => data.dueDate.startsWith(selectedYear));

    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const monthlyStats = months.map((monthName, index) => {
      const monthPrefix = `${selectedYear}-${(index + 1).toString().padStart(2, '0')}`;
      const monthInstallments = allInstallments.filter(inst => inst.dueDate.startsWith(monthPrefix));
      
      const paid = monthInstallments
        .filter(inst => inst.status === 'Pago' && inst.paymentMethod !== 'Permuta de Serviço')
        .reduce((acc, curr) => acc + (curr.finalPaidValue || (curr.baseValue - curr.discount)), 0);
      
      const pending = monthInstallments
        .filter(inst => inst.status !== 'Pago')
        .reduce((acc, curr) => acc + (curr.baseValue - curr.discount), 0);

      return {
        name: monthName,
        paid,
        pending,
        total: paid + pending
      };
    });

    const totalPaidYear = monthlyStats.reduce((acc, curr) => acc + curr.paid, 0);
    const totalPendingYear = monthlyStats.reduce((acc, curr) => acc + curr.pending, 0);

    setPrintContent({
      title: 'Relatório Financeiro Mensal',
      html: (
        <div className="p-12 space-y-8 text-slate-800 font-sans max-w-5xl mx-auto bg-white">
          <div className="flex justify-between items-center border-b-4 border-navy pb-6">
            <div className="flex items-center gap-4">
              {systemConfig?.logoUrl && <img src={systemConfig.logoUrl} alt="Logo" className="h-16 w-auto" referrerPolicy="no-referrer" />}
              <div>
                <h1 className="text-3xl font-black text-navy uppercase leading-tight">Receita Mensal</h1>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ano Base: {selectedYear}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase text-slate-400">Total Arrecadado no Ano</p>
              <p className="text-4xl font-black text-emerald-600">{formatCurrency(totalPaidYear)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
              <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Total Recebido (Ano)</p>
              <p className="text-2xl font-black text-navy">{formatCurrency(totalPaidYear)}</p>
            </div>
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
              <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-1">Total em Aberto (Ano)</p>
              <p className="text-2xl font-black text-navy">{formatCurrency(totalPendingYear)}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-xs p-6">Mês</TableHead>
                  <TableHead className="font-black uppercase text-xs text-right p-6">Recebido</TableHead>
                  <TableHead className="font-black uppercase text-xs text-right p-6">Em Aberto</TableHead>
                  <TableHead className="font-black uppercase text-xs text-right p-6">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyStats.map((stat, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-bold text-navy p-6">{stat.name}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 p-6">{formatCurrency(stat.paid)}</TableCell>
                    <TableCell className="text-right font-bold text-amber-600 p-6">{formatCurrency(stat.pending)}</TableCell>
                    <TableCell className="text-right font-black text-navy p-6">{formatCurrency(stat.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="pt-24 flex justify-center items-end">
             <div className="text-center space-y-8">
                <p className="font-bold text-xs">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
                <div className="flex flex-col items-center">
                  <div className="w-80 border-t-2 border-slate-900 pt-4 relative">
                    {systemConfig?.directorSignatureUrl && (
                      <img src={systemConfig.directorSignatureUrl} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
                    )}
                    <p className="font-black uppercase text-sm tracking-widest">{systemConfig?.directorName || 'Sérgio Lins Pessoa'}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Diretor</p>
                  </div>
                </div>
             </div>
          </div>

          <div className="pt-12 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <p>{systemConfig?.schoolName || 'ESTEADEB'} - Relatório Gerencial Gerado em {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  const generateListaAssinatura = async () => {
    const targetClass = classes.find(c => c.id === selectedClassId);
    if (!targetClass) return;

    const q = query(
      collection(db, 'students'), 
      where('classId', '==', selectedClassId), 
      where('deleted', '==', false),
      where('status', 'in', ['Ativo', 'ativo', 'ATIVO', 'Matriculado', 'matriculado', 'MATRICULADO', 'Pendente', 'pendente', 'PENDENTE']),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    const classStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    setPrintContent({
      title: `Lista de Presença - ${targetClass.name}`,
      html: (
        <div className="p-8 space-y-8 text-slate-800 font-sans bg-white">
          <div className="flex justify-between items-end border-b-4 border-navy pb-4">
            <div>
              <h1 className="text-2xl font-black text-navy uppercase">Lista de Assinatura</h1>
              <p className="text-sm font-bold text-petrol uppercase tracking-widest">Turma: {targetClass.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase">Data: ____/____/_______</p>
            </div>
          </div>

          <Table className="border-collapse border border-slate-200">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-12 border border-slate-200 text-center font-bold text-[10px] uppercase">#</TableHead>
                <TableHead className="w-24 border border-slate-200 text-center font-bold text-[10px] uppercase">Matrícula</TableHead>
                <TableHead className="border border-slate-200 font-bold text-[10px] uppercase">Nome do Aluno</TableHead>
                <TableHead className="w-64 border border-slate-200 font-bold text-[10px] uppercase">Assinatura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classStudents.map((s, i) => (
                <TableRow key={i} className="h-10">
                  <TableCell className="border border-slate-200 text-center font-bold text-[10px]">{i + 1}</TableCell>
                  <TableCell className="border border-slate-200 text-center font-bold text-[10px] uppercase">{s.matricula || s.id.slice(-6)}</TableCell>
                  <TableCell className="border border-slate-200 font-bold text-[10px] uppercase">{s.name}</TableCell>
                  <TableCell className="border border-slate-200"></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="pt-24 flex justify-between items-end">
            <div className="space-y-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página 1 de 1 • ESTEADEB</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-80 border-t border-black pt-4 relative text-center">
                {systemConfig?.directorSignatureUrl && (
                  <img src={systemConfig.directorSignatureUrl} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain mix-blend-multiply" />
                )}
                <p className="font-black uppercase text-[10px]">{systemConfig?.directorName || 'Sérgio Lins Pessoa'}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Visto da Direção</p>
              </div>
            </div>
          </div>
        </div>
      )
    });
    setIsPrintModalOpen(true);
  };

  return (
    <div className="p-8 space-y-12 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      {/* Print Modal Overlay */}
      {isPrintModalOpen && (
        <div id="print-modal-container" className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex flex-col items-center p-4 md:p-8 print:p-0 print:bg-white print:backdrop-blur-none print:static print-overlay-container">
          <div className="w-full max-w-5xl flex justify-between items-center mb-6 print:hidden">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 bg-petrol rounded-xl">
                <Printer size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">{printContent?.title}</h2>
            </div>
            <div className="flex gap-3">
              <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 px-6">
                <Printer size={16} /> Imprimir / PDF
              </Button>
              <Button onClick={() => setIsPrintModalOpen(false)} variant="ghost" className="text-white hover:bg-white/10 rounded-full p-2">
                <X size={24} />
              </Button>
            </div>
          </div>
          
          <div className="w-full max-w-5xl bg-white shadow-2xl rounded-[2rem] overflow-hidden print:shadow-none print:rounded-none flex flex-col max-h-[90vh] print:max-h-none print:h-auto">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar print:overflow-visible print:p-0">
              <div className="scale-[0.9] lg:scale-100 origin-top transform-gpu print:scale-100 print:transform-none">
                {printContent?.html}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="print:hidden">
        <div className="mb-12">
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Central de Relatórios</h1>
          <p className="text-slate-500 font-medium mt-1">Geração de documentos oficiais, financeiros e gerenciais.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Section 1: Documentos Oficiais */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-navy text-white rounded-2xl">
                <GraduationCap size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-navy uppercase tracking-tight">Documentos Oficiais</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Por Aluno</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecionar Aluno</label>
                <select 
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Selecione o Aluno</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assinatura no Documento</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={selectedSignature}
                    onChange={(e) => setSelectedSignature(e.target.value)}
                  >
                    <option value="director">Sérgio Lins (Diretor)</option>
                    <option value="pedagogical">Arlete Duarte (Pedagógico)</option>
                    <option value="secretary">Secretária Acadêmica</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Documento</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={selectedDocument}
                    onChange={(e) => setSelectedDocument(e.target.value)}
                  >
                    <option value="">Selecione o Documento</option>
                    <option value="matricula">Declaração de Matrícula</option>
                    <option value="requerimentoMatricula">Requerimento de Matrícula</option>
                    <option value="desconto">Requerimento de Desconto</option>
                    <option value="contrato">Contrato de Prestação de Serviços</option>
                    <option value="tcc">Autorização Orientação TCC</option>
                    <option value="nadaConsta">Nada Consta Financeiro</option>
                    <option value="conclusao">Declaração de Conclusão</option>
                    <option value="historico">Histórico Escolar</option>
                    <option value="certificado">Certificado de Conclusão</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  disabled={!selectedStudentId || !selectedDocument}
                  onClick={generateDocument}
                  className="w-full h-14 bg-petrol hover:bg-petrol-dark text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-petrol/20"
                >
                  <Printer size={18} /> Emitir Documento Selecionado
                </Button>
              </div>
            </div>
          </div>

          {/* Section 2: Financeiro */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-petrol text-white rounded-2xl">
                <DollarSign size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-navy uppercase tracking-tight">Relatórios Financeiros</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Imposto de Renda</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano Base</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {['2024', '2025', '2026'].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {nucleo === 'SEMIPRESENCIAL' && !profile?.poloId && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrar por Polo</label>
                    <select 
                      className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                      value={selectedPoloId}
                      onChange={(e) => setSelectedPoloId(e.target.value)}
                    >
                      <option value="none">Todos os Polos</option>
                      {polos.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Aluno</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button 
                disabled={!selectedStudentId}
                onClick={generateIR}
                className="w-full h-14 bg-navy hover:bg-navy-dark text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-navy/20"
              >
                <Download size={18} /> Gerar Informe de IR
              </Button>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <Button 
                  onClick={generateMonthlyRevenue}
                  variant="outline"
                  className="w-full h-14 border-2 border-slate-100 hover:border-petrol hover:bg-petrol/5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3"
                >
                  <DollarSign size={18} className="text-petrol" /> Receita Mensal ({selectedYear})
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3: Listas Gerenciais */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500 text-white rounded-2xl">
                <Users size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-navy uppercase tracking-tight">Listas Gerenciais</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Por Turma</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecionar Turma</label>
                <select 
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="">Selecione a Turma</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-4">
                <Button 
                  disabled={!selectedClassId}
                  onClick={generateDiarioClasse}
                  variant="outline" 
                  className="h-14 justify-between px-6 rounded-2xl border-2 border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen size={18} className="text-slate-400 group-hover:text-amber-500" />
                    <span className="font-black text-navy uppercase text-xs tracking-widest">Diário de Classe (PDF)</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Button>

                <Button 
                  disabled={!selectedClassId}
                  onClick={generateListaAssinatura}
                  variant="outline" 
                  className="h-14 justify-between px-6 rounded-2xl border-2 border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList size={18} className="text-slate-400 group-hover:text-amber-500" />
                    <span className="font-black text-navy uppercase text-xs tracking-widest">Lista de Assinatura</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Button>

                <Button 
                  disabled={!selectedClassId}
                  variant="outline" 
                  className="h-14 justify-between px-6 rounded-2xl border-2 border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-all group opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-slate-400 group-hover:text-amber-500" />
                    <span className="font-black text-navy uppercase text-xs tracking-widest">Lista Simples (Alunos)</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-modal-container, #print-modal-container * {
            visibility: visible !important;
          }
          #print-modal-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          #print-modal-container div {
            overflow: visible !important;
            max-height: none !important;
          }
        }
      `}} />
    </div>
  );
};
