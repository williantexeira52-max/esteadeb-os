import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  getDoc,
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  where,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import SignatureCanvas from 'react-signature-canvas';
import { 
  Wallet, 
  Plus, 
  Minus, 
  History, 
  ShoppingBag,
  CreditCard,
  QrCode,
  CheckCircle2, 
  AlertCircle, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Calculator, 
  Coffee, 
  School,
  Banknote,
  Search,
  Calendar,
  User,
  FileText,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  X,
  Edit,
  Trash2,
  Printer,
  PenTool
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { CashClosingPrintModal } from './CashClosingPrintModal';

interface CashTransaction {
  id: string;
  type: 'ENTRY' | 'WITHDRAWAL';
  amount: number;
  description: string;
  recipientCpfCnpj?: string;
  date: string;
  createdAt: any;
  createdBy: string;
  isTeacherPayment?: boolean;
  teacherName?: string;
  teacherSignature?: string;
}

interface Reconciliation {
  id: string;
  physicalAmount: number;
  systemBalance: number;
  difference: number;
  timestamp: any;
  checkedBy: string;
}

export const CashManagement: React.FC = () => {
  const { profile, nucleo, systemConfig, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'school' | 'snack'>('school');
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [lastReconciliation, setLastReconciliation] = useState<Reconciliation | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [isReportPrintOpen, setIsReportPrintOpen] = useState(false);
  const [isPOSModalOpen, setIsPOSModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, description: string } | null>(null);
  const sigPad = React.useRef<any>(null);

  const [transactionForm, setTransactionForm] = useState({
    type: 'ENTRY' as 'ENTRY' | 'WITHDRAWAL',
    amount: 0,
    description: '',
    recipientCpfCnpj: '',
    date: new Date().toISOString().split('T')[0],
    isTeacherPayment: false,
    teacherName: '',
    teacherSignature: ''
  });

  const [posForm, setPosForm] = useState({
    studentId: '',
    extraId: '',
    paymentMethod: 'Dinheiro',
    date: new Date().toISOString().split('T')[0]
  });

  const [physicalAmountInput, setPhysicalAmountInput] = useState<number>(0);
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0,
    '1.00': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0
  });

  // Reset denominations when tab changes to ensure independent counts
  useEffect(() => {
    setDenominations({
      '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0,
      '1.00': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0
    });
  }, [activeTab]);

  const physicalTotal = useMemo(() => {
    return Object.entries(denominations).reduce((acc: number, entry) => {
      const [val, qty] = entry;
      return acc + (parseFloat(val) * (qty as number));
    }, 0);
  }, [denominations]);

  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const collectionName = activeTab === 'school' ? 'school_cash' : 'snack_cash';
  const reconCollectionName = activeTab === 'school' ? 'school_reconciliations' : 'snack_reconciliations';

  useEffect(() => {
    if (!nucleo || !user || !profile) return;
    setLoading(true);
    let q = query(
      collection(db, collectionName), 
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CashTransaction[];
      
      list = list.filter((i: any) => !i.nucleoId || i.nucleoId === nucleo);

      if (profile?.poloId) {
         list = list.filter((i: any) => i.poloId === profile.poloId);
      }

      setTransactions(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    });

    const qRecon = query(
      collection(db, reconCollectionName),
      where('nucleoId', '==', nucleo),
      ...(profile?.poloId ? [where('poloId', '==', profile.poloId)] : []),
      orderBy('timestamp', 'desc'), 
      limit(1)
    );

    const unsubscribeRecon = onSnapshot(qRecon, (snapshot) => {
      if (!snapshot.empty) {
        setLastReconciliation({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Reconciliation);
      } else {
        setLastReconciliation(null);
      }
    });

    const qStudents = query(
      collection(db, 'students'), 
      where('nucleoId', '==', nucleo),
      where('status', '==', 'Ativo'), 
      orderBy('name', 'asc')
    );
    const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qExtras = query(
      collection(db, 'financial_extras'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribeExtras = onSnapshot(qExtras, (snapshot) => {
      setExtras(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeRecon();
      unsubscribeStudents();
      unsubscribeExtras();
    };
  }, [activeTab, collectionName, reconCollectionName, nucleo, profile, user]);

  const totals = useMemo(() => {
    return transactions.reduce((acc, curr) => {
      if (curr.type === 'ENTRY') {
        acc.entries += curr.amount;
        acc.balance += curr.amount;
      } else {
        acc.withdrawals += curr.amount;
        acc.balance -= curr.amount;
      }
      return acc;
    }, { entries: 0, withdrawals: 0, balance: 0 });
  }, [transactions]);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    let signature = transactionForm.teacherSignature;
    if (transactionForm.isTeacherPayment && sigPad.current && !sigPad.current.isEmpty()) {
      signature = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
    }

    try {
      const data = {
        ...transactionForm,
        teacherSignature: signature,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.name || 'Sistema',
        nucleoId: nucleo
      };

      if (editingTransactionId) {
        await updateDoc(doc(db, collectionName, editingTransactionId), {
          ...data,
          poloId: profile?.poloId || null,
          poloName: profile?.poloName || 'MATRIZ'
        });
        addToast('Transação atualizada com sucesso!', 'success');
      } else {
        await addDoc(collection(db, collectionName), {
          ...data,
          poloId: profile?.poloId || null,
          poloName: profile?.poloName || 'MATRIZ',
          createdAt: serverTimestamp(),
          createdBy: profile?.name || 'Sistema'
        });
        addToast('Transação registrada com sucesso!', 'success');
      }

      setIsTransactionModalOpen(false);
      setEditingTransactionId(null);
      setTransactionForm({
        type: 'ENTRY',
        amount: 0,
        description: '',
        recipientCpfCnpj: '',
        date: new Date().toISOString().split('T')[0],
        isTeacherPayment: false,
        teacherName: '',
        teacherSignature: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, collectionName);
      addToast('Erro ao processar transação.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTransaction = (transaction: CashTransaction) => {
    setEditingTransactionId(transaction.id);
    setTransactionForm({
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      recipientCpfCnpj: transaction.recipientCpfCnpj || '',
      date: transaction.date,
      isTeacherPayment: transaction.isTeacherPayment || false,
      teacherName: transaction.teacherName || '',
      teacherSignature: transaction.teacherSignature || ''
    });
    setIsTransactionModalOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (!deleteConfirm) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, collectionName, deleteConfirm.id));
      addToast('Transação excluída com sucesso!', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName);
      addToast('Erro ao excluir transação.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const printTeacherReceipt = (transaction: CashTransaction) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amount);
    const day = new Date(transaction.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    const receiptHtml = (title: string, copyType: string) => `
      <div class="receipt">
        <div class="header">
          <div class="logo-box">
             ${systemConfig?.logoUrl ? 
               `<img src="${systemConfig.logoUrl}" style="height: 70px; width: auto; object-fit: contain;" />` : 
               `<div class="placeholder-logo">E</div>`
             }
          </div>
          <div class="header-text">
             <div class="school-name">${systemConfig?.schoolName || 'ESTEADEB'}</div>
             <div class="sub-name">${systemConfig?.legalText || 'Escola Teológica das Assembleias de Deus no Brasil'}</div>
          </div>
          <div class="receipt-info">
             <div class="title">${title}</div>
             <div class="copy-tag">${copyType}</div>
          </div>
        </div>
        
        <div class="content">
          <p>Recebi de <strong class="uppercase">${systemConfig?.schoolName || 'ESCOLA TEOLÓGICA DAS ASSEMBLEIAS DE DEUS NO BRASIL'}</strong>,</p>
          <p>A importância de <strong class="amount">${formattedAmount}</strong></p>
          <p>Referente a: <strong>${transaction.description}</strong>.</p>
          <p style="margin-top: 20px; font-style: italic; color: #64748b; border-top: 1px solid #f1f5f9; pt: 10px;">Para maior clareza, firmo o presente.</p>
          <p style="margin-top: 5px; font-weight: 900; color: #0f172a;">Natal/RN, ${day}</p>
        </div>

        <div class="signatures">
          <div class="sig-container">
            ${transaction.teacherSignature ? `<img src="${transaction.teacherSignature}" class="sig-img" />` : '<div class="sig-blank"></div>'}
            <div class="sig-line">
              <span class="uppercase">${transaction.teacherName || 'Professor'}</span><br/>
              PROFESSOR(A) - CPF: ${transaction.recipientCpfCnpj || '---'}
            </div>
          </div>
          <div class="sig-container">
            <div class="sig-blank"></div>
            <div class="sig-line">RESPONSÁVEL FINANCEIRO / ESTEADEB</div>
          </div>
        </div>
      </div>
    `;

    win.document.write(`
      <html>
        <head>
          <title>Recibo de Pagamento - Professor</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e3a8a; background: #f8fafc; }
            .receipt { 
              background: white;
              border: 1px solid #e2e8f0; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto; 
              position: relative;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              min-height: 440px;
              display: flex;
              flex-direction: column;
            }
            .header { display: flex; items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
            .logo-box { width: 100px; }
            .header-text { flex: 1; text-align: center; padding: 0 20px; }
            .school-name { font-size: 24px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; line-height: 1; }
            .sub-name { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
            .receipt-info { width: 180px; text-align: right; }
            .title { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
            .copy-tag { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #64748b; margin-top: 4px; border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 4px; display: inline-block; }
            
            .placeholder-logo { width: 50px; height: 50px; background: #e2e8f0; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: #94a3b8; }
            
            .content { flex: 1; line-height: 1.8; font-size: 14px; }
            .amount { font-weight: 900; color: #1e3a8a; background: #eff6ff; padding: 2px 8px; border-radius: 4px; }
            
            .signatures { display: flex; gap: 40px; margin-top: 30px; }
            .sig-container { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; }
            .sig-img { max-height: 60px; object-fit: contain; mix-blend-multiply: multiply; margin-bottom: 5px; }
            .sig-blank { height: 60px; }
            .sig-line { border-top: 1px solid #0f172a; width: 100%; padding-top: 10px; font-size: 10px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
            .uppercase { text-transform: uppercase; }
            
            @media print { 
              .no-print { display: none; } 
              body { padding: 0; background: white; }
              .receipt { box-shadow: none; border: 1px solid #eee; page-break-inside: avoid; margin-bottom: 10px; min-height: 400px; } 
              .print-divider { margin: 20px 0; border-top: 1px dashed #cbd5e1; position: relative; }
              .print-divider::after { content: '✂ RECORTAR AQUI'; position: absolute; top: -8px; left: 50%; translate: -50%; background: white; padding: 0 10px; font-size: 9px; font-weight: 900; color: #94a3b8; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: center; padding: 20px;">
            <button onclick="window.print()" style="padding: 14px 40px; background: #1e3a8a; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 10px 15px -3px rgba(30,58,138,0.3); font-size: 14px;">IMPRIMIR RECIBOS (2 VIAS)</button>
          </div>
          
          ${receiptHtml('Recibo do Professor', '1ª VIA - PROFESSOR')}

          <div class="print-divider"></div>

          ${receiptHtml('Recibo do Professor', '2ª VIA - ESCOLA')}
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleReconciliationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (physicalTotal <= 0) {
      addToast('A contagem física não pode ser zero. Preencha a tabela de denominações.', 'error');
      return;
    }

    setSaving(true);
    const difference = physicalTotal - totals.balance;
    try {
      await addDoc(collection(db, reconCollectionName), {
        physicalAmount: physicalTotal,
        systemBalance: totals.balance,
        difference,
        poloId: profile?.poloId || null,
        poloName: profile?.poloName || 'MATRIZ',
        timestamp: serverTimestamp(),
        checkedBy: profile?.name || 'Sistema'
      });
      addToast('Conferência realizada com sucesso!', 'success');
      setIsReconciliationModalOpen(false);
      setDenominations({
        '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0,
        '1.00': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, reconCollectionName);
      addToast('Erro ao salvar conferência.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSnackCredit = async () => {
    setSaving(true);
    try {
      const dbDate = new Date().toISOString().split('T')[0];
      
      // 1. Add ENTRY to Caixa Lanche
      await addDoc(collection(db, 'snack_cash'), {
        type: 'ENTRY',
        amount: 200,
        description: 'Liberação da Direção (Transferência do Caixa Escola)',
        date: dbDate,
        poloId: profile?.poloId || null,
        poloName: profile?.poloName || 'MATRIZ',
        createdAt: serverTimestamp(),
        createdBy: profile?.name || 'Direção',
        nucleoId: nucleo
      });

      // 2. Add WITHDRAWAL to Caixa Escola
      await addDoc(collection(db, 'school_cash'), {
        type: 'WITHDRAWAL',
        amount: 200,
        description: 'Fundo Lanche (Transferência para Caixa Lanche)',
        date: dbDate,
        poloId: profile?.poloId || null,
        poloName: profile?.poloName || 'MATRIZ',
        createdAt: serverTimestamp(),
        createdBy: profile?.name || 'Direção',
        nucleoId: nucleo
      });

      addToast('Transferência de R$ 200,00 realizada com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'snack_cash');
      addToast('Erro ao realizar transferência.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePOSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const student = students.find(s => s.id === posForm.studentId);
    const extra = extras.find(e => e.id === posForm.extraId);
    
    if (!student || !extra) {
      addToast('Selecione o aluno e o item.', 'error');
      setSaving(false);
      return;
    }

    try {
      // 1. Save to financial_sales
      await addDoc(collection(db, 'financial_sales'), {
        studentId: posForm.studentId,
        studentName: student.name,
        itemId: posForm.extraId,
        itemName: extra.name,
        amount: extra.value,
        paymentMethod: posForm.paymentMethod,
        poloId: profile?.poloId || null,
        poloName: profile?.poloName || 'MATRIZ',
        date: posForm.date,
        createdAt: serverTimestamp(),
        createdBy: profile?.name || 'Sistema'
      });

      // 2. If payment is 'Dinheiro', add to school_cash
      if (posForm.paymentMethod === 'Dinheiro') {
        await addDoc(collection(db, 'school_cash'), {
          type: 'ENTRY',
          amount: extra.value,
          description: `Venda: ${extra.name} - ${student.name}`,
          date: posForm.date,
          createdAt: serverTimestamp(),
          createdBy: profile?.name || 'Sistema',
          nucleoId: nucleo
        });
      }

      addToast('Venda registrada com sucesso!', 'success');
      setIsPOSModalOpen(false);
      setPosForm({
        studentId: '',
        extraId: '',
        paymentMethod: 'Dinheiro',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_sales');
      addToast('Erro ao registrar venda.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen relative">
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-red-50 text-red-500 rounded-full">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-navy uppercase tracking-tight">Excluir Transação</h3>
                <p className="text-sm font-medium text-slate-500 mt-2">
                  Deseja realmente excluir a transação: <br/>
                  <strong className="text-red-500">"{deleteConfirm.description}"</strong>?
                </p>
              </div>
              <div className="flex gap-3 w-full pt-4">
                <Button variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                <Button 
                  onClick={handleDeleteTransaction}
                  disabled={saving}
                  className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest"
                >
                  {saving ? <Loader2 className="animate-spin" /> : 'Excluir'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POS Modal */}
      {isPOSModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <ShoppingBag size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">🛒 Nova Venda / Taxa</h2>
              </div>
              <button onClick={() => setIsPOSModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePOSSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Aluno</label>
                <select 
                  required
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                  value={posForm.studentId}
                  onChange={(e) => setPosForm({...posForm, studentId: e.target.value})}
                >
                  <option value="">Selecione o Aluno</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Produto / Taxa</label>
                <select 
                  required
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                  value={posForm.extraId}
                  onChange={(e) => setPosForm({...posForm, extraId: e.target.value})}
                >
                  <option value="">Selecione o Item</option>
                  {extras.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({formatCurrency(e.value)})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                <select 
                  required
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                  value={posForm.paymentMethod}
                  onChange={(e) => setPosForm({...posForm, paymentMethod: e.target.value})}
                >
                  <option value="Dinheiro">Dinheiro (Espécie)</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Data da Venda</label>
                <Input 
                  type="date" required
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={posForm.date}
                  onChange={(e) => setPosForm({...posForm, date: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setIsPOSModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="animate-spin" /> : 'Finalizar Venda'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <DollarSign size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Nova Movimentação</h2>
              </div>
              <button onClick={() => setIsTransactionModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleTransactionSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Operação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransactionForm({...transactionForm, type: 'ENTRY'})}
                    className={cn(
                      "h-12 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                      transactionForm.type === 'ENTRY' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >
                    <ArrowUpCircle size={18} /> Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionForm({...transactionForm, type: 'WITHDRAWAL'})}
                    className={cn(
                      "h-12 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                      transactionForm.type === 'WITHDRAWAL' ? "bg-red-600 border-red-600 text-white" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >
                    <ArrowDownCircle size={18} /> Saída
                  </button>
                </div>
              </div>

              {transactionForm.type === 'WITHDRAWAL' && (
                <div className="flex items-center gap-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <input 
                    type="checkbox" 
                    id="isTeacher" 
                    className="w-4 h-4"
                    checked={transactionForm.isTeacherPayment}
                    onChange={(e) => setTransactionForm({...transactionForm, isTeacherPayment: e.target.checked})}
                  />
                  <label htmlFor="isTeacher" className="text-xs font-bold text-indigo-900 cursor-pointer">
                    É pagamento de Professor(a)?
                  </label>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                <Input 
                  type="number" step="0.01" required
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm({...transactionForm, amount: parseFloat(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <Input 
                  required
                  placeholder="Ex: Pagamento de fornecedor"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                />
              </div>

              {transactionForm.type === 'WITHDRAWAL' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      {transactionForm.isTeacherPayment ? 'Nome do Professor' : 'Beneficiário'}
                    </label>
                    <Input 
                      placeholder="Nome completo"
                      className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                      value={transactionForm.teacherName}
                      onChange={(e) => setTransactionForm({...transactionForm, teacherName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">CPF/CNPJ</label>
                    <Input 
                      placeholder="000.000.000-00"
                      className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                      value={transactionForm.recipientCpfCnpj}
                      onChange={(e) => setTransactionForm({...transactionForm, recipientCpfCnpj: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {transactionForm.isTeacherPayment && transactionForm.type === 'WITHDRAWAL' && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                    Assinatura do Professor
                    <button type="button" onClick={() => sigPad.current?.clear()} className="text-[9px] text-red-500 underline">Limpar</button>
                  </label>
                  <div className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-slate-50">
                    <SignatureCanvas 
                      ref={sigPad}
                      penColor='black'
                      canvasProps={{width: 380, height: 100, className: 'sigCanvas'}} 
                    />
                  </div>
                  <p className="text-[9px] text-slate-400">Assine dentro da área acima para validar o pagamento.</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                <Input 
                  type="date" required
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={transactionForm.date}
                  onChange={(e) => setTransactionForm({...transactionForm, date: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" 
                  onClick={() => {
                    setIsTransactionModalOpen(false);
                    setEditingTransactionId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="animate-spin" /> : editingTransactionId ? 'Salvar Alterações' : 'Registrar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconciliation Modal */}
      {isReconciliationModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <Calculator size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Conferência de Caixa</h2>
              </div>
              <button onClick={() => setIsReconciliationModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleReconciliationSubmit} className="p-8 space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Saldo no Sistema:</span>
                  <span className="font-bold text-navy">{formatCurrency(totals.balance)}</span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-navy mb-2">
                    <Banknote size={16} className="text-petrol" />
                    <span className="text-xs font-black uppercase tracking-widest">Tabela de Denominações</span>
                  </div>
                  
                  <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar border rounded-2xl border-slate-100">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow className="hover:bg-transparent border-slate-100">
                          <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Nota/Moeda</TableHead>
                          <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Qtd</TableHead>
                          <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys(denominations).sort((a, b) => parseFloat(b) - parseFloat(a)).map((val) => (
                          <TableRow key={val} className="hover:bg-slate-50/50 border-slate-50">
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[8px]",
                                  parseFloat(val) >= 2 ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                                )}>
                                  {parseFloat(val) >= 2 ? 'N' : 'M'}
                                </div>
                                <span className="font-bold text-slate-700 text-xs">R$ {parseFloat(val).toFixed(2)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <Input 
                                type="number"
                                min="0"
                                className="w-16 h-8 text-center font-bold bg-slate-50 border-none rounded-lg mx-auto"
                                value={denominations[val] || ''}
                                onChange={(e) => setDenominations({...denominations, [val]: parseInt(e.target.value) || 0})}
                              />
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <span className="font-black text-navy text-[11px]">
                                {formatCurrency(parseFloat(val) * (denominations[val] || 0))}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Físico:</span>
                    <span className="text-xl font-black text-navy">{formatCurrency(physicalTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Diferença:</span>
                    <span className={cn(
                      "font-black text-lg",
                      Math.abs(physicalTotal - totals.balance) < 0.01 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(physicalTotal - totals.balance)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 text-center">
                {Math.abs(physicalTotal - totals.balance) < 0.01 ? (
                  <div className="flex items-center gap-2 text-emerald-600 font-bold animate-in zoom-in duration-300">
                    <CheckCircle2 size={20} />
                    <span>O caixa bateu perfeitamente!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600 font-bold animate-in shake duration-300">
                    <AlertTriangle size={20} />
                    <span>Atenção: Quebra de Caixa detectada.</span>
                  </div>
                )}
              </div>

              <Button type="submit" disabled={saving} className="w-full h-14 bg-petrol hover:bg-petrol-dark text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-petrol/20">
                {saving ? <Loader2 className="animate-spin" /> : 'Confirmar Conferência'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Cash Closing Report Modal */}
      <CashClosingPrintModal isOpen={isReportPrintOpen} onClose={() => setIsReportPrintOpen(false)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Gestão de Fluxo de Caixa</h1>
          <p className="text-slate-500 font-medium mt-1">Controle de entradas e saídas em espécie (Dinheiro Físico).</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={() => setIsReportPrintOpen(true)}
            variant="outline"
            className="h-14 px-8 rounded-2xl border-2 border-slate-200 text-slate-600 font-black uppercase tracking-widest flex items-center gap-3"
          >
            <FileText size={20} /> Relatório de Caixa
          </Button>
          <Button 
            onClick={() => setIsPOSModalOpen(true)}
            className="h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-amber-200 flex items-center gap-3"
          >
            <ShoppingBag size={20} /> Nova Venda / Taxa
          </Button>
          <Button 
            onClick={() => setIsReconciliationModalOpen(true)}
            variant="outline"
            className="h-14 px-8 rounded-2xl border-2 border-slate-200 text-slate-600 font-black uppercase tracking-widest flex items-center gap-3"
          >
            <Calculator size={20} /> Conferência
          </Button>
          <Button 
            onClick={() => setIsTransactionModalOpen(true)}
            className="h-14 px-8 bg-petrol hover:bg-petrol-dark text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-petrol/20 flex items-center gap-3"
          >
            <Plus size={24} /> Nova Transação
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-8">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-16 w-full max-w-md">
          <TabsTrigger value="school" className="flex-1 rounded-xl font-black uppercase text-xs tracking-widest data-[state=active]:bg-navy data-[state=active]:text-white h-full flex items-center gap-2">
            <School size={18} /> Caixa Escola
          </TabsTrigger>
          <TabsTrigger value="snack" className="flex-1 rounded-xl font-black uppercase text-xs tracking-widest data-[state=active]:bg-navy data-[state=active]:text-white h-full flex items-center gap-2">
            <Coffee size={18} /> Caixa Lanche
          </TabsTrigger>
        </TabsList>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 text-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={120} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Entradas</p>
            <h3 className="text-3xl font-black text-emerald-600 tracking-tight">{formatCurrency(totals.entries)}</h3>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 text-red-600 group-hover:scale-110 transition-transform">
              <TrendingDown size={120} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Saídas</p>
            <h3 className="text-3xl font-black text-red-600 tracking-tight">{formatCurrency(totals.withdrawals)}</h3>
          </div>

          <div className="bg-navy p-8 rounded-[2.5rem] shadow-xl shadow-navy/20 border border-white/10 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 text-white group-hover:scale-110 transition-transform">
              <Wallet size={120} />
            </div>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Saldo Atual (Sistema)</p>
            <h3 className="text-3xl font-black text-white tracking-tight">{formatCurrency(totals.balance)}</h3>
          </div>
        </div>

        {/* Snack Cash Specific Rule */}
        {activeTab === 'snack' && (
          <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                <Coffee size={24} />
              </div>
              <div>
                <h4 className="font-black text-amber-900 uppercase text-sm tracking-tight">Transferência do Caixa Escola para Lanche</h4>
                <p className="text-amber-700/70 text-xs font-medium">Transferir R$ 200,00 do Caixa Escola para o caixa de lanche dos funcionários.</p>
              </div>
            </div>
            <Button 
              onClick={handleSnackCredit}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white px-8 h-12 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-amber-200"
            >
              {saving ? <Loader2 className="animate-spin" /> : 'Transferir R$ 200,00'}
            </Button>
          </div>
        )}

        {/* Reconciliation Status */}
        {lastReconciliation && (
          <div className={cn(
            "p-6 rounded-3xl border flex items-center justify-between",
            lastReconciliation.difference === 0 ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                lastReconciliation.difference === 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
              )}>
                {lastReconciliation.difference === 0 ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Última Conferência</p>
                <p className="font-bold">
                  {lastReconciliation.difference === 0 ? "Caixa Bateu" : `Diferença de ${formatCurrency(lastReconciliation.difference)}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Realizada por {lastReconciliation.checkedBy}</p>
              <p className="text-xs font-medium">{lastReconciliation.timestamp?.toDate().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-navy text-white rounded-xl">
                <History size={20} />
              </div>
              <h3 className="font-black text-navy uppercase tracking-tight">Histórico de Movimentações</h3>
            </div>
          </div>

          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Data / Hora</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Descrição / Recebedor</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Responsável</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Valor</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <td colSpan={5} className="p-20 text-center">
                    <Loader2 className="w-10 h-10 text-petrol animate-spin mx-auto" />
                  </td>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <td colSpan={5} className="p-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Nenhuma transação registrada.</td>
                </TableRow>
              ) : (
                transactions.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/50 transition-all group">
                    <TableCell className="p-6">
                      <p className="font-bold text-slate-600 text-xs">{new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{t.createdAt?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </TableCell>
                    <TableCell className="p-6">
                      <div className="flex items-center gap-2">
                        {t.isTeacherPayment && <PenTool size={14} className="text-indigo-500" />}
                        <p className="font-black text-navy uppercase text-sm tracking-tight">{t.description}</p>
                      </div>
                      {(t.recipientCpfCnpj || t.teacherName) && (
                        <p className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1">
                          <User size={10} /> {t.teacherName || 'Beneficiário'}: {t.recipientCpfCnpj}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="p-6">
                      <Badge variant="outline" className="font-bold border-slate-200 text-slate-500">{t.createdBy}</Badge>
                    </TableCell>
                    <TableCell className="p-6">
                      <p className={cn(
                        "font-black text-sm",
                        t.type === 'ENTRY' ? "text-emerald-600" : "text-red-600"
                      )}>
                        {t.type === 'ENTRY' ? '+' : '-'} {formatCurrency(t.amount)}
                      </p>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex justify-end gap-1">
                        {t.isTeacherPayment && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500" onClick={() => printTeacherReceipt(t)}>
                            <Printer size={14} />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleEditTransaction(t)}>
                          <Edit size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteConfirm({ id: t.id, description: t.description })}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Tabs>
    </div>
  );
};
