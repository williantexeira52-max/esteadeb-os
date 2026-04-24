import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { valorPorExtenso } from '../lib/utils/extenso';
import { Printer, FileText, X, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface DocumentAutomationProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  type: 'CONTRATO' | 'FICHA' | 'REQUERIMENTO' | 'CERTIFICADO' | 'HISTORICO';
}

export const ContractAutomation: React.FC<DocumentAutomationProps> = ({ isOpen, onClose, student, type }) => {
  const { systemConfig } = useAuth();
  const [grades, setGrades] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && student && (type === 'HISTORICO' || type === 'CERTIFICADO')) {
      const fetchGrades = async () => {
        try {
          const q = query(collection(db, 'academic_records'), where('studentId', '==', student.id));
          const snap = await getDocs(q);
          const rawGrades = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Sort grades by year and module
          const sortedGrades = rawGrades.sort((a: any, b: any) => {
            const anoA = a.ano || '';
            const anoB = b.ano || '';
            if (anoA !== anoB) return anoA.localeCompare(anoB);
            return Number(a.modulo || 0) - Number(b.modulo || 0);
          });

          setGrades(sortedGrades);
        } catch (error) {
          console.error("Error fetching academic records for transcript:", error);
        }
      };
      fetchGrades();
    }
  }, [isOpen, student, type]);

  if (!isOpen || !student) return null;

  // School Global Info
  const schoolName = systemConfig?.schoolName || 'ESCOLA TEOLÓGICA DAS ASSEMBLEIAS DE DEUS NO BRASIL';
  const schoolCnpj = systemConfig?.cnpj || '40.800.393/0001-32';
  const schoolAddress = systemConfig?.address || 'R. Dr. Célso Ramalho, 70 - Lagoa Seca, Natal - RN, 59022-330';
  const directorName = systemConfig?.directorName || 'SÉRGIO LINS PESSOA';

  const dataExtenso = new Date().toLocaleDateString('pt-BR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const cursoTipo = student.course?.toLowerCase().includes('bacharel') ? 'Bacharelado' : 'Médio';
  const cargaHoraria = cursoTipo === 'Bacharelado' ? '1.980' : '1.080';
  
  // Financial Formatting: Using actual student data with fallbacks
  const valorIntegral = Number(student.valorIntegral) || 206;
  const valorComDesconto = Number(student.valorComDesconto) || valorIntegral;
  
  const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getDocTitle = () => {
    switch(type) {
      case 'FICHA': return 'Ficha de Matrícula';
      case 'REQUERIMENTO': return 'Requerimento de Desconto';
      default: return 'Contrato Educacional 2026';
    }
  };

  const renderFicha = () => (
    <div className="fiche-matricula space-y-4 text-[10pt]">
      {systemConfig?.logoUrl && (
         <div className="flex justify-center mb-4 border-b-2 border-black pb-4">
            <img src={systemConfig.logoUrl} alt="ESTEADEB Logo" className="h-24 object-contain" />
         </div>
      )}
      <div className="border-2 border-black p-2 bg-slate-100 text-center uppercase font-black text-lg tracking-widest">
        Ficha de Matrícula
      </div>
      
      <section className="border border-black">
        <div className="bg-slate-200 px-2 py-1 border-b border-black font-black uppercase text-[10px]">1 - Dados Pessoais:</div>
        <div className="p-2 space-y-1">
          <div className="flex border-b border-black/10 pb-1">
            <span className="font-bold mr-2 uppercase text-[9px]">Nome Completo:</span>
            <span className="text-sm font-medium">{student.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 border-b border-black/10 pb-1">
            <div><span className="font-bold mr-2 uppercase text-[9px]">Sexo:</span> <span>({student.gender === 'M' ? 'X' : ' '})M ({student.gender === 'F' ? 'X' : ' '})F</span></div>
            <div><span className="font-bold mr-2 uppercase text-[9px]">Estado Civil:</span> <span>{student.maritalStatus || '---'}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-b border-black/10 pb-1">
            <div><span className="font-bold mr-2 uppercase text-[9px]">Data de Nascimento:</span> <span>{student.birthDate || '---'}</span></div>
            <div><span className="font-bold mr-2 uppercase text-[9px]">Cidade de Nascimento/UF:</span> <span>{student.birthCity || '---'}/{student.birthState || '--'}</span></div>
          </div>
          <div className="flex border-b border-black/10 pb-1">
            <span className="font-bold mr-2 uppercase text-[9px]">E-mail:</span>
            <span>{student.email || '---'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-black/10 pb-1">
            <div className="col-span-1"><span className="font-bold mr-2 uppercase text-[9px]">RG:</span> <span>{student.rg || '---'}</span></div>
            <div className="col-span-1"><span className="font-bold mr-2 uppercase text-[9px]">CPF:</span> <span>{student.cpf || '---'}</span></div>
            <div className="col-span-1"><span className="font-bold mr-2 uppercase text-[9px]">Orgão Expedidor:</span> <span>{student.rgIssuer || '---'}</span></div>
          </div>
          <div className="flex border-b border-black/10 pb-1">
            <span className="font-bold mr-2 uppercase text-[9px]">Endereço:</span>
            <span>{student.address}, {student.number} {student.complement && `- ${student.complement}`}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 border-b border-black/10 pb-1">
            <div className="col-span-1"><span className="font-bold mr-2 uppercase text-[9px]">Bairro:</span> <span>{student.neighborhood || '---'}</span></div>
            <div className="col-span-1"><span className="font-bold mr-2 uppercase text-[9px]">CEP:</span> <span>{student.cep || '---'}</span></div>
            <div className="col-span-1"><span className="font-bold mr-2 uppercase text-[9px]">Cidade:</span> <span>{student.city || '---'}</span></div>
            <div className="col-span-1"><span className="font-bold mr-2 uppercase text-[9px]">UF:</span> <span>{student.state || '--'}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-black/10 pb-1">
            <div><span className="font-bold mr-2 uppercase text-[9px]">Telefone:</span> <span>{student.phone || '---'}</span></div>
            <div><span className="font-bold mr-2 uppercase text-[9px]">Celular 1:</span> <span>{student.phone || '---'}</span></div>
            <div><span className="font-bold mr-2 uppercase text-[9px]">Celular 2:</span> <span>{student.phone2 || '---'}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-b border-black/10 pb-1">
            <div><span className="font-bold mr-2 uppercase text-[9px]">Nome do Pai:</span> <span>{student.fatherName || '---'}</span></div>
            <div><span className="font-bold mr-2 uppercase text-[9px]">Nome da Mãe:</span> <span>{student.motherName || '---'}</span></div>
          </div>
          <div><span className="font-bold mr-2 uppercase text-[9px]">Profissão:</span> <span>{student.profissao || '---'}</span></div>
        </div>
      </section>

      <section className="border border-black">
        <div className="bg-slate-200 px-2 py-1 border-b border-black font-black uppercase text-[10px]">2 - Dados Eclesiásticos:</div>
        <div className="p-2 space-y-1">
          <div className="grid grid-cols-2 gap-4 border-b border-black/10 pb-1">
            <div><span className="font-bold mr-2 uppercase text-[9px]">Data de Conversão:</span> <span>{student.dataConversao || '---'}</span></div>
            <div><span className="font-bold mr-2 uppercase text-[9px]">Data do Batismo em Águas:</span> <span>{student.dataBatismo || '---'}</span></div>
          </div>
          <div className="flex border-b border-black/10 pb-1">
            <span className="font-bold mr-2 uppercase text-[9px]">Igreja da qual é Membro:</span>
            <span>{student.igrejaMembro || '---'}</span>
          </div>
          <div className="flex border-b border-black/10 pb-1">
            <span className="font-bold mr-2 uppercase text-[9px]">Congregação:</span>
            <span>{student.congregacao || '---'}</span>
          </div>
          <div><span className="font-bold mr-2 uppercase text-[9px]">Função que exerce na Igreja:</span> <span>{student.funcaoIgreja || '---'}</span></div>
        </div>
      </section>

      <section className="border border-black">
        <div className="bg-slate-200 px-2 py-1 border-b border-black font-black uppercase text-[10px]">3 - Dados do Curso:</div>
        <div className="grid grid-cols-2 border-b border-black">
          <div className="border-r border-black p-2 flex justify-center items-center gap-4">
            <span className="font-bold">({cursoTipo === 'Bacharelado' ? 'X' : ' '}) BACHARELADO</span>
            <span className="font-bold">({cursoTipo === 'Médio' ? 'X' : ' '}) MÉDIO</span>
          </div>
          <div className="p-2 grid grid-cols-2 text-center text-[9px] font-bold">
            <div className="border-r border-black/20">CARGA HORÁRIA <br/> <span className="text-sm font-black">{cargaHoraria}</span></div>
            <div>TURMA <br/> <span className="text-sm font-black uppercase">{student.className || student.turma || '---'}</span></div>
          </div>
        </div>
      </section>

      <div className="pt-8 text-center space-y-12">
        <p className="text-xs italic">Natal/RN, ________ de ________________________ de 2026.</p>
        <div className="grid grid-cols-2 gap-12 pt-4">
          <div className="border-t border-black pt-2 uppercase text-[9px] font-bold">Assinatura do Aluno</div>
          <div className="border-t border-black pt-2 uppercase text-[9px] font-bold">Secretaria</div>
        </div>
      </div>
    </div>
  );

  const renderRequerimento = () => (
    <div className="space-y-6 doc-font">
      <div className="text-center font-black text-xl uppercase tracking-tighter border-b-2 border-black pb-4">
        Requerimento de Desconto – Ano Letivo 2026
      </div>
      
      <p className="text-justify leading-relaxed">
        Eu, <strong>{student.name}</strong>, aluno(a) da turma da <strong>{student.className || student.turma || '---'}</strong>, venho, por meio deste, requerer a concessão de desconto em minhas mensalidades, referente ao ano letivo de 2026.
      </p>

      <section className="space-y-4">
        <h3 className="font-black uppercase tracking-tight text-sm bg-slate-50 p-2 border border-black/10">Cláusula Primeira — Da Concessão do Desconto</h3>
        <div className="pl-4 space-y-2 text-sm">
          <p>1.1. A instituição concede ao aluno o seguinte desconto, conforme análise e aprovação da Direção:</p>
          <ul className="list-none space-y-2 font-bold bg-slate-50 p-4 border border-navy/20 rounded-xl">
            <li>Nome do desconto: <span className="text-navy font-black ml-2 uppercase underline">{student.nomeDesconto || 'DESCONTO PADRÃO'}</span></li>
            <li>Percentual concedido: <span className="text-navy font-black ml-2">{student.percentualDesconto || 0}%</span></li>
            <li>Valor com desconto: <span className="text-navy font-black ml-2">{fmt(valorComDesconto)}</span></li>
            <li>Valor integral da mensalidade: <span className="text-navy font-black ml-2">{fmt(valorIntegral)}</span></li>
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-black uppercase tracking-tight text-sm bg-slate-50 p-2 border border-black/10">Cláusula Segunda — Das Condições de Pagamento</h3>
        <p className="text-xs text-justify italic pl-4">
          2.1. A concessão do desconto está condicionada ao pagamento da mensalidade estritamente até a data de vencimento estabelecida no ato da matrícula.
        </p>
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl">
           <p className="text-xs text-justify font-bold text-red-700 uppercase tracking-tight">
            2.2. O pagamento efetuado após o vencimento implicará na perda automática do desconto, devendo ser quitado o valor integral da mensalidade ({fmt(valorIntegral)}).
          </p>
        </div>
      </section>

      <div className="pt-12 text-center space-y-16">
        <p className="text-sm">Natal/RN, ________ de ________________________ de 2026.</p>
        
        <div className="flex flex-col items-center">
          <div className="w-64 border-t border-black pb-1"></div>
          <span className="font-black uppercase text-xs">{student.name}</span>
        </div>

        <div className="grid grid-cols-2 pt-8 gap-8">
          <div className="border border-black p-4 text-left rounded-xl">
            <p className="font-black text-[10px] uppercase text-slate-400 mb-2">Aprovação da Direção</p>
            <p className="font-bold flex gap-4"><span>( ) APROVADO</span> <span>( ) NÃO APROVADO</span></p>
          </div>
          <div className="flex flex-col items-center justify-end">
            <div className="w-64 border-t border-black pb-1"></div>
            <span className="font-black uppercase text-[10px]">Assinatura da Direção</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContrato = () => {
    const fallbackTemplate = `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS – 2026

Pelo presente instrumento particular, de um lado, a **ESCOLA TEOLÓGICA DAS ASSEMBLEIAS DE DEUS NO BRASIL**, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº **40.800.393/0001-32**, com sede na R. Dr. Célso Ramalho, 70 - Lagoa Seca, Natal - RN, 59022-330, neste ato representada por seu representante legal **SÉRGIO LINS PESSOA**, doravante denominada CONTRATADA;

E, de outro lado, o(a) aluno(a) **{{NOME_ALUNO}}**, inscrito(a) no CPF nº **{{CPF_ALUNO}}**, nascido(a) em **{{DATA_NASCIMENTO}}**, doravante denominado(a) CONTRATANTE;

Firmam o presente contrato, conforme cláusulas a seguir:

### CLÁUSULA 1 – DO OBJETO
1.1. O presente contrato tem como objetivo a prestação de serviços educacionais do Curso de Teologia ao aluno, conforme a grade curricular e o calendário acadêmico da instituição.

### CLÁUSULA 1-A – DA TURMA EM QUE O ALUNO ESTÁ SE MATRICULANDO
1-A.1. O CONTRATANTE declara estar ciente de que está se matriculando na Turma: **{{NOME_TURMA}}** - **{{TURNO}}**, cuja organização acadêmica segue o cronograma e programação pedagógica definidos pela CONTRATADA.

### CLÁUSULA 2 – DA DURAÇÃO
2.1. O presente contrato tem validade de 12 (doze) meses, contados a partir da efetivação da matrícula do CONTRATANTE.

### CLÁUSULA 2-A – DA RENOVAÇÃO E ORGANIZAÇÃO DO CURSO
2-A.1. A instituição organiza o ano letivo em 5 (cinco) módulos.
2-A.2. Para o Curso Médio em Teologia (1.080h), cada módulo contém 2 disciplinas.
2-A.3. Para o Curso de Bacharelado Livre em Teologia (1.980h), cada módulo contém 4 disciplinas.
2-A.4. O CONTRATANTE declara estar ciente da estrutura modular para o curso de **{{CURSO_SELECIONADO}}**.

### CLÁUSULA 3 – DO VALOR E FORMA DE PAGAMENTO
3.1. O CONTRATANTE pagará à CONTRATADA o valor de R$ **{{VALOR_MENSALIDADE}} ({{VALOR_EXTENSO}})** por 12 meses, com vencimento até o 5º (quinto) dia útil do mês.
3.2. O não pagamento no prazo implicará multa de 2% sobre o valor da parcela, além de juros moratórios de 1% ao mês.
3.3. Benefícios de desconto (como o valor de R$ 145,00 para grupos) serão regidos por requerimento próprio em anexo.

### CLÁUSULA 7 – DA NATUREZA DO CURSO
7.1. O curso ofertado pela CONTRATADA é classificado como Curso Livre de Teologia, não estando sujeito à regulamentação ou reconhecimento pelo MEC.

---

**Natal/RN, {{DIA}} de {{MES}} de {{ANO}}.**

&nbsp;

&nbsp;

__________________________________________
**ESCOLA TEOLÓGICA DAS ASSEMBLEIAS DE DEUS NO BRASIL**  
(CONTRATADA)

&nbsp;

&nbsp;

__________________________________________
**{{NOME_ALUNO}}**  
(CONTRATANTE)
`;

    // Hardcode definition directly as requested globally.
    const rawTemplate = fallbackTemplate;

    const parsedContract = rawTemplate
      .replace(/\{\{NOME\}\}|\{\{NOME_ALUNO\}\}/g, student.name || '---')
      .replace(/\{\{CPF\}\}|\{\{CPF_ALUNO\}\}/g, student.cpf || '---')
      .replace(/\{\{NASCIMENTO\}\}|\{\{DATA_NASCIMENTO\}\}/g, student.birthDate || '---')
      .replace(/\{\{MATRICULA\}\}/g, student.matricula || student.id || '---')
      .replace(/\{\{NOME_TURMA\}\}/g, student.className || student.turma || 'Sem Turma')
      .replace(/\{\{TURNO\}\}/g, student.turno || student.shift || 'Não Especificado')
      .replace(/\{\{CURSO_SELECIONADO\}\}/g, student.course || 'Teologia')
      .replace(/\{\{ESCOLA\}\}/g, schoolName)
      .replace(/\{\{CNPJ\}\}/g, schoolCnpj)
      .replace(/\{\{ENDERECO\}\}/g, schoolAddress)
      .replace(/\{\{DIRETOR\}\}/g, directorName)
      .replace(/\{\{VALOR_INTEGRAL\}\}/g, fmt(valorIntegral))
      .replace(/\{\{VALOR_MENSALIDADE\}\}/g, valorComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
      .replace(/\{\{VALOR_EXTENSO\}\}/g, valorPorExtenso(valorComDesconto))
      .replace(/R\$ 145,00 para grupos/g, fmt(valorComDesconto)) // Fix hardcoded mention in fallback template
      .replace(/\{\{DATA_COMPLETA\}\}/g, dataExtenso)
      .replace(/\{\{DIA\}\}/g, String(new Date().getDate()).padStart(2, '0'))
      .replace(/\{\{MES\}\}/g, new Date().toLocaleString('pt-BR', { month: 'long' }))
      .replace(/\{\{ANO\}\}/g, String(new Date().getFullYear()));

    return (
      <div className="contract-markdown">
        <Markdown>{parsedContract}</Markdown>
      </div>
    );
  };

  const renderHistorico = () => (
    <div className="p-8 space-y-6 text-slate-900 font-sans max-w-5xl mx-auto bg-white print:p-0" style={{ maxWidth: '100%' }}>
      {/* Header precisely matching Photo 2 */}
      <div className="flex items-center gap-6 pb-2">
        {systemConfig?.logoUrl ? (
          <img src={systemConfig.logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
        ) : (
          <div className="w-16 h-16 bg-navy/5 flex items-center justify-center rounded-xl">
            <GraduationCap size={40} className="text-navy" />
          </div>
        )}
        <div className="flex-1 text-center">
          <h1 className="text-md font-bold uppercase leading-tight">{systemConfig?.schoolName || 'Escola Teológica das Assembleias de Deus no Brasil'}</h1>
          <p className="text-[10px] uppercase">Rua Doutor Celso Ramalho, 70 - Lagoa Seca</p>
          <p className="text-[10px] uppercase">Fone: 3223-1203</p>
          <p className="text-[10px] uppercase">CNPJ 40.800.393/0001-32</p>
        </div>
      </div>

      <div className="text-center border-y-2 border-black py-1">
        <h2 className="text-2xl font-black uppercase tracking-widest">Histórico Escolar</h2>
      </div>

      {/* Grid precisely matching Photo 2 header sections */}
      <div className="border-x border-t border-black text-[11px]">
        <div className="grid grid-cols-12 border-b border-black">
          <div className="col-span-11 p-1 border-r border-black flex">
            <span className="font-bold uppercase w-16">Aluno:</span>
            <span className="uppercase flex-1">{student.name}</span>
          </div>
          <div className="col-span-1 p-1 text-center font-bold">1ª VIA</div>
        </div>
        <div className="p-1 border-b border-black flex">
          <span className="font-bold uppercase w-40">Data de Nascimento:</span>
          <span>{student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR') : '---'}</span>
        </div>
        <div className="grid grid-cols-12 border-b border-black">
          <div className="col-span-7 p-1 border-r border-black flex">
             <span className="font-bold uppercase w-16">Cidade:</span>
             <span className="uppercase">{student.birthCity || '---'}</span>
          </div>
          <div className="col-span-5 p-1 flex">
             <span className="font-bold uppercase w-16">Estado:</span>
             <span className="uppercase">{student.birthState || '---'}</span>
          </div>
        </div>
        <div className="p-1 border-b border-black flex">
          <span className="font-bold uppercase w-20">Filiação:</span>
          <span className="uppercase">{student.fatherName && student.motherName ? `${student.fatherName} e ${student.motherName}` : student.filiation || '---'}</span>
        </div>
        <div className="grid grid-cols-12 border-b border-black">
          <div className="col-span-7 p-1 border-r border-black flex">
             <span className="font-bold uppercase w-24">Identidade:</span>
             <span className="uppercase">{student.rg || '---'}</span>
          </div>
          <div className="col-span-5 p-1 flex">
             <span className="font-bold uppercase w-12">CPF:</span>
             <span className="uppercase">{student.cpf || '---'}</span>
          </div>
        </div>
        <div className="p-1 border-b border-black flex">
          <span className="font-bold uppercase w-16">Curso:</span>
          <span className="uppercase">{student.course || 'TEOLOGIA'}</span>
        </div>
      </div>

      <div className="border-x border-black overflow-hidden">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="border-r border-black p-1 text-center font-bold uppercase w-16">Período</th>
              <th className="border-r border-black p-1 text-center font-bold uppercase w-16">Módulo</th>
              <th className="border-r border-black p-1 text-center font-bold uppercase">Disciplinas</th>
              <th className="border-r border-black p-1 text-center font-bold uppercase w-12">C/H</th>
              <th className="border-r border-black p-1 text-center font-bold uppercase w-16">Média Final</th>
              <th className="border-r border-black p-1 text-center font-bold uppercase w-20">Situação</th>
              <th className="p-1 text-center font-bold uppercase w-28">Instituição</th>
            </tr>
          </thead>
          <tbody>
            {grades.length > 0 ? grades.map((g, i) => (
              <tr key={i} className="border-b border-black last:border-0 h-8">
                <td className="border-r border-black text-center p-1 uppercase">{g.ano || '---'}</td>
                <td className="border-r border-black text-center p-1 uppercase">{g.modulo || '---'}</td>
                <td className="border-r border-black px-2 p-1 uppercase">{g.disciplina || g.moduleName}</td>
                <td className="border-r border-black text-center p-1">30</td>
                <td className="border-r border-black text-center p-1 font-bold">{(typeof g.nota === 'number' ? g.nota : Number(g.grade || 0)).toFixed(1)}</td>
                <td className="border-r border-black text-center p-1 uppercase">{g.status === 'Dispensada' ? 'AD' : (Number(g.nota || g.grade) >= 7 ? 'AP' : 'RP')}</td>
                <td className="text-center p-1 uppercase">{g.institution || 'ESTEADEB'}</td>
              </tr>
            )) : (
              <tr className="border-b border-black last:border-0 h-16">
                <td colSpan={7} className="text-center p-4 italic text-slate-400">Nenhum registro de notas encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border border-black text-[10px]">
        <div className="p-1 border-b border-black font-bold uppercase bg-slate-50">Legenda – Situação Acadêmica:</div>
        <div className="grid grid-cols-2 gap-x-4 p-1">
          <div className="flex justify-between border-r border-slate-200 pr-2"><span>AP – Aprovado</span> <span>RF – Reprovado por Falta</span></div>
          <div className="flex justify-between pl-2"><span>RP – Reprovado</span> <span>AD – Aproveitamento de Disciplina</span></div>
          <div className="flex justify-between border-r border-slate-200 pr-2"><span>CS – Cursando</span> <span>PD – Pendente</span></div>
        </div>
      </div>

      <div className="border border-black text-[10px]">
        <div className="p-1 border-b border-black font-bold uppercase bg-slate-50">Resumo Acadêmico:</div>
        <div className="border-b border-black p-1 flex justify-between">
          <span>Carga Horária Mínima: 1.800 h/a</span>
        </div>
        <div className="border-b border-black p-1 flex justify-between">
          <span>Carga Horária Cumprida: {grades.length * 30} h/a</span>
        </div>
        <div className="p-1 flex justify-between">
          <span>Situação Final: <span className="uppercase">{student.status}</span></span>
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-bold uppercase text-[10px]">Observações:</p>
        <div className="w-full border-b border-black h-4"></div>
        <div className="w-full border-b border-black h-4"></div>
      </div>

      <div className="pt-2 text-right">
        <p className="font-medium text-[11px]">Natal/RN, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
      </div>
    </div>
  );

  const renderCertificado = () => (
    <div className="p-0 text-slate-900 font-sans mx-auto bg-white relative min-h-[794px] flex flex-col items-center justify-center print:w-[1123px] print:h-[794px] overflow-hidden" 
      style={{ 
        width: '1123px', 
        height: '794px', 
        minWidth: '1123px',
        padding: '60px'
      }}>
      
      {/* Photo 1 High Fidelity Borders */}
      <div className="absolute inset-4 border-[3px] border-[#003366] z-10 box-border pointer-events-none"></div>
      <div className="absolute inset-6 border-[1px] border-amber-400 z-10 box-border pointer-events-none"></div>
      
      {/* Vertical "CERTIFICADO" Graphics (Left) */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 origin-center z-20 pointer-events-none">
        <span className="text-[70px] font-black uppercase tracking-[0.2em] text-transparent" style={{ WebkitTextStroke: '1px #b8860b' }}>CERTIFICADO</span>
      </div>
      
      {/* Vertical "CERTIFICADO" Graphics (Right) */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 rotate-90 origin-center z-20 pointer-events-none">
        <span className="text-[70px] font-black uppercase tracking-[0.2em] text-transparent" style={{ WebkitTextStroke: '1px #b8860b' }}>CERTIFICADO</span>
      </div>

      {/* Decorative Gold/Brown Corner Waves (Top-Right) */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] z-0 overflow-hidden pointer-events-none opacity-80">
         <div className="absolute -top-20 -right-20 w-full h-full bg-[#b8860b]/20 rounded-full blur-3xl transform rotate-12"></div>
         <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-bl-[200px]"></div>
         {/* Wave pattern mock */}
         <div className="absolute top-0 right-0 w-full h-full">
            <svg viewBox="0 0 400 400" className="w-full h-full fill-[#b8860b]/30">
               <path d="M400,0 L400,400 Q300,300 200,400 Q100,300 0,400 L0,0 Z" transform="rotate(180 200 200)"/>
            </svg>
         </div>
      </div>
      
      {/* Decorative Gold/Brown Corner Waves (Bottom-Left) */}
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] z-0 overflow-hidden pointer-events-none opacity-80">
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-tr-[200px]"></div>
         <div className="absolute bottom-0 left-0 w-full h-full">
            <svg viewBox="0 0 400 400" className="w-full h-full fill-[#b8860b]/30">
               <path d="M0,400 L0,0 Q100,100 200,0 Q300,100 400,0 L400,400 Z" />
            </svg>
         </div>
      </div>

      {/* Content precisely according to Photo 1 */}
      <div className="relative z-30 flex flex-col items-center text-center w-full px-48">
        {/* Header and Logo */}
        <div className="flex items-center gap-10 mb-10">
          {systemConfig?.logoUrl ? (
            <img src={systemConfig.logoUrl} alt="Logo" className="h-32 w-auto object-contain" />
          ) : (
            <div className="w-32 h-32 bg-amber-400/20 rounded-full flex items-center justify-center">
              <GraduationCap size={64} className="text-[#003366]" />
            </div>
          )}
          <div className="text-left">
             <h1 className="text-8xl font-black text-[#003366] tracking-tighter leading-none">ESTEADEB</h1>
             <p className="text-xl font-bold uppercase tracking-[0.3em] text-slate-800">Escola Teológica das</p>
             <p className="text-xl font-bold uppercase tracking-[0.3em] text-slate-800">Assembleias de Deus no Brasil</p>
          </div>
        </div>

        {/* Text Body */}
        <div className="space-y-8 max-w-5xl">
          <p className="text-lg font-medium leading-relaxed italic text-slate-800">
            O Diretor da Escola Teológica das Assembleias de Deus no Brasil – <span className="font-bold border-b border-black">ESTEADEB</span>, no uso de suas atribuições, tendo em vista a conclusão em <strong>{student.completionYear || '2026'}</strong> do <em>Curso Livre em Teologia</em> no respectivo grau de
          </p>
          
          <h2 className="text-4xl font-black text-[#003366] uppercase tracking-[0.1em] py-4">
            {student.course?.toUpperCase() || 'MÉDIO EM TEOLOGIA'}
          </h2>

          <h3 className="text-4xl sm:text-6xl font-serif font-black text-black py-4 border-b-2 border-slate-200 break-words w-full">
            {student.name}
          </h3>

          <p className="text-lg font-medium leading-relaxed text-slate-800">
            Brasileiro(a), natural de <strong>{student.birthCity || 'Natal/RN'}</strong>, nascido(a) em 
            <strong> {student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '---'}</strong>, 
            CPF nº <strong>{student.cpf || '---'}</strong>.
          </p>

          <p className="text-lg font-medium pt-8 italic">
            Outorga-lhe o presente Certificado a fim de que possa gozar de todos os direitos e prerrogativas legais.
          </p>

          <p className="text-lg font-bold pt-6">
            Natal, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        </div>

        {/* Signatures at the bottom precisely positioned */}
        <div className="w-full flex justify-between items-end gap-40 pt-20">
          <div className="flex-1 flex flex-col items-center">
            <div className="w-full border-t border-black pt-2 relative">
               {systemConfig?.pedagogicalSignatureUrl ? (
                  <img src={systemConfig.pedagogicalSignatureUrl} alt="Assinatura" className="absolute -top-16 left-1/2 -translate-x-1/2 h-20 object-contain" />
               ) : (
                  <div className="h-10"></div>
               )}
               <p className="text-[11px] font-bold uppercase">Arlete Duarte de Almeida Costa</p>
               <p className="text-[9px] font-medium uppercase text-slate-500">Coordenadora Pedagógica</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center">
            <div className="w-full pt-2">
               <div className="w-full h-px bg-slate-400 mb-2"></div>
               <p className="text-[11px] font-bold uppercase">Diplomado</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center">
            <div className="w-full border-t border-black pt-2 relative">
               <p className="text-[11px] font-bold uppercase">{systemConfig?.directorName || 'Sérgio Lins Pessoa, MsC.'}</p>
               <p className="text-[9px] font-medium uppercase text-slate-500">Diretor</p>
            </div>
            <div className="w-full border-t border-black pt-2 relative mt-8">
               <p className="text-[11px] font-bold uppercase">William Carvalho</p>
               <p className="text-[9px] font-medium uppercase text-slate-500">Coordenador</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handlePrint = () => {
    // Print handled purely by robust CSS now. Let's just trigger window print.
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div id="print-overlay-container" className="fixed inset-0 z-[500] flex items-start justify-center pt-8 print:p-0 print:block print:bg-white print:static print-overlay-container">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body, html { background: white !important; height: auto !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          #print-overlay-container, #print-overlay-container * { visibility: visible !important; }
          #print-overlay-container { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
            display: block !important;
          }
          #print-overlay-container div {
            overflow: visible !important;
            max-height: none !important;
          }
          .no-print, button, [role="tablist"], nav, aside { display: none !important; }
          #printable-document { 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 100% !important; 
            max-width: none !important; 
            overflow: visible !important;
            display: block !important;
            box-shadow: none !important;
          }
          .contract-markdown { font-size: 11pt; line-height: 1.5; }
          .bg-slate-900\\/40 { display: none !important; }
          .shadow-2xl { box-shadow: none !important; }
          .rounded-3xl { border-radius: 0 !important; }
        }
      `}} />
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]"
      >
        <div className="p-6 border-b flex items-center justify-between no-print bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-navy text-white rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-navy uppercase tracking-tight">{getDocTitle()}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Documento Gerado em {dataExtenso}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} variant="outline" className="gap-2 rounded-xl border-navy text-navy font-bold">
              <Printer size={16} /> Imprimir Doc
            </Button>
            <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full">
              <X size={20} />
            </Button>
          </div>
        </div>

        <div id="printable-document" className="flex-1 overflow-y-auto p-12 bg-white doc-view">
          <style dangerouslySetInnerHTML={{ __html: `
            .doc-view { font-family: 'Times New Roman', serif; line-height: 1.4; color: #000; }
            .doc-view h1 { text-align: center; font-size: 1.4rem; margin-bottom: 2rem; font-weight: bold; text-transform: uppercase; }
            .doc-view h3 { font-size: 1rem; margin-top: 1rem; font-weight: bold; text-transform: uppercase; }
          `}} />
          
          {systemConfig?.logoUrl && type !== 'FICHA' && (
             <div className="flex justify-center mb-6">
                <img src={systemConfig.logoUrl} alt="ESTEADEB Logo" className="h-20 object-contain" />
             </div>
          )}

          {type === 'CONTRATO' && renderContrato()}
          {type === 'FICHA' && renderFicha()}
          {type === 'REQUERIMENTO' && renderRequerimento()}
          {type === 'HISTORICO' && renderHistorico()}
          {type === 'CERTIFICADO' && renderCertificado()}

          {/* Director Signature (only for standard docs) */}
          {systemConfig?.directorSignatureUrl && !['HISTORICO', 'CERTIFICADO', 'FICHA', 'REQUERIMENTO', 'CONTRATO'].includes(type) && (
            <div className="mt-12 flex flex-col items-center border-t pt-8">
              <img 
                src={systemConfig.directorSignatureUrl} 
                alt="Assinatura Diretor" 
                className="h-16 object-contain grayscale brightness-50 contrast-150"
                referrerPolicy="no-referrer"
              />
              <span className="text-[10pt] font-black uppercase mt-2">{directorName}</span>
              <span className="text-[8pt] text-slate-500 font-bold uppercase tracking-widest">Diretor Geral - {schoolName}</span>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between no-print opacity-60">
            <p className="text-[10px] text-slate-400 font-bold uppercase">ESTEADEB - Automação Documental 2026</p>
            <div className="w-12 h-6 bg-slate-100 rounded-md"></div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
