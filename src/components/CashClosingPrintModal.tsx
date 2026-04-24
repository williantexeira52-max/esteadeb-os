import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Printer, X, FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { Input } from '@/components/ui/input';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CashClosingPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashClosingPrintModal: React.FC<CashClosingPrintModalProps> = ({ isOpen, onClose }) => {
  const { systemConfig, profile, nucleo, user } = useAuth();
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().substring(0, 7)); // Default to current month YYYY-MM
  const [filterType, setFilterType] = useState<'MONTH' | 'DATE'>('MONTH');
  const [cashRegister, setCashRegister] = useState<'ALL' | 'CAIXA_ADMINISTRATIVO' | 'CAIXA_ESCOLA' | 'CAIXA_CANTINA'>('ALL');
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [previousBalance, setPreviousBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && nucleo && user) {
      fetchReportData();
    }
  }, [isOpen, filterDate, filterType, cashRegister, nucleo, user]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const datePrefix = filterType === 'MONTH' ? filterDate.substring(0, 7) : filterDate;
      const isBeforePeriod = (d: string) => d && (filterType === 'MONTH' ? d.substring(0, 7) < datePrefix : d < datePrefix);
      const isInPeriod = (d: string) => d && d.startsWith(datePrefix);

      // Base constraints
      const baseConstraints = [where('nucleoId', '==', nucleo)];
      if (profile?.poloId) {
         baseConstraints.push(where('poloId', '==', profile.poloId));
      }

      const qFinance = query(collection(db, 'transactions'), ...baseConstraints);
      const snapFinance = await getDocs(qFinance);
      const allTransactions = snapFinance.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'Caixa Administrativo' }));

      const docSchoolList = await getDocs(query(collection(db, 'school_cash'), ...baseConstraints));
      const allSchoolCash = docSchoolList.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'Caixa Escola' }));

      const docSnackList = await getDocs(query(collection(db, 'snack_cash'), ...baseConstraints));
      const allSnackCash = docSnackList.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'Caixa Cantina' }));

      const qInstallments = query(collection(db, 'financial_installments'), where('status', '==', 'Pago'), ...baseConstraints);
      const snapInstallments = await getDocs(qInstallments);
      const allInstallments = snapInstallments.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any)).filter((inst: any) => inst.paymentMethod !== 'Permuta de Serviço');

      // Split into current period vs previous period
      let prevBal = 0;
      
      const calcCashPrev = (list: any[]) => {
        list.forEach(t => {
          if (isBeforePeriod(t.date)) {
             if (t.type === 'ENTRY' || (!t.type && Number(t.amount) > 0)) prevBal += Number(t.amount || 0);
             if (t.type === 'WITHDRAWAL' || (!t.type && Number(t.amount) < 0)) prevBal -= Number(Math.abs(t.amount || 0));
          }
        });
      };
      if (cashRegister === 'ALL' || cashRegister === 'CAIXA_ADMINISTRATIVO') {
        calcCashPrev(allTransactions);
        allInstallments.forEach(t => {
          if (isBeforePeriod(t.paymentDate)) {
            prevBal += Number(t.finalPaidValue || 0);
          }
        });
      }
      
      if (cashRegister === 'ALL' || cashRegister === 'CAIXA_ESCOLA') {
        calcCashPrev(allSchoolCash);
      }
      
      if (cashRegister === 'ALL' || cashRegister === 'CAIXA_CANTINA') {
        calcCashPrev(allSnackCash);
      }

      setPreviousBalance(prevBal);

      let transList: any[] = [];
      if (cashRegister === 'ALL' || cashRegister === 'CAIXA_ADMINISTRATIVO') transList.push(...allTransactions);
      if (cashRegister === 'ALL' || cashRegister === 'CAIXA_ESCOLA') transList.push(...allSchoolCash);
      if (cashRegister === 'ALL' || cashRegister === 'CAIXA_CANTINA') transList.push(...allSnackCash);

      const transInPeriod = transList.filter((t: any) => isInPeriod(t.date)).sort((a: any, b: any) => a.date?.localeCompare(b.date));
      
      let instList: any[] = [];
      if (cashRegister === 'ALL' || cashRegister === 'CAIXA_ADMINISTRATIVO') instList.push(...allInstallments);
      
      const instInPeriod = instList.filter((t: any) => isInPeriod(t.paymentDate)).sort((a: any, b: any) => a.paymentDate?.localeCompare(b.paymentDate));

      setTransactions(transInPeriod);
      setInstallments(instInPeriod);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const totalInstallments = installments.reduce((acc, curr) => acc + (Number(curr.finalPaidValue) || 0), 0);
  const totalDiscounts = installments.reduce((acc, curr) => acc + ((Number(curr.baseValue) - Number(curr.finalPaidValue) > 0) ? (Number(curr.baseValue) - Number(curr.finalPaidValue)) : 0), 0);
  
  const entriesCount = transactions.filter(t => t.type === 'ENTRY' || (!t.type && Number(t.amount) > 0)).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const withdrawalsCount = transactions.filter(t => t.type === 'WITHDRAWAL' || (!t.type && Number(t.amount) < 0)).reduce((acc, curr) => acc + Number(Math.abs(curr.amount || 0)), 0);

  const displayDate = filterType === 'MONTH' ? `${filterDate.split('-')[1]}/${filterDate.split('-')[0]}` : filterDate.split('-').reverse().join('/');
  
  const saldoFinal = previousBalance + totalInstallments + entriesCount - withdrawalsCount;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center pt-8 print:p-0 print-overlay-container">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm no-print"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]"
      >
        <div className="p-6 border-b flex items-center justify-between no-print bg-slate-50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-petrol text-white rounded-lg">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-navy uppercase tracking-tight">Fechamento de Caixa</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Relatório Financeiro</p>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-200" />
            
            <div className="flex items-center gap-2">
              <select 
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none max-w-[150px]"
                value={cashRegister}
                onChange={e => setCashRegister(e.target.value as any)}
              >
                <option value="ALL">Todos os Caixas</option>
                <option value="CAIXA_ADMINISTRATIVO">Caixa Adm</option>
                <option value="CAIXA_ESCOLA">Caixa Escola</option>
                <option value="CAIXA_CANTINA">Caixa Lanche</option>
              </select>
              <select 
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none"
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
              >
                <option value="MONTH">Por Mês</option>
                <option value="DATE">Por Data Exata</option>
              </select>
              <Input 
                type={filterType === 'MONTH' ? 'month' : 'date'}
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="h-10 w-40 text-xs"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} variant="outline" className="gap-2 rounded-xl border-navy text-navy font-bold">
              <Printer size={16} /> Imprimir Relatório
            </Button>
            <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full">
              <X size={20} />
            </Button>
          </div>
        </div>

        <div id="printable-document" className="flex-1 overflow-y-auto p-12 bg-white doc-view" style={{ maxWidth: '100%' }}>
          {loading ? (
             <div className="flex items-center justify-center h-64 text-slate-400 font-bold uppercase tracking-widest text-xs">
                Carregando relatório...
             </div>
          ) : (
             <div className="space-y-8">
               <div className="text-center space-y-2 border-b-2 border-navy pb-6">
                 {systemConfig?.logoUrl && (
                   <img src={systemConfig.logoUrl} alt="Logo" className="h-16 object-contain mx-auto mb-4" />
                 )}
                 <h1 className="text-2xl font-black text-navy uppercase tracking-tighter">Relatório de Fechamento de Caixa</h1>
                 <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Período de Referência: {displayDate}</p>
               </div>

               <div className={cn("grid gap-3 p-6 bg-slate-50 rounded-2xl border border-slate-200", cashRegister === 'CAIXA_CANTINA' ? 'grid-cols-3' : 'grid-cols-6')}>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Saldo Anterior</p>
                    <p className="text-lg font-black text-slate-600">R$ {previousBalance.toFixed(2)}</p>
                  </div>
                  
                  {cashRegister !== 'CAIXA_CANTINA' && (
                    <>
                      <div className="space-y-1 border-l border-slate-200 pl-3">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Mensalidades Líquido</p>
                        <p className="text-lg font-black text-emerald-600">+ R$ {totalInstallments.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1 border-l border-slate-200 pl-3">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Entradas (Avulsas)</p>
                        <p className="text-lg font-black text-emerald-600">+ R$ {entriesCount.toFixed(2)}</p>
                      </div>
                    </>
                  )}

                  <div className={cn("space-y-1", cashRegister === 'CAIXA_CANTINA' ? "border-l border-slate-200 pl-3" : "border-l border-slate-200 pl-3")}>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Saídas</p>
                    <p className="text-lg font-black text-red-600">- R$ {withdrawalsCount.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1 border-l border-slate-200 pl-3">
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest leading-none">Resultado do Mês</p>
                    <p className={cn("text-lg font-black", (cashRegister === 'CAIXA_CANTINA' ? (entriesCount - withdrawalsCount) : (totalInstallments + entriesCount - withdrawalsCount)) >= 0 ? "text-petrol" : "text-red-500")}>
                      R$ {(cashRegister === 'CAIXA_CANTINA' ? (entriesCount - withdrawalsCount) : (totalInstallments + entriesCount - withdrawalsCount)).toFixed(2)}
                    </p>
                  </div>
                  
                  {cashRegister !== 'CAIXA_CANTINA' && (
                    <div className="space-y-1 border-l-2 border-slate-300 pl-3 bg-white p-2 -my-2 rounded-lg shadow-sm">
                      <p className="text-[9px] font-black uppercase text-slate-700 tracking-widest underline">Saldo Final Período</p>
                      <p className="text-xl font-black text-navy leading-none mt-1">R$ {saldoFinal.toFixed(2)}</p>
                    </div>
                  )}
               </div>

               {(cashRegister === 'ALL' || cashRegister === 'CAIXA_ADMINISTRATIVO') && (
                 <div className="space-y-4">
                   <h3 className="font-black text-navy uppercase text-sm bg-slate-50 p-2 border-l-4 border-navy">Recebimento de Mensalidades (Detalhamento)</h3>
                   {installments.length > 0 ? (
                    <table className="w-full text-left text-[10px] border border-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="p-2 border-b border-slate-200 font-black uppercase text-[8px] w-20">Data</th>
                          <th className="p-2 border-b border-slate-200 font-black uppercase text-[8px]">Aluno / Observação</th>
                          <th className="p-2 border-b border-slate-200 font-black uppercase text-[8px] text-center">Parcela</th>
                          <th className="p-2 border-b border-slate-200 font-black uppercase text-[8px] text-right">V. Integral</th>
                          <th className="p-2 border-b border-slate-200 font-black uppercase text-[8px] text-right">Desconto</th>
                          <th className="p-2 border-b border-slate-200 font-black uppercase text-[8px] text-right">V. Recebido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((inst, idx) => (
                           <tr key={idx} className="border-b border-slate-100">
                             <td className="p-2">{inst.paymentDate?.split('-').reverse().join('/')}</td>
                             <td className="p-2 font-bold uppercase text-slate-700">
                                {inst.studentName}
                                {inst.discountValue > 0 && <span className="text-[7px] text-amber-500 font-black ml-2 tracking-tighter">({inst.nomeDesconto || 'Bolsa'})</span>}
                             </td>
                             <td className="p-2 text-center text-slate-500">{inst.parcelNumber}/{inst.totalParcels}</td>
                             <td className="p-2 text-right">R$ {Number(inst.baseValue || 0).toFixed(2)}</td>
                             <td className="p-2 text-right text-amber-600">- R$ {(Number(inst.baseValue || 0) - Number(inst.finalPaidValue || 0)).toFixed(2)}</td>
                             <td className="p-2 text-right font-black text-navy">R$ {Number(inst.finalPaidValue).toFixed(2)}</td>
                           </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-black">
                         <tr>
                            <td colSpan={5} className="p-2 text-right uppercase text-[8px]">Total Líquido Recebido em Mensalidades:</td>
                            <td className="p-2 text-right text-navy">R$ {totalInstallments.toFixed(2)}</td>
                         </tr>
                      </tfoot>
                    </table>
                 ) : (
                    <p className="text-xs text-slate-400 italic">Nenhum pagamento de mensalidade no período.</p>
                 )}
               </div>
               )}

               <div className="space-y-4">
                 <h3 className="font-black text-petrol uppercase text-sm bg-slate-50 p-2 border-l-4 border-petrol">Outras Movimentações (Caixas)</h3>
                 {transactions.length > 0 ? (
                    <table className="w-full text-left text-xs border border-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="p-2 border-b border-slate-200 font-bold uppercase text-[9px] w-24">Data</th>
                          <th className="p-2 border-b border-slate-200 font-bold uppercase text-[9px]">Descrição</th>
                          <th className="p-2 border-b border-slate-200 font-bold uppercase text-[9px]">Fonte</th>
                          <th className="p-2 border-b border-slate-200 font-bold uppercase text-[9px] text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t, idx) => (
                           <tr key={idx} className="border-b border-slate-100">
                             <td className="p-2">{t.date?.split('-').reverse().join('/')}</td>
                             <td className="p-2 font-medium text-slate-700">
                                {t.description}
                                {t.teacherName && <span className="block text-[8px] text-slate-400 uppercase font-black tracking-tight">{t.isTeacherPayment ? 'Professor: ' : 'Beneficiário: '}{t.teacherName}</span>}
                             </td>
                             <td className="p-2 text-[10px] text-slate-500">{t.source}</td>
                             <td className={cn("p-2 text-right font-black", (t.type === 'ENTRY' || (!t.type && Number(t.amount) > 0)) ? 'text-emerald-600' : 'text-red-600')}>
                               {t.type === 'WITHDRAWAL' || (!t.type && Number(t.amount) < 0) ? '-' : ''}R$ {Math.abs(Number(t.amount || 0)).toFixed(2)}
                             </td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                 ) : (
                    <p className="text-xs text-slate-400 italic">Nenhuma movimentação extra no período.</p>
                 )}
               </div>

               <div className="pt-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest no-print">
                 Relatório gerado em {new Date().toLocaleString('pt-BR')} por {profile.name}
               </div>

               <div className="pt-24 flex justify-around">
                  <div className="w-64 border-t border-black pt-2 text-center">
                    <p className="text-xs font-black uppercase">Responsável Financeiro</p>
                  </div>
                  <div className="w-64 border-t border-black pt-2 text-center">
                    <p className="text-xs font-black uppercase">William Carvalho</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Coordenador</p>
                  </div>
                  <div className="w-64 border-t border-black pt-2 text-center">
                    <p className="text-xs font-black uppercase">Diretoria</p>
                  </div>
               </div>

             </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
