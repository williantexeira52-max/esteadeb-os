import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Percent,
  Banknote,
  Calendar,
  Tag,
  ArrowRight,
  Loader2,
  AlertTriangle
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
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface FinancialPlan {
  id: string;
  name: string;
  value: number;
  frequency: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
}

interface FinancialDiscount {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
}

interface FinancialExtra {
  id: string;
  name: string;
  value: number;
}

export const FinancialSettings: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [discounts, setDiscounts] = useState<FinancialDiscount[]>([]);
  const [extras, setExtras] = useState<FinancialExtra[]>([]);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string, type: 'plan' | 'discount' | 'extra' } | null>(null);

  const [planForm, setPlanForm] = useState<{
    name: string;
    value: number;
    frequency: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
  }>({
    name: '',
    value: 0,
    frequency: 'Mensal'
  });

  const [discountForm, setDiscountForm] = useState<{
    name: string;
    type: 'PERCENTAGE' | 'FIXED';
    value: number;
  }>({
    name: '',
    type: 'PERCENTAGE',
    value: 0
  });

  const [extraForm, setExtraForm] = useState({
    name: '',
    value: 0
  });

  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!user) return;
    const qPlans = query(collection(db, 'financial_plans'), orderBy('name', 'asc'));
    const unsubscribePlans = onSnapshot(qPlans, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialPlan)));
    });

    const qDiscounts = query(collection(db, 'financial_discounts'), orderBy('name', 'asc'));
    const unsubscribeDiscounts = onSnapshot(qDiscounts, (snapshot) => {
      setDiscounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialDiscount)));
    });

    const qExtras = query(collection(db, 'financial_extras'), orderBy('name', 'asc'));
    const unsubscribeExtras = onSnapshot(qExtras, (snapshot) => {
      setExtras(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialExtra)));
    });

    return () => {
      unsubscribePlans();
      unsubscribeDiscounts();
      unsubscribeExtras();
    };
  }, []);

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlanId) {
        await updateDoc(doc(db, 'financial_plans', editingPlanId), {
          ...planForm,
          updatedAt: serverTimestamp()
        });
        addToast('Plano atualizado com sucesso!', 'success');
      } else {
        await addDoc(collection(db, 'financial_plans'), {
          ...planForm,
          createdAt: serverTimestamp()
        });
        addToast('Plano criado com sucesso!', 'success');
      }
      resetPlanForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_plans');
      addToast('Erro ao salvar plano.', 'error');
    }
  };

  const handleDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDiscountId) {
        await updateDoc(doc(db, 'financial_discounts', editingDiscountId), {
          ...discountForm,
          updatedAt: serverTimestamp()
        });
        addToast('Desconto atualizado com sucesso!', 'success');
      } else {
        await addDoc(collection(db, 'financial_discounts'), {
          ...discountForm,
          createdAt: serverTimestamp()
        });
        addToast('Desconto criado com sucesso!', 'success');
      }
      resetDiscountForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_discounts');
      addToast('Erro ao salvar desconto.', 'error');
    }
  };

  const handleExtraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExtraId) {
        await updateDoc(doc(db, 'financial_extras', editingExtraId), {
          ...extraForm,
          updatedAt: serverTimestamp()
        });
        addToast('Item atualizado com sucesso!', 'success');
      } else {
        await addDoc(collection(db, 'financial_extras'), {
          ...extraForm,
          createdAt: serverTimestamp()
        });
        addToast('Item criado com sucesso!', 'success');
      }
      resetExtraForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_extras');
      addToast('Erro ao salvar item.', 'error');
    }
  };

  const resetPlanForm = () => {
    setPlanForm({ name: '', value: 0, frequency: 'Mensal' });
    setEditingPlanId(null);
    setIsPlanModalOpen(false);
  };

  const resetDiscountForm = () => {
    setDiscountForm({ name: '', type: 'PERCENTAGE', value: 0 });
    setEditingDiscountId(null);
    setIsDiscountModalOpen(false);
  };

  const resetExtraForm = () => {
    setExtraForm({ name: '', value: 0 });
    setEditingExtraId(null);
    setIsExtraModalOpen(false);
  };

  const handleEditPlan = (plan: FinancialPlan) => {
    setPlanForm({ name: plan.name, value: plan.value, frequency: plan.frequency });
    setEditingPlanId(plan.id);
    setIsPlanModalOpen(true);
  };

  const handleEditDiscount = (discount: FinancialDiscount) => {
    setDiscountForm({ name: discount.name, type: discount.type, value: discount.value });
    setEditingDiscountId(discount.id);
    setIsDiscountModalOpen(true);
  };

  const handleEditExtra = (extra: FinancialExtra) => {
    setExtraForm({ name: extra.name, value: extra.value });
    setEditingExtraId(extra.id);
    setIsExtraModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    
    // Immediate local state update for snappy UI
    if (type === 'plan') {
      setPlans(prev => prev.filter(p => p.id !== id));
    } else if (type === 'discount') {
      setDiscounts(prev => prev.filter(d => d.id !== id));
    } else {
      setExtras(prev => prev.filter(e => e.id !== id));
    }

    try {
      let collectionName = '';
      if (type === 'plan') collectionName = 'financial_plans';
      else if (type === 'discount') collectionName = 'financial_discounts';
      else collectionName = 'financial_extras';

      await deleteDoc(doc(db, collectionName, id));
      addToast(`${type === 'plan' ? 'Plano' : type === 'discount' ? 'Desconto' : 'Item'} excluído com sucesso!`, 'success');
    } catch (error) {
      let collectionName = '';
      if (type === 'plan') collectionName = 'financial_plans';
      else if (type === 'discount') collectionName = 'financial_discounts';
      else collectionName = 'financial_extras';

      handleFirestoreError(error, OperationType.DELETE, collectionName);
      addToast('Erro ao excluir item.', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-8 space-y-12 animate-in fade-in duration-500 bg-slate-50 min-h-screen relative">
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Confirmar Exclusão</h3>
                <p className="text-slate-500 text-sm mt-2">
                  Deseja realmente excluir <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>?
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

      {/* Plan Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <Wallet size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingPlanId ? 'Editar Plano' : 'Novo Plano Financeiro'}
                </h2>
              </div>
              <button onClick={resetPlanForm} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePlanSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Plano</label>
                <Input 
                  required
                  placeholder="Ex: Teologia Integral"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({...planForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Valor Mensal (R$)</label>
                <Input 
                  type="number"
                  step="0.01"
                  required
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={planForm.value}
                  onChange={(e) => setPlanForm({...planForm, value: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Frequência</label>
                <select 
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                  value={planForm.frequency}
                  onChange={(e) => setPlanForm({...planForm, frequency: e.target.value as any})}
                >
                  <option value="Mensal">Mensal</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={resetPlanForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {editingPlanId ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <Tag size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingDiscountId ? 'Editar Desconto' : 'Novo Desconto'}
                </h2>
              </div>
              <button onClick={resetDiscountForm} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleDiscountSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Desconto</label>
                <Input 
                  required
                  placeholder="Ex: Bolsa Monitoria"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={discountForm.name}
                  onChange={(e) => setDiscountForm({...discountForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Desconto</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountForm({...discountForm, type: 'PERCENTAGE'})}
                    className={cn(
                      "h-12 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                      discountForm.type === 'PERCENTAGE' ? "bg-petrol border-petrol text-white" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >
                    <Percent size={18} /> Percentual
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountForm({...discountForm, type: 'FIXED'})}
                    className={cn(
                      "h-12 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                      discountForm.type === 'FIXED' ? "bg-petrol border-petrol text-white" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >
                    <Banknote size={18} /> Valor Fixo
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Valor</label>
                <Input 
                  type="number"
                  step="0.01"
                  required
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={discountForm.value}
                  onChange={(e) => setDiscountForm({...discountForm, value: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={resetDiscountForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {editingDiscountId ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extra Modal */}
      {isExtraModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <Plus size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingExtraId ? 'Editar Item' : 'Novo Item (Taxa/Produto)'}
                </h2>
              </div>
              <button onClick={resetExtraForm} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleExtraSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Item</label>
                <Input 
                  required
                  placeholder="Ex: Camisa Uniforme"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={extraForm.name}
                  onChange={(e) => setExtraForm({...extraForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                <Input 
                  type="number"
                  step="0.01"
                  required
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={extraForm.value}
                  onChange={(e) => setExtraForm({...extraForm, value: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={resetExtraForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {editingExtraId ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Configurações Financeiras</h1>
          <p className="text-slate-500 font-medium mt-1">Gestão de planos de ensino e políticas de descontos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* Plans Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-navy text-white rounded-xl">
                <Wallet size={20} />
              </div>
              <h2 className="text-xl font-black text-navy uppercase tracking-tight">Planos Financeiros</h2>
            </div>
            <Button 
              onClick={() => setIsPlanModalOpen(true)}
              className="bg-petrol hover:bg-petrol-dark text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2"
            >
              <Plus size={16} /> Novo Plano
            </Button>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Nome do Plano</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Frequência</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Valor</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <td colSpan={4} className="p-12 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Nenhum plano cadastrado.</td>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id} className="hover:bg-slate-50/50 transition-all group">
                      <TableCell className="p-6">
                        <p className="font-black text-navy uppercase text-sm tracking-tight">{plan.name}</p>
                      </TableCell>
                      <TableCell className="p-6 text-center">
                        <Badge variant="outline" className="font-bold border-slate-200 text-slate-500">{plan.frequency}</Badge>
                      </TableCell>
                      <TableCell className="p-6">
                        <p className="font-black text-petrol text-sm">{formatCurrency(plan.value)}</p>
                      </TableCell>
                      <TableCell className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEditPlan(plan)} className="p-2 text-slate-400 hover:text-petrol hover:bg-petrol/10 rounded-lg transition-all">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setDeleteConfirm({ id: plan.id, name: plan.name, type: 'plan' })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Discounts Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-navy text-white rounded-xl">
                <Tag size={20} />
              </div>
              <h2 className="text-xl font-black text-navy uppercase tracking-tight">Descontos Ativos</h2>
            </div>
            <Button 
              onClick={() => setIsDiscountModalOpen(true)}
              className="bg-petrol hover:bg-petrol-dark text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2"
            >
              <Plus size={16} /> Novo Desconto
            </Button>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Nome do Desconto</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Tipo</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Valor</TableHead>
                  <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.length === 0 ? (
                  <TableRow>
                    <td colSpan={4} className="p-12 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Nenhum desconto cadastrado.</td>
                  </TableRow>
                ) : (
                  discounts.map((discount) => (
                    <TableRow key={discount.id} className="hover:bg-slate-50/50 transition-all group">
                      <TableCell className="p-6">
                        <p className="font-black text-navy uppercase text-sm tracking-tight">{discount.name}</p>
                      </TableCell>
                      <TableCell className="p-6 text-center">
                        <Badge className={cn(
                          "font-black text-[10px] uppercase px-3 py-1 border-none",
                          discount.type === 'PERCENTAGE' ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                        )}>
                          {discount.type === 'PERCENTAGE' ? 'Percentual' : 'Fixo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-6">
                        <p className="font-black text-petrol text-sm">
                          {discount.type === 'PERCENTAGE' ? `${discount.value}%` : formatCurrency(discount.value)}
                        </p>
                      </TableCell>
                      <TableCell className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEditDiscount(discount)} className="p-2 text-slate-400 hover:text-petrol hover:bg-petrol/10 rounded-lg transition-all">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setDeleteConfirm({ id: discount.id, name: discount.name, type: 'discount' })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Extras Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-navy text-white rounded-xl">
              <Plus size={20} />
            </div>
            <h2 className="text-xl font-black text-navy uppercase tracking-tight">Taxas e Produtos</h2>
          </div>
          <Button 
            onClick={() => setIsExtraModalOpen(true)}
            className="bg-petrol hover:bg-petrol-dark text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2"
          >
            <Plus size={16} /> Novo Item
          </Button>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Nome do Item</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Valor</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extras.length === 0 ? (
                <TableRow>
                  <td colSpan={3} className="p-12 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Nenhum item cadastrado.</td>
                </TableRow>
              ) : (
                extras.map((extra) => (
                  <TableRow key={extra.id} className="hover:bg-slate-50/50 transition-all group">
                    <TableCell className="p-6">
                      <p className="font-black text-navy uppercase text-sm tracking-tight">{extra.name}</p>
                    </TableCell>
                    <TableCell className="p-6">
                      <p className="font-black text-petrol text-sm">{formatCurrency(extra.value)}</p>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditExtra(extra)} className="p-2 text-slate-400 hover:text-petrol hover:bg-petrol/10 rounded-lg transition-all">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => setDeleteConfirm({ id: extra.id, name: extra.name, type: 'extra' })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
