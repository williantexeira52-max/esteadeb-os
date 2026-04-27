import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, query, collection, where, orderBy, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Banknote, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  User,
  Filter,
  ArrowRight,
  Loader2,
  AlertTriangle,
  DollarSign,
  CreditCard,
  QrCode,
  Wallet,
  Printer,
  MessageSquare,
  RotateCcw,
  RefreshCcw
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
import { DataActions } from './DataActions';
import { getNextBusinessDay } from '../lib/dateUtils';

interface Installment {
  id: string;
  studentId: string;
  studentName: string;
  baseValue: number;
  discount: number;
  dueDate: string;
  status: 'Pendente' | 'Pago';
  paymentDate?: string;
  paymentMethod?: 'Pix' | 'Dinheiro' | 'Cartão' | 'Permuta de Serviço';
  finalPaidValue?: number;
  createdAt?: any;
}

export const MonthlyFees: React.FC = () => {
  const { profile, nucleo, user } = useAuth();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  
  // Bulk selection and filtering states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(25);
  
  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 25);
  };
  const [isBatchDateModalOpen, setIsBatchDateModalOpen] = useState(false);
  const [isReceiptReportOpen, setIsReceiptReportOpen] = useState(false);
  const [reportMonthFilter, setReportMonthFilter] = useState(new Date().toISOString().substring(0, 7));
  const [batchDueDate, setBatchDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [formData, setFormData] = useState({
    studentId: '',
    planId: '',
    discountId: '',
    baseValue: 0,
    discount: 0,
    numParcels: 1,
    dueDate: new Date().toISOString().split('T')[0],
    dueDayPattern: 'MANUAL'
  });

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

  const [paymentData, setPaymentData] = useState<{
    paymentDate: string;
    paymentMethod: string;
  }>({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Pix'
  });

  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!profile || !nucleo || !user) return;

    let qInstallments = query(
      collection(db, 'financial_installments'), 
      orderBy('dueDate', 'desc')
    );

    const unsubscribeInstallments = onSnapshot(qInstallments, (snapshot) => {
      let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Installment));
      
      // Filter in memory for nucleo and polo to handle old records gracefully
      list = list.filter((i: any) => !i.nucleoId || i.nucleoId === nucleo);
      
      if (profile?.poloId) {
        list = list.filter((i: any) => i.poloId === profile.poloId);
      }
      
      setInstallments(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'financial_installments');
    });

    let qStudents = query(
      collection(db, 'students'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );

    if (profile?.poloId) {
      qStudents = query(
        collection(db, 'students'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('name', 'asc')
      );
    }

    const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
      const studentList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
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
    });

    const qPlans = query(collection(db, 'financial_plans'), orderBy('name', 'asc'));
    const unsubscribePlans = onSnapshot(qPlans, (snapshot) => {
      const plansList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = plansList.filter((p: any) => !p.nucleoId || p.nucleoId === nucleo || p.nucleoId === 'PRESENCIAL');
      setPlans(filtered);
    });

    const qDiscounts = query(collection(db, 'financial_discounts'), orderBy('name', 'asc'));
    const unsubscribeDiscounts = onSnapshot(qDiscounts, (snapshot) => {
      const discountsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = discountsList.filter((d: any) => !d.nucleoId || d.nucleoId === nucleo || d.nucleoId === 'PRESENCIAL');
      setDiscounts(filtered);
    });

    return () => {
      unsubscribeInstallments();
      unsubscribeStudents();
      unsubscribePlans();
      unsubscribeDiscounts();
    };
  }, [nucleo, profile, user]);

  const calculatePenalties = (installment: Installment, customPaymentDate?: string) => {
    if (installment.status === 'Pago') {
      return {
        netValue: installment.baseValue - installment.discount,
        fine: 0,
        interest: 0,
        total: installment.finalPaidValue || (installment.baseValue - installment.discount),
        isLate: false
      };
    }

    const netValue = installment.baseValue - installment.discount;
    // Define o vencimento como final do dia
    const dueDate = new Date(installment.dueDate + 'T23:59:59');
    
    // Se houver uma data personalizada (do modal), usa ela. Se não, usa hoje.
    const pDate = customPaymentDate ? new Date(customPaymentDate + 'T12:00:00') : new Date();
    
    // Se a data de pagamento for antes ou igual ao vencimento, não há multa/juros
    if (pDate <= dueDate) {
      return { netValue, fine: 0, interest: 0, total: netValue, isLate: false };
    }

    // Cálculo de atraso baseado na data de pagamento informada
    const diffTime = Math.abs(pDate.getTime() - dueDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const fine = netValue * 0.02; // 2% Multa Fixa
    const monthlyInterestRate = 0.01; // 1% ao mês
    const dailyInterestRate = monthlyInterestRate / 30;
    const interest = netValue * (dailyInterestRate * diffDays);

    return {
      netValue,
      fine,
      interest,
      total: netValue + fine + interest,
      isLate: true,
      daysOverdue: diffDays
    };
  };

  const generateReceipt = (inst: Installment) => {
    const win = window.open('', '_blank');
    if (!win) return;

    // Se já pago, usa o valor final salvo. Se não, calcula com base em hoje.
    const { total } = calculatePenalties(inst, inst.paymentDate);

    win.document.write(`
      <html>
        <head>
          <title>Recibo de Pagamento - ${inst.studentName}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .receipt { border: 2px solid #001F3F; padding: 30px; border-radius: 20px; max-width: 800px; margin: 0 auto; position: relative; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: 900; color: #001F3F; }
            .title { font-size: 20px; font-weight: 900; text-transform: uppercase; }
            .content { line-height: 1.6; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
            .signature { border-top: 1px solid #333; width: 250px; text-align: center; padding-top: 5px; font-size: 12px; font-weight: bold; }
            .date { font-size: 12px; font-weight: bold; }
            .stamp { position: absolute; bottom: 20px; right: 20px; opacity: 0.1; transform: rotate(-15deg); font-size: 40px; font-weight: 900; border: 5px solid #001F3F; padding: 10px; }
            @media print { 
              .no-print { display: none; } 
              body { padding: 0; }
              .receipt { page-break-inside: avoid; border: 1px solid #001F3F; } 
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #001F3F; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">IMPRIMIR RECIBO</button>
          </div>
          
          <div class="receipt">
            <div class="header">
              <div class="logo">ESTEADEB</div>
              <div class="title">Recibo de Pagamento</div>
            </div>
            
            <div class="content">
              <p>Recebemos de <strong>${inst.studentName.toUpperCase()}</strong></p>
              <p>A quantia de <strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.status === 'Pago' ? (inst as any).finalPaidValue || total : total)}</strong></p>
              <p>Referente à mensalidade com vencimento em <strong>${new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>.</p>
              <p style="margin-top: 20px;">Natal/RN, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div class="footer">
              <div class="signature">ASSINATURA DO RESPONSÁVEL</div>
              <div class="date">${new Date().toLocaleDateString('pt-BR')}</div>
            </div>
            
            <div class="stamp">PAGO</div>
          </div>

          <div style="margin-top: 40px; border-top: 1px dashed #ccc; padding-top: 40px;"></div>

          <div class="receipt" style="margin-top: 40px;">
            <div class="header">
              <div class="logo">ESTEADEB</div>
              <div class="title">Recibo de Pagamento (Via Aluno)</div>
            </div>
            
            <div class="content">
              <p>Recebemos de <strong>${inst.studentName.toUpperCase()}</strong></p>
              <p>A quantia de <strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.status === 'Pago' ? (inst as any).finalPaidValue || total : total)}</strong></p>
              <p>Referente à mensalidade com vencimento em <strong>${new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>.</p>
              <p style="margin-top: 20px;">Natal/RN, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div class="footer">
              <div class="signature">ASSINATURA DO RESPONSÁVEL</div>
              <div class="date">${new Date().toLocaleDateString('pt-BR')}</div>
            </div>
            
            <div class="stamp">PAGO</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleWhatsApp = async (inst: Installment) => {
    const { total, isLate, daysOverdue } = calculatePenalties(inst);
    let template = isLate 
      ? 'Olá, [NOME_DO_ALUNO]! Notamos um atraso de ' + daysOverdue + ' dias em sua mensalidade com vencimento em [VENCIMENTO]. O valor atualizado é [VALOR]. Vamos regularizar?'
      : 'Olá, [NOME_DO_ALUNO]! Segue o lembrete de sua mensalidade com vencimento em [VENCIMENTO]. Valor: [VALOR].';

    try {
      const settingsDocRef = doc(db, 'settings', `financial_hub_${nucleo || 'default'}`);
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.messageTemplates) {
           template = isLate ? (data.messageTemplates.late || template) : (data.messageTemplates.dueSoon || template);
        }
      }
    } catch (e) {
      console.warn("Could not fetch settings", e);
    }
      
    const dueDateFormatted = new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR');
    
    let parsedMessage = template
      .replace(/\[NOME_DO_ALUNO\]/g, inst.studentName)
      .replace(/\[VENCIMENTO\]/g, dueDateFormatted)
      .replace(/\[VALOR\]/g, formatCurrency(total));

    const communicationMsg = `${calculatePenalties(inst).isLate ? 'Cobrado' : 'Lembrete enviado'} dia ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    try {
      await updateDoc(doc(db, 'financial_installments', inst.id), {
        lastCommunication: communicationMsg
      });
    } catch (e) {
      console.warn("Could not log communication:", e);
    }
    
    window.open(`https://wa.me/?text=${encodeURIComponent(parsedMessage)}`, '_blank');
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === formData.studentId);
    if (!student) return;

    try {
      if (editingId) {
        const data = {
          studentId: formData.studentId,
          studentName: student.name,
          baseValue: formData.baseValue,
          discount: formData.discount,
          dueDate: formData.dueDate,
          status: 'Pendente',
          updatedAt: serverTimestamp()
        };
        await updateDoc(doc(db, 'financial_installments', editingId), data);
        addToast('Mensalidade atualizada!', 'success');
      } else {
        const batch = [];
        const numParcels = Math.min(Math.max(formData.numParcels, 1), 24);
        const baseDate = new Date(formData.dueDate + 'T12:00:00');
        
        for (let i = 0; i < numParcels; i++) {
          let dueDate: Date;
          
          if (formData.dueDayPattern !== 'MANUAL') {
            let installmentMonth = baseDate.getMonth() + i;
            let installmentYear = baseDate.getFullYear();
            while (installmentMonth > 11) {
              installmentMonth -= 12;
              installmentYear += 1;
            }

            let day = 10;
            if (formData.dueDayPattern === '5_UTIL') {
              day = getFifthBusinessDay(installmentYear, installmentMonth);
              dueDate = new Date(installmentYear, installmentMonth, day);
            } else {
              day = Number(formData.dueDayPattern);
              dueDate = getNextBusinessDay(new Date(installmentYear, installmentMonth, day));
            }
          } else {
            const tempDate = new Date(baseDate);
            tempDate.setMonth(tempDate.getMonth() + i);
            dueDate = getNextBusinessDay(tempDate);
          }
          
          batch.push(addDoc(collection(db, 'financial_installments'), {
            studentId: formData.studentId,
            studentName: student.name,
            studentMatricula: student.matricula || '',
            studentPhone: student.phone || '',
            studentEmail: student.email || '',
            baseValue: formData.baseValue,
            discount: formData.discount,
            dueDate: dueDate.toISOString().split('T')[0],
            status: 'Pendente',
            nucleoId: nucleo,
            poloId: student.poloId || '',
            poloName: student.poloName || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            parcelNumber: i + 1,
            totalParcels: numParcels
          }));
        }
        
        await Promise.all(batch);
        addToast(numParcels > 1 ? `${numParcels} mensalidades geradas!` : 'Mensalidade gerada!', 'success');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_installments');
      addToast('Erro ao salvar mensalidade.', 'error');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;

    // Calcula as multas com base na data de pagamento informada no modal
    const { total } = calculatePenalties(selectedInstallment, paymentData.paymentDate);

    try {
      await updateDoc(doc(db, 'financial_installments', selectedInstallment.id), {
        status: 'Pago',
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        finalPaidValue: total, // Salva o valor final (com ou sem multa, dependendo da data)
        updatedAt: serverTimestamp()
      });
      addToast('Pagamento registrado com sucesso!', 'success');
      setIsPaymentModalOpen(false);
      setSelectedInstallment(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_installments');
      addToast('Erro ao registrar pagamento.', 'error');
    }
  };

  const handleEstorno = async (installment: Installment) => {
    if (!window.confirm('Tem certeza que deseja estornar este pagamento? O status voltará para Pendente.')) return;
    try {
      await updateDoc(doc(db, 'financial_installments', installment.id), {
        status: 'Pendente',
        paymentDate: null,
        paymentMethod: null,
        finalPaidValue: null,
        updatedAt: serverTimestamp()
      });
      addToast('Pagamento estornado com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_installments');
      addToast('Erro ao estornar pagamento.', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      studentId: '',
      planId: '',
      discountId: '',
      baseValue: 0,
      discount: 0,
      numParcels: 1,
      dueDate: new Date().toISOString().split('T')[0],
      dueDayPattern: 'MANUAL'
    });
    setEditingId(null);
    setIsAddModalOpen(false);
  };

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setFormData(prev => ({
        ...prev,
        planId,
        baseValue: plan.value
      }));
    } else {
      setFormData(prev => ({ ...prev, planId: '', baseValue: 0 }));
    }
  };

  const handleDiscountChange = (discountId: string) => {
    const discount = discounts.find(d => d.id === discountId);
    if (discount) {
      let calculatedDiscount = 0;
      if (discount.type === 'PERCENTAGE') {
        calculatedDiscount = formData.baseValue * (discount.value / 100);
      } else {
        calculatedDiscount = discount.value;
      }
      setFormData(prev => ({
        ...prev,
        discountId,
        discount: calculatedDiscount
      }));
    } else {
      setFormData(prev => ({ ...prev, discountId: '', discount: 0 }));
    }
  };

  const handleEdit = (inst: Installment) => {
    if (inst.status === 'Pago') return;
    setFormData({
      studentId: inst.studentId,
      planId: '',
      discountId: '',
      baseValue: inst.baseValue,
      discount: inst.discount,
      numParcels: 1,
      dueDate: inst.dueDate,
      dueDayPattern: 'MANUAL'
    });
    setEditingId(inst.id);
    setIsAddModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setIsBulkDeleting(true);
    try {
      await deleteDoc(doc(db, 'financial_installments', deleteConfirm.id));
      addToast('Mensalidade excluída com sucesso!', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'financial_installments');
      addToast('Erro ao excluir mensalidade.', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredInstallments.map(i => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const [isBatchPaymentModalOpen, setIsBatchPaymentModalOpen] = useState(false);
  const [batchPaymentData, setBatchPaymentData] = useState<{
    paymentDate: string;
    paymentMethod: string;
  }>({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Pix'
  });

  const handleBatchPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      const selectedInsts = installments.filter(i => selectedIds.includes(i.id));

      selectedInsts.forEach(inst => {
        const { total } = calculatePenalties(inst, batchPaymentData.paymentDate);
        batch.update(doc(db, 'financial_installments', inst.id), {
          status: 'Pago',
          paymentDate: batchPaymentData.paymentDate,
          paymentMethod: batchPaymentData.paymentMethod,
          finalPaidValue: total,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      addToast(`${selectedInsts.length} baixas registradas com sucesso!`, 'success');
      setIsBatchPaymentModalOpen(false);
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_installments');
      addToast('Erro ao realizar baixa em lote.', 'error');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'financial_installments', id));
      });
      await batch.commit();
      addToast(`${selectedIds.length} mensalidades excluídas com sucesso!`, 'success');
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'financial_installments');
      addToast('Erro ao excluir mensalidades em lote.', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBatchUpdateDate = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'financial_installments', id), {
          dueDate: batchDueDate,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      addToast(`${selectedIds.length} vencimentos atualizados com sucesso!`, 'success');
      setSelectedIds([]);
      setIsBatchDateModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_installments');
      addToast('Erro ao atualizar vencimentos em lote.', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleMassBilling = async () => {
    if (selectedIds.length === 0) {
      addToast('Selecione pelo menos uma mensalidade para enviar cobrança.', 'error');
      return;
    }

    let defaultTemplates = {
      late: 'Olá, [NOME_DO_ALUNO]! Notamos que sua mensalidade com vencimento em [VENCIMENTO] encontra-se em aberto. O valor base é de [VALOR]. Por favor, entre em contato para regularizar sua situação ou desconsidere caso já tenha efetuado o pagamento. Atenciosamente.',
      dueSoon: 'Olá, [NOME_DO_ALUNO]! Gostaríamos de lembrar que o vencimento da sua mensalidade será no dia [VENCIMENTO]. O valor base é de [VALOR]. Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem. Atenciosamente.'
    };
    let whatsappApi = { mode: 'web', apiUrl: '', apiToken: '' };

    try {
      const settingsDocRef = doc(db, 'settings', `financial_hub_${nucleo || 'default'}`);
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.messageTemplates) defaultTemplates = { ...defaultTemplates, ...data.messageTemplates };
        if (data.whatsappApi) whatsappApi = { ...whatsappApi, ...data.whatsappApi };
      }
    } catch (e) {
      console.warn("Could not fetch settings", e);
    }

    const selectedInstallments = installments.filter(inst => selectedIds.includes(inst.id));

    let apiSentCount = 0;

    for (const inst of selectedInstallments) {
      const studentPhone = (inst as any).studentPhone;
      if (studentPhone) {
        const cleanPhone = studentPhone.replace(/\D/g, '');
        if (cleanPhone) {
          const dueDateFormatted = new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR');
          
          let rawMessage = calculatePenalties(inst).isLate ? defaultTemplates.late : defaultTemplates.dueSoon;
          
          let parsedMessage = rawMessage
            .replace(/\[NOME_DO_ALUNO\]/g, inst.studentName)
            .replace(/\[VENCIMENTO\]/g, dueDateFormatted)
            .replace(/\[VALOR\]/g, formatCurrency(inst.baseValue));

          const communicationMsg = `${calculatePenalties(inst).isLate ? 'Cobrado' : 'Lembrete enviado'} dia ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

          try {
            await updateDoc(doc(db, 'financial_installments', inst.id), {
              lastCommunication: communicationMsg
            });
          } catch (e) {
            console.warn("Could not log communication:", e);
          }

          if (whatsappApi.mode === 'api' && whatsappApi.apiUrl) {
            // Disparo via API em background
            try {
              await fetch(whatsappApi.apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(whatsappApi.apiToken ? { 'Authorization': `Bearer ${whatsappApi.apiToken}` } : {})
                },
                body: JSON.stringify({
                  number: '55' + cleanPhone,
                  text: parsedMessage
                })
              });
              apiSentCount++;
            } catch (err) {
              console.error("Erro disparando API WhatsApp para " + cleanPhone, err);
            }
          } else {
            // Web / Abre as abas
            window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(parsedMessage)}`, '_blank');
          }
        }
      }
    }

    if (apiSentCount > 0) {
      addToast(`${apiSentCount} mensagens enviadas via API!`, 'success');
    }
  };

  const filteredInstallments = useMemo(() => {
    return installments.filter(inst => {
      const matchSearch = inst.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        String((inst as any).studentMatricula || '').includes(searchTerm);
      const matchYear = filterYear ? inst.dueDate.startsWith(filterYear) : true;
      const matchMonth = filterMonth ? inst.dueDate.slice(5, 7) === filterMonth : true;
      
      let matchStatus = true;
      if (filterStatus !== 'all') {
        const { isLate } = calculatePenalties(inst);
        if (filterStatus === 'Pago' && inst.status !== 'Pago') matchStatus = false;
        if (filterStatus === 'Pendente' && (inst.status === 'Pago' || isLate)) matchStatus = false;
        if (filterStatus === 'Atrasado' && !isLate) matchStatus = false;
      }
      
      return matchSearch && matchYear && matchMonth && matchStatus;
    });
  }, [installments, searchTerm, filterMonth, filterYear, filterStatus]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen relative">
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
                  Deseja realmente excluir a mensalidade de <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>?
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
                <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest">Apagar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <DollarSign size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingId ? 'Editar Mensalidade' : 'Gerar Mensalidade'}
                </h2>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Aluno</label>
                <select 
                  required
                  disabled={!!editingId}
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700 disabled:opacity-50"
                  value={formData.studentId}
                  onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                >
                  <option value="">Selecione o Aluno</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Plano Financeiro</label>
                  <select 
                    required={!editingId}
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.planId}
                    onChange={(e) => handlePlanChange(e.target.value)}
                  >
                    <option value="">Selecione o Plano</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.value)})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Desconto Aplicado</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.discountId}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                  >
                    <option value="">Sem Desconto</option>
                    {discounts.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type === 'PERCENTAGE' ? `${d.value}%` : formatCurrency(d.value)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Valor Final (R$)</label>
                  <div className="h-12 px-4 bg-slate-100 border-2 border-slate-200 rounded-2xl flex items-center font-black text-navy text-sm">
                    {formatCurrency(formData.baseValue - formData.discount)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Qtd. de Parcelas</label>
                  <Input 
                    type="number" min="1" max="24" required
                    disabled={!!editingId}
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold disabled:opacity-50"
                    value={formData.numParcels}
                    onChange={(e) => setFormData({...formData, numParcels: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Vencimento Padrão</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.dueDayPattern}
                    onChange={(e) => setFormData({...formData, dueDayPattern: e.target.value})}
                  >
                    <option value="MANUAL">Data Manual</option>
                    <option value="5_UTIL">5º Dia Útil</option>
                    <option value="10">Todo dia 10</option>
                    <option value="20">Todo dia 20</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Data de Vencimento (1ª Parcela)</label>
                  <Input 
                    type="date" required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {editingId ? 'Salvar' : 'Gerar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPaymentModalOpen && selectedInstallment && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <CheckCircle2 size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Dar Baixa / Pagamento</h2>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Valor Líquido:</span>
                  <span className="font-bold text-slate-600">{formatCurrency(selectedInstallment.baseValue - selectedInstallment.discount)}</span>
                </div>
                {/* O cálculo de multas agora reage à data de pagamento escolhida abaixo */}
                {calculatePenalties(selectedInstallment, paymentData.paymentDate).isLate && (
                  <>
                    <div className="flex justify-between items-center text-red-500">
                      <span className="text-xs font-black uppercase tracking-widest">Multa (2%):</span>
                      <span className="font-bold">+{formatCurrency(calculatePenalties(selectedInstallment, paymentData.paymentDate).fine)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-500">
                      <span className="text-xs font-black uppercase tracking-widest">Juros (1% ao mês):</span>
                      <span className="font-bold">+{formatCurrency(calculatePenalties(selectedInstallment, paymentData.paymentDate).interest)}</span>
                    </div>
                  </>
                )}
                <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-black text-navy uppercase tracking-widest">Total a Pagar:</span>
                  <span className="text-xl font-black text-emerald-600">
                    {formatCurrency(calculatePenalties(selectedInstallment, paymentData.paymentDate).total)}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Data do Pagamento</label>
                  <Input 
                    type="date" required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 font-bold"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData({...paymentData, paymentDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                  <select 
                    className="w-full h-14 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                    value={paymentData.paymentMethod}
                    onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
                  >
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão">Cartão (Débito/Crédito)</option>
                    <option value="Cartão Recorrente">Cartão Recorrente</option>
                    <option value="Link de Pagamento">Link de Pagamento</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Permuta de Serviço">Permuta de Serviço</option>
                  </select>
                </div>
              </div>

              <Button type="submit" className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-100">
                Confirmar Recebimento
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Batch Date Modal */}
      {isBatchDateModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <h2 className="text-xl font-black uppercase tracking-tight">Alterar Vencimento em Lote</h2>
              <button onClick={() => setIsBatchDateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-sm font-medium text-slate-500">
                Alterando o vencimento de <strong>{selectedIds.length}</strong> mensalidades selecionadas.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Novo Vencimento</label>
                <Input 
                  type="date"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={batchDueDate}
                  onChange={(e) => setBatchDueDate(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setIsBatchDateModalOpen(false)}>Cancelar</Button>
                <Button 
                  onClick={handleBatchUpdateDate} 
                  disabled={isBulkDeleting}
                  className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest text-white"
                >
                  {isBulkDeleting ? <Loader2 className="animate-spin" /> : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Payment Modal */}
      {isBatchPaymentModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="bg-emerald-600 p-6 flex items-center justify-between text-white">
              <h2 className="text-xl font-black uppercase tracking-tight">Baixa em Lote</h2>
              <button onClick={() => setIsBatchPaymentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleBatchPaymentSubmit} className="p-8 space-y-6">
              <p className="text-sm font-medium text-slate-500">
                Você selecionou <strong>{selectedIds.length}</strong> mensalidades para dar baixa.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Data do Pagamento</label>
                  <Input 
                    type="date" required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 font-bold"
                    value={batchPaymentData.paymentDate}
                    onChange={(e) => setBatchPaymentData({...batchPaymentData, paymentDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                  <select 
                    className="w-full h-14 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                    value={batchPaymentData.paymentMethod}
                    onChange={(e) => setBatchPaymentData({...batchPaymentData, paymentMethod: e.target.value})}
                  >
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão">Cartão (Débito/Crédito)</option>
                    <option value="Cartão Recorrente">Cartão Recorrente</option>
                    <option value="Link de Pagamento">Link de Pagamento</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Permuta de Serviço">Permuta de Serviço</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => setIsBatchPaymentModalOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-black uppercase tracking-widest text-white">
                  Confirmar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Relatório de Mensalidades Recebidas */}
      {isReceiptReportOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex flex-col items-center p-4 md:p-8 print:p-0 print:bg-white print:backdrop-blur-none print:static print-overlay-container">
          <div className="w-full max-w-5xl flex justify-between items-center mb-6 print:hidden">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 bg-petrol rounded-xl">
                <Printer size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Relatório de Recebimentos</h2>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 px-6">
                <Printer size={16} /> Imprimir Relatório
              </Button>
              <Button onClick={() => setIsReceiptReportOpen(false)} variant="ghost" className="text-white hover:bg-white/10 rounded-full p-2">
                <X size={24} />
              </Button>
            </div>
          </div>
          
          <div className="w-full max-w-5xl bg-white shadow-2xl rounded-[2rem] overflow-hidden print:shadow-none print:rounded-none flex flex-col max-h-[90vh] print:max-h-none print:h-auto">
            <div className="p-6 border-b print:hidden flex gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Mês do Recebimento (Baixa)</label>
                <Input 
                  type="month"
                  value={reportMonthFilter}
                  onChange={(e) => setReportMonthFilter(e.target.value)}
                  className="font-bold text-slate-700 h-12 rounded-xl border-2 border-slate-200"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar print:overflow-visible print:p-0">
              <div className="space-y-8">
                <div className="text-center space-y-2 border-b border-slate-100 pb-8">
                  <h1 className="text-2xl font-black text-navy uppercase tracking-tighter">Relatório de Recebimentos / Mensalidades</h1>
                  <p className="font-bold tracking-widest text-slate-500 uppercase">
                    Competência (Baixa): <span className="text-petrol">{reportMonthFilter.split('-').reverse().join('/')}</span>
                  </p>
                </div>

                {(() => {
                  const paidInMonth = installments.filter(i => i.status === 'Pago' && i.paymentDate?.startsWith(reportMonthFilter));
                  const totalPix = paidInMonth.filter(i => i.paymentMethod === 'Pix').reduce((acc, curr) => acc + (curr.finalPaidValue || 0), 0);
                  const totalDinheiro = paidInMonth.filter(i => i.paymentMethod === 'Dinheiro').reduce((acc, curr) => acc + (curr.finalPaidValue || 0), 0);
                  const totalCartao = paidInMonth.filter(i => i.paymentMethod === 'Cartão').reduce((acc, curr) => acc + (curr.finalPaidValue || 0), 0);
                  const totalPermuta = paidInMonth.filter(i => i.paymentMethod === 'Permuta de Serviço').reduce((acc, curr) => acc + (curr.finalPaidValue || 0), 0);
                  const totalGeral = totalPix + totalDinheiro + totalCartao;

                  return (
                    <div className="space-y-8">
                      <div className="grid grid-cols-4 gap-4 break-inside-avoid">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total PIX</p>
                          <p className="text-lg font-black text-teal-600 mt-1">{formatCurrency(totalPix)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Dinheiro</p>
                          <p className="text-lg font-black text-emerald-600 mt-1">{formatCurrency(totalDinheiro)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Cartão</p>
                          <p className="text-lg font-black text-indigo-600 mt-1">{formatCurrency(totalCartao)}</p>
                        </div>
                        <div className="p-4 bg-navy rounded-2xl text-white shadow-lg">
                          <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Total Geral</p>
                          <p className="text-xl font-black mt-1">{formatCurrency(totalGeral)}</p>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50 border-y border-slate-100">
                            <TableHead className="font-black text-slate-500 uppercase text-[10px] tracking-widest h-10">Data Baixa</TableHead>
                            <TableHead className="font-black text-slate-500 uppercase text-[10px] tracking-widest h-10">Aluno</TableHead>
                            <TableHead className="font-black text-slate-500 uppercase text-[10px] tracking-widest text-center h-10">Ref.</TableHead>
                            <TableHead className="font-black text-slate-500 uppercase text-[10px] tracking-widest text-center h-10">Método</TableHead>
                            <TableHead className="font-black text-slate-500 uppercase text-[10px] tracking-widest text-right h-10">Valor Líquido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paidInMonth.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-slate-400 italic">
                                Nenhum recebimento encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paidInMonth
                              .sort((a, b) => (a.paymentDate || '').localeCompare(b.paymentDate || ''))
                              .map(inst => (
                              <TableRow key={inst.id} className="print:border-b border-b border-slate-50 h-8">
                                <TableCell className="font-medium text-xs">{inst.paymentDate?.split('-').reverse().join('/')}</TableCell>
                                <TableCell className="font-bold uppercase text-slate-700 text-xs">
                                  {inst.studentName}
                                  {students.find(s => s.id === inst.studentId)?.className && (
                                    <span className="block text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">{students.find(s => s.id === inst.studentId)?.className}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center text-slate-400 text-[10px]">{inst.dueDate?.split('-').reverse().join('/')}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={cn(
                                    "border-none uppercase text-[9px] font-black print:p-0",
                                    inst.paymentMethod === 'Pix' ? "bg-teal-50 text-teal-700" :
                                    inst.paymentMethod === 'Dinheiro' ? "bg-emerald-50 text-emerald-700" : 
                                    (inst.paymentMethod === 'Cartão' || inst.paymentMethod === 'Cartão Recorrente') ? "bg-indigo-50 text-indigo-700" :
                                    inst.paymentMethod === 'Link de Pagamento' ? "bg-blue-50 text-blue-700" :
                                    inst.paymentMethod === 'Boleto' ? "bg-stone-50 text-stone-700" :
                                    inst.paymentMethod === 'Permuta de Serviço' ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-700"
                                  )}>
                                    {inst.paymentMethod || '--'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-black text-navy text-xs">{formatCurrency(inst.finalPaidValue || 0)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Gestão de Mensalidades</h1>
          <p className="text-slate-500 font-medium mt-1">Controle de parcelas, multas e conciliação bancária.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DataActions 
            collectionName="financial_installments"
            data={installments}
            title="Mensalidades"
            headers={[
              { key: 'studentName', label: 'Aluno' },
              { key: 'studentMatricula', label: 'Matrícula' },
              { key: 'studentId', label: 'ID Aluno' },
              { key: 'baseValue', label: 'Valor Base', type: 'number' },
              { key: 'discount', label: 'Desconto', type: 'number' },
              { key: 'dueDate', label: 'Vencimento' },
              { key: 'status', label: 'Status' }
            ]}
          />
          <Button 
            onClick={() => setIsReceiptReportOpen(true)}
            variant="outline"
            className="border-2 border-slate-200 text-slate-600 hover:text-navy hover:border-navy hover:bg-slate-50 px-6 py-6 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3"
          >
            <Printer size={20} /> Recebimentos
          </Button>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-petrol hover:bg-petrol-dark text-white px-8 py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-petrol/20 flex items-center gap-3"
          >
            <Plus size={24} /> Gerar Mensalidade
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Buscar por nome do aluno..." 
            className="pl-12 h-14 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-petrol font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
          <Calendar size={18} className="text-slate-400 ml-2" />
          <select 
            className="bg-transparent border-none outline-none font-bold text-slate-600 text-sm p-2 w-32"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="">Todos os Meses</option>
            <option value="01">Janeiro</option>
            <option value="02">Fevereiro</option>
            <option value="03">Março</option>
            <option value="04">Abril</option>
            <option value="05">Maio</option>
            <option value="06">Junho</option>
            <option value="07">Julho</option>
            <option value="08">Agosto</option>
            <option value="09">Setembro</option>
            <option value="10">Outubro</option>
            <option value="11">Novembro</option>
            <option value="12">Dezembro</option>
          </select>
          <div className="w-px h-6 bg-slate-200"></div>
          <select 
            className="bg-transparent border-none outline-none font-bold text-slate-600 text-sm p-2 w-24"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            <option value="">Todos os Anos</option>
            {Array.from({ length: 6 }).map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
          <div className="w-px h-6 bg-slate-200"></div>
          <select 
            className="bg-transparent border-none outline-none font-bold text-slate-600 text-sm p-2 w-32"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos Status</option>
            <option value="Pendente">Pendentes</option>
            <option value="Pago">Pagos</option>
            <option value="Atrasado">Atrasados</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
            <Badge className="bg-petrol text-white px-3 py-1 rounded-full font-bold">
              {selectedIds.length} selecionados
            </Badge>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleMassBilling}
              className="h-10 border-slate-200 text-slate-600 font-bold text-xs uppercase"
            >
              Cobrar via WhatsApp
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setIsBatchPaymentModalOpen(true)}
              className="h-10 border-slate-200 text-slate-600 font-bold text-xs uppercase"
            >
              Baixa em Lote
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setIsBatchDateModalOpen(true)}
              className="h-10 border-slate-200 text-slate-600 font-bold text-xs uppercase"
            >
              Mudar Vencimento
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={handleBatchDelete}
              className="h-10 font-bold text-xs uppercase"
            >
              Apagar em Lote
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="p-6 w-12 text-center">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-petrol focus:ring-petrol"
                  checked={selectedIds.length === filteredInstallments.length && filteredInstallments.length > 0}
                  onChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Aluno / Matrícula</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Vencimento</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Valor Original</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Valor Atualizado</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-center">Status</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInstallments.length === 0 ? (
              <TableRow>
                <td colSpan={6} className="p-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Nenhuma mensalidade encontrada.</td>
              </TableRow>
            ) : (
              filteredInstallments.slice(0, visibleCount).map((inst) => {
                const { total, isLate } = calculatePenalties(inst);
                const originalNet = inst.baseValue - inst.discount;
                
                return (
                  <TableRow key={inst.id} className={cn(
                    "hover:bg-slate-50/50 transition-all group",
                    selectedIds.includes(inst.id) && "bg-petrol/5"
                  )}>
                    <TableCell className="p-6 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-petrol focus:ring-petrol"
                        checked={selectedIds.includes(inst.id)}
                        onChange={() => handleSelectOne(inst.id)}
                      />
                    </TableCell>
                    <TableCell className="p-6">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-navy uppercase text-sm tracking-tight">{inst.studentName}</p>
                        {(inst as any).isAcordo && (
                          <Badge className="bg-orange-50 text-orange-600 border-orange-200 text-[9px] uppercase font-black uppercase tracking-widest px-2 py-0">Acordo</Badge>
                        )}
                      </div>
                      <div className="flex flex-col mt-1">
                        <p className="text-[10px] text-slate-400 font-mono">{(inst as any).studentMatricula || 'N/A'}</p>
                        {students.find(s => s.id === inst.studentId)?.className && (
                          <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{students.find(s => s.id === inst.studentId)?.className}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-6">
                      <p className="font-bold text-slate-600 text-xs">
                        {new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </TableCell>
                    <TableCell className="p-6">
                      <p className="font-bold text-slate-400 text-xs line-through">{formatCurrency(inst.baseValue)}</p>
                      <p className="font-black text-slate-600 text-sm">{formatCurrency(originalNet)}</p>
                    </TableCell>
                    <TableCell className="p-6">
                      <p className={cn(
                        "font-black text-sm",
                        isLate && inst.status !== 'Pago' ? "text-red-500" : "text-emerald-600"
                      )}>
                        {formatCurrency(total)}
                      </p>
                      {isLate && inst.status !== 'Pago' && <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Com Juros/Multa</p>}
                    </TableCell>
                    <TableCell className="p-6 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Badge className={cn(
                          "font-black text-[10px] uppercase px-4 py-1.5 rounded-full border-none shadow-sm w-fit",
                          inst.status === 'Pago' ? "bg-emerald-100 text-emerald-700" :
                          isLate ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {inst.status === 'Pago' ? 'Pago' : isLate ? 'Atrasado' : 'Pendente'}
                        </Badge>
                        {(inst as any).lastCommunication && (
                           <Badge variant="outline" className="text-[8px] font-bold bg-slate-50 border-slate-200 text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis px-2 py-0.5">
                             {(inst as any).lastCommunication}
                           </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inst.status === 'Pendente' ? (
                          <>
                            <Button 
                              size="sm" 
                              className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold text-[10px] uppercase px-4 h-9 border border-emerald-100"
                              onClick={() => {
                                setSelectedInstallment(inst);
                                setIsPaymentModalOpen(true);
                              }}
                            >
                              Dar Baixa
                            </Button>
                            <button 
                              onClick={() => handleWhatsApp(inst)}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Enviar WhatsApp"
                            >
                              <MessageSquare size={16} />
                            </button>
                            <button onClick={() => handleEdit(inst)} className="p-2 text-slate-400 hover:text-petrol hover:bg-petrol/10 rounded-lg transition-all">
                              <Edit2 size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleEstorno(inst)}
                              className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                              title="Estornar Pagamento"
                            >
                              <RotateCcw size={16} />
                            </button>
                            <button 
                              onClick={() => generateReceipt(inst)}
                              className="p-2 text-petrol hover:bg-petrol/10 rounded-lg transition-all"
                              title="Imprimir Recibo"
                            >
                              <Printer size={16} />
                            </button>
                          </>
                        )}
                        <button onClick={() => setDeleteConfirm({ id: inst.id, name: inst.studentName })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {visibleCount < filteredInstallments.length && (
          <div className="p-6 flex justify-center border-t border-slate-100">
            <Button 
              variant="outline" 
              onClick={handleLoadMore}
              className="h-10 px-8 rounded-xl font-bold uppercase tracking-widest text-[#2B3A67] border-[#2B3A67]/20 hover:bg-[#2B3A67]/5"
            >
              Carregar Mais Mensalidades
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};