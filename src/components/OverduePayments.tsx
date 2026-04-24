import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  collection, 
  query, 
  onSnapshot, 
  where,
  orderBy,
  limit,
  deleteDoc,
  doc,
  writeBatch,
  addDoc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  TrendingDown, 
  AlertCircle, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Phone, 
  MessageSquare, 
  Mail,
  ArrowRight,
  Loader2,
  AlertTriangle,
  DollarSign,
  Clock,
  BarChart3,
  Handshake,
  Trash2,
  Plus,
  CheckCircle2,
  X,
  Download
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface OverdueInstallment {
  id: string;
  studentId: string;
  studentName: string;
  baseValue: number;
  discount: number;
  dueDate: string;
  status: 'Pendente' | 'Pago' | 'Late';
  studentPhone?: string;
  studentEmail?: string;
}

export const OverduePayments: React.FC = () => {
  const { profile, nucleo, user } = useAuth();
  const [installments, setInstallments] = useState<OverdueInstallment[]>([]);
  const [allPending, setAllPending] = useState<OverdueInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  
  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 20);
  };
  const [daysFilter, setDaysFilter] = useState<number | 'all'>('all');
  const [includeAllPending, setIncludeAllPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);
  const [negotiationStep, setNegotiationStep] = useState<'options' | 'acordo'>('options');
  
  // Acordo Form State
  const [acordoData, setAcordoData] = useState({
    numParcels: 1,
    firstDueDate: new Date().toISOString().split('T')[0],
    totalValue: 0
  });

  const calculatePenalties = (inst: OverdueInstallment) => {
    const netValue = inst.baseValue - inst.discount;
    const dueDate = new Date(inst.dueDate + 'T23:59:59');
    const today = new Date();
    
    const diffTime = Math.abs(today.getTime() - dueDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const fine = netValue * 0.02; // 2% Fixed Fine
    const monthlyInterestRate = 0.01; // 1% per month
    const dailyInterestRate = monthlyInterestRate / 30;
    const interest = netValue * (dailyInterestRate * diffDays);

    return {
      netValue,
      fine,
      interest,
      total: netValue + fine + interest,
      daysOverdue: diffDays > 0 ? diffDays : 0
    };
  };

  const selectedInstallments = useMemo(() => 
    installments.filter(inst => selectedIds.has(inst.id)),
  [installments, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedInstallments.reduce((acc, inst) => {
      const { total } = calculatePenalties(inst);
      return acc + total;
    }, 0);
  }, [selectedInstallments]);

  useEffect(() => {
    if (isNegotiationOpen) {
      setAcordoData(prev => ({ ...prev, totalValue: selectedTotal }));
    }
  }, [isNegotiationOpen, selectedTotal]);

  useEffect(() => {
    if (!profile || !nucleo || !user) return;
    
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    let q = query(
      collection(db, 'financial_installments'),
      where('nucleoId', '==', nucleo),
      orderBy('dueDate', 'asc')
    );

    if (profile?.poloId) {
      q = query(
        collection(db, 'financial_installments'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('dueDate', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OverdueInstallment[];
      
      setAllPending(list.filter(inst => inst.status === 'Pendente' || inst.status === 'Late'));

      const overdueList = list.filter(inst => 
        inst.status === 'Late' || (inst.status === 'Pendente' && inst.dueDate < today)
      );

      setInstallments(overdueList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'financial_installments');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const [communicationSettings, setCommunicationSettings] = useState<any>(null);

  useEffect(() => {
    if (!nucleo) return;
    const unsub = onSnapshot(doc(db, 'settings', `financial_hub_${nucleo || 'default'}`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCommunicationSettings({
          whatsappProvider: data.whatsappApi?.mode || 'web',
          apiUrl: data.whatsappApi?.apiUrl || '',
          apiToken: data.whatsappApi?.apiToken || '',
          templateLate: data.messageTemplates?.late || ''
        });
      }
    });
    return () => unsub();
  }, [nucleo]);

  const handleMassBilling = async () => {
    if (selectedIds.size === 0) {
      alert('Selecione pelo menos um aluno para cobrança.');
      return;
    }

    const isApiEnabled = communicationSettings?.whatsappProvider === 'api';
    
    let loopDelay = 0;
    let apiSentCount = 0;

    for (const inst of selectedInstallments) {
      if (inst.studentPhone) {
        const { total, daysOverdue } = calculatePenalties(inst);
        const cleanPhone = inst.studentPhone.replace(/\D/g, '');
        
        let template = communicationSettings?.templateLate || 'Olá, [NOME_DO_ALUNO]! Notamos que sua mensalidade com vencimento em [VENCIMENTO] encontra-se em aberto. O valor atualizado com multas é de [VALOR]. Por favor, entre em contato para regularizar.';
        
        // Substituir variáveis
        template = template.replace(/\[NOME_DO_ALUNO\]/g, inst.studentName);
        template = template.replace(/\[VENCIMENTO\]/g, new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR'));
        template = template.replace(/\[VALOR\]/g, formatCurrency(total));
        template = template.replace(/\[LINK_PAGAMENTO\]/g, '');

        if (cleanPhone) {
          const communicationMsg = `Cobrado dia ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

          try {
            // we use the same field lastCommunication on financial_installments
            await updateDoc(doc(db, 'financial_installments', inst.id), {
              lastCommunication: communicationMsg
            });
          } catch (e) {
            console.warn("Could not log communication:", e);
          }

          if (isApiEnabled && communicationSettings.apiUrl) {
            try {
              await fetch(communicationSettings.apiUrl, { 
                method: 'POST', 
                headers: {
                  'Content-Type': 'application/json',
                  ...(communicationSettings.apiToken ? { 'Authorization': `Bearer ${communicationSettings.apiToken}` } : {})
                },
                body: JSON.stringify({ number: '55' + cleanPhone, text: template }) 
              });
              apiSentCount++;
            } catch (err) {
              console.error('Erro na API WhatsApp:', err);
            }
          } else {
            // WhatsApp Web Fallback
            setTimeout(() => {
               window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(template)}`, '_blank');
            }, loopDelay);
            loopDelay += 1500; // Dá um respiro entre as abas
          }
        }
      }
    }

    if (apiSentCount > 0) {
      alert(`${apiSentCount} mensagens enviadas via API!`);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const handleClearDebt = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'financial_installments', id));
      });
      await batch.commit();
      setSelectedIds(new Set());
      setIsNegotiationOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'financial_installments');
    }
  };

  const handleCreateAcordo = async () => {
    if (selectedIds.size === 0 || acordoData.numParcels < 1) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Delete old installments
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'financial_installments', id));
      });

      // 2. Create new installments
      const student = selectedInstallments[0]; 
      const parcelValue = acordoData.totalValue / acordoData.numParcels;
      
      for (let i = 0; i < acordoData.numParcels; i++) {
        const dueDate = new Date(acordoData.firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        const newDocRef = doc(collection(db, 'financial_installments'));
        batch.set(newDocRef, {
          studentId: student.studentId,
          studentName: student.studentName,
          studentPhone: student.studentPhone || '',
          studentEmail: student.studentEmail || '',
          studentMatricula: (student as any).studentMatricula || '',
          baseValue: parcelValue,
          discount: 0,
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'Pendente',
          isAcordo: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      setSelectedIds(new Set());
      setIsNegotiationOpen(false);
      setNegotiationStep('options');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_installments');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const baseList = includeAllPending ? allPending : installments;
  const filtered = baseList.filter(inst => {
    const matchesSearch = inst.studentName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (daysFilter === 'all') return true;
    
    const { daysOverdue } = calculatePenalties(inst);
    if (daysFilter === 5) return daysOverdue >= 5 && daysOverdue < 15;
    if (daysFilter === 15) return daysOverdue >= 15 && daysOverdue < 30;
    if (daysFilter === 30) return daysOverdue >= 30;
    
    return true;
  });

  const stats = useMemo(() => {
    return filtered.reduce((acc, curr) => {
      const { total } = calculatePenalties(curr);
      acc.totalOverdue += total;
      acc.count += 1;
      return acc;
    }, { totalOverdue: 0, count: 0 });
  }, [filtered]);

  const handleExportExcel = () => {
    const data = filtered.map(inst => {
      const { total, daysOverdue } = calculatePenalties(inst);
      return {
        'Nome do Aluno': inst.studentName.trim(),
        'Telefone/WhatsApp': inst.studentPhone || '',
        'Status': daysOverdue > 0 ? 'Atrasado' : 'Pendente',
        'Dias de Atraso': daysOverdue,
        'Valor da Dívida': Number(total.toFixed(2))
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inadimplentes - Call Center");
    XLSX.writeFile(workbook, `Inadimplentes_CallCenter_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase flex items-center gap-3">
            <TrendingDown className="text-red-500" size={36} />
            Gestão de Inadimplência
          </h1>
          <p className="text-slate-500 font-medium mt-1">Negociação de dívidas e acordos "Limpa Nome".</p>
        </div>
        <div className="flex gap-3">
          {selectedIds.size > 0 && (
            <Button 
              onClick={() => setIsNegotiationOpen(true)}
              className="h-14 px-8 rounded-2xl bg-petrol hover:bg-petrol-dark text-white font-black uppercase tracking-widest flex items-center gap-3 animate-in zoom-in duration-200 shadow-xl shadow-petrol/20"
            >
              <Handshake size={20} /> Negociar ({selectedIds.size})
            </Button>
          )}
          <Button 
            onClick={handleExportExcel}
            variant="outline" 
            className="h-14 px-6 rounded-2xl border-2 border-slate-200 text-slate-600 font-black uppercase tracking-widest flex items-center gap-2"
          >
            <Download size={20} /> Excel (Call Center)
          </Button>
          <Button 
            onClick={handleMassBilling}
            variant="outline" 
            className="h-14 px-6 rounded-2xl border-2 border-slate-200 text-slate-600 font-black uppercase tracking-widest flex items-center gap-2"
          >
            <MessageSquare size={20} /> Cobrança em Massa (WhatsApp)
          </Button>
        </div>
      </div>

      {/* Negotiation Modal */}
      <Dialog open={isNegotiationOpen} onOpenChange={setIsNegotiationOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
          <div className="bg-navy p-8 text-white flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-petrol rounded-2xl">
                <Handshake size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Negociação de Dívida</h2>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Acordo de Pagamento</p>
              </div>
            </div>
            <button onClick={() => setIsNegotiationOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6">
            {negotiationStep === 'options' ? (
              <>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Dívida Acumulada Selecionada:</span>
                    <span className="text-2xl font-black text-red-600">{formatCurrency(selectedTotal)}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Esta negociação afetará {selectedIds.size} parcela(s) do aluno <span className="font-bold text-navy">{selectedInstallments[0]?.studentName}</span>.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => setNegotiationStep('acordo')}
                    className="flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-petrol group transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-petrol/10 text-petrol rounded-2xl group-hover:bg-petrol group-hover:text-white transition-colors">
                        <Plus size={24} />
                      </div>
                      <div>
                        <p className="font-black text-navy uppercase text-sm">Gerar Novo Acordo</p>
                        <p className="text-xs text-slate-400 font-medium">Substituir dívida por novas parcelas.</p>
                      </div>
                    </div>
                    <ArrowRight size={20} className="text-slate-300 group-hover:text-petrol transition-colors" />
                  </button>

                  <button 
                    onClick={handleClearDebt}
                    className="flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-red-500 group transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-50 text-red-500 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                        <Trash2 size={24} />
                      </div>
                      <div>
                        <p className="font-black text-navy uppercase text-sm">Limpar Dívida (Perdão)</p>
                        <p className="text-xs text-slate-400 font-medium">Apagar registros sem gerar cobrança.</p>
                      </div>
                    </div>
                    <ArrowRight size={20} className="text-slate-300 group-hover:text-red-500 transition-colors" />
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Valor Total do Acordo (R$)</Label>
                    <Input 
                      type="number"
                      className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-black text-lg"
                      value={acordoData.totalValue}
                      onChange={(e) => setAcordoData({...acordoData, totalValue: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nº de Parcelas</Label>
                      <Input 
                        type="number"
                        min="1"
                        className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                        value={acordoData.numParcels}
                        onChange={(e) => setAcordoData({...acordoData, numParcels: parseInt(e.target.value) || 1})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">1º Vencimento</Label>
                      <Input 
                        type="date"
                        className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                        value={acordoData.firstDueDate}
                        onChange={(e) => setAcordoData({...acordoData, firstDueDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-petrol/5 p-6 rounded-3xl border border-petrol/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-petrol uppercase tracking-widest">Valor por Parcela:</span>
                    <span className="text-xl font-black text-petrol">
                      {formatCurrency(acordoData.totalValue / (acordoData.numParcels || 1))}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => setNegotiationStep('options')}>Voltar</Button>
                  <Button className="flex-1 h-14 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest" onClick={handleCreateAcordo}>
                    Confirmar Acordo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Dívida Acumulada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-600 tracking-tight">{formatCurrency(stats.totalOverdue)}</div>
            <div className="flex items-center gap-2 mt-2 text-red-500/60 text-xs font-bold">
              <AlertTriangle size={14} />
              <span>Inclui multa de 2% e juros de 1% a.m.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alunos Inadimplentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-navy tracking-tight">{stats.count} Alunos</div>
            <div className="flex items-center gap-2 mt-2 text-slate-400 text-xs font-bold">
              <User size={14} />
              <span>Parcelas vencidas no sistema</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy border-none shadow-xl shadow-navy/20 rounded-[2.5rem] overflow-hidden group text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/40 uppercase tracking-widest">Ticket Médio Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white tracking-tight">
              {formatCurrency(stats.count > 0 ? stats.totalOverdue / stats.count : 0)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-white/40 text-xs font-bold">
              <BarChart3 size={14} />
              <span>Média por aluno devedor</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Buscar por nome do aluno inadimplente..." 
            className="pl-12 h-14 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 w-full md:w-auto overflow-x-auto">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 whitespace-nowrap">Régua:</span>
          {[
            { label: 'Todos', value: 'all' },
            { label: '5+ Dias', value: 5 },
            { label: '15+ Dias', value: 15 },
            { label: '30+ Dias', value: 30 }
          ].map((filter) => (
            <button
              key={filter.label}
              onClick={() => setDaysFilter(filter.value as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                daysFilter === filter.value 
                  ? "bg-red-500 text-white shadow-lg shadow-red-100" 
                  : "text-slate-400 hover:bg-slate-100"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 whitespace-nowrap h-14">
          <input
            type="checkbox"
            id="includePending"
            checked={includeAllPending}
            onChange={(e) => setIncludeAllPending(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-petrol focus:ring-petrol"
          />
          <Label htmlFor="includePending" className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">
            A Vencer
          </Label>
        </div>

        <Button variant="outline" className="h-14 w-14 rounded-2xl border-slate-100 text-slate-400 shrink-0">
          <Filter size={20} />
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="w-12 p-6">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded-lg border-2 border-slate-200 text-red-500 focus:ring-red-500 cursor-pointer"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Aluno / Contato</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Vencimento Original</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Dias em Atraso</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Valor com Juros/Multa</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <td colSpan={6} className="p-20 text-center">
                  <Loader2 className="w-10 h-10 text-red-500 animate-spin mx-auto" />
                </td>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <td colSpan={6} className="p-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Nenhum registro de inadimplência encontrado.</td>
              </TableRow>
            ) : (
              filtered.slice(0, visibleCount).map((inst) => {
                const { total, daysOverdue, fine, interest } = calculatePenalties(inst);
                return (
                  <TableRow key={inst.id} className={cn(
                    "hover:bg-red-50/30 transition-all group",
                    selectedIds.has(inst.id) && "bg-red-50/50"
                  )}>
                    <TableCell className="p-6">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded-lg border-2 border-slate-200 text-red-500 focus:ring-red-500 cursor-pointer"
                        checked={selectedIds.has(inst.id)}
                        onChange={() => handleToggleSelect(inst.id)}
                      />
                    </TableCell>
                    <TableCell className="p-6">
                      <p className="font-black text-navy uppercase text-sm tracking-tight">{inst.studentName}</p>
                      <div className="flex gap-2 mt-1">
                        {inst.studentPhone && (
                          <button 
                            onClick={async () => {
                              const cleanPhone = inst.studentPhone?.replace(/\D/g, '');
                              const { total, daysOverdue } = calculatePenalties(inst);
                              let template = communicationSettings?.templateLate || `Olá, [NOME_DO_ALUNO]! Notamos um atraso em sua mensalidade. O valor atualizado é [VALOR]. Vamos regularizar?`;
                              
                              template = template.replace(/\[NOME_DO_ALUNO\]/g, inst.studentName);
                              template = template.replace(/\[VENCIMENTO\]/g, new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR'));
                              template = template.replace(/\[VALOR\]/g, formatCurrency(total));
                              template = template.replace(/\[LINK_PAGAMENTO\]/g, '');

                              const message = encodeURIComponent(template);
                              
                              const communicationMsg = `Cobrado dia ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

                              try {
                                await updateDoc(doc(db, 'financial_installments', inst.id), {
                                  lastCommunication: communicationMsg
                                });
                              } catch (e) {
                                console.warn("Could not log communication:", e);
                              }

                              window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
                            }}
                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                            title="Enviar WhatsApp"
                          >
                            <MessageSquare size={14} />
                          </button>
                        )}
                        <button className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                          <Phone size={14} />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="p-6">
                      <p className="font-bold text-red-600 text-xs">
                        {new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </TableCell>
                    <TableCell className="p-6">
                      <div className="flex flex-col items-start gap-2">
                        {daysOverdue > 0 ? (
                          <Badge className="bg-red-100 text-red-700 font-black text-[10px] uppercase px-3 py-1 rounded-full border-none w-fit">
                            {daysOverdue} Dias
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 font-black text-[10px] uppercase px-3 py-1 rounded-full border-none w-fit">
                            A Vencer
                          </Badge>
                        )}
                        {(inst as any).lastCommunication && (
                           <Badge variant="outline" className="text-[8px] font-bold bg-slate-50 border-slate-200 text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis px-2 py-0.5 max-w-[120px]">
                             {(inst as any).lastCommunication}
                           </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-6">
                      <p className="font-black text-red-600 text-sm">{formatCurrency(total)}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Original: {formatCurrency(inst.baseValue - inst.discount)}</p>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest h-10 px-6 rounded-xl"
                          onClick={() => {
                            setSelectedIds(new Set([inst.id]));
                            setIsNegotiationOpen(true);
                          }}
                        >
                          Negociar
                        </Button>
                        <Button size="sm" className="bg-navy hover:bg-navy-dark text-[10px] font-black uppercase tracking-widest h-10 px-6 rounded-xl">
                          Ver Detalhes
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        
        {visibleCount < filtered.length && (
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
      </div>
    </div>
  );
};
