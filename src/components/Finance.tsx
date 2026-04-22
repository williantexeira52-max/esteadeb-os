import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Calculator, 
  Receipt,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Coins,
  DollarSign,
  Search,
  Clock,
  Printer,
  Trash2,
  MessageCircle,
  Smartphone
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export const Finance: React.FC = () => {
  const { nucleo, profile, isAdmin, user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cashierTotal, setCashierTotal] = useState(0);
  const [isConferenceOpen, setIsConferenceOpen] = useState(false);
  const [physicalCash, setPhysicalCash] = useState({
    '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0, '1': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0
  });

  useEffect(() => {
    if (!nucleo || !user) return;
    const q = query(
      collection(db, 'transactions'),
      where('nucleoId', '==', nucleo),
      orderBy('date', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(list);
      
      const total = list.reduce((acc, curr: any) => acc + (curr.amount || 0), 0);
      setCashierTotal(total);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [nucleo]);

  const calculatePhysicalTotal = () => {
    return Object.entries(physicalCash).reduce((acc, [val, qty]) => acc + (Number(val) * (qty as number)), 0);
  };

  const physicalTotal = calculatePhysicalTotal();
  const difference = physicalTotal - cashierTotal;

  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    studentName: '',
    baseValue: 0,
    discount: 0,
    originalValue: 0,
    discountValue: 0,
    dueDate: '',
    type: 'Escola'
  });

  const handleDeleteTransaction = async (id: string) => {
    if (!isAdmin) {
      alert('Apenas administradores podem excluir movimentações.');
      return;
    }
    if (!window.confirm('Deseja realmente excluir esta movimentação? Esta ação é irreversível e afetará o saldo.')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
    }
  };

  const generateReceipt = (transaction: any) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const { systemConfig } = useAuth();

    const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amount);
    const dateStr = transaction.date?.toDate ? transaction.date.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
    const day = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    const receiptHtml = (title: string, copyType: string) => `
      <div class="receipt">
        <div class="header">
          <div class="logo-box">
             ${systemConfig?.logoUrl ? 
               `<img src="${systemConfig.logoUrl}" style="height: 80px; width: auto; object-fit: contain;" />` : 
               `<div class="placeholder-logo">E</div>`
             }
          </div>
          <div class="header-text">
             <div class="school-name">${systemConfig?.schoolName || 'ESTEADEB'}</div>
             <div class="sub-name">${systemConfig?.legalText || 'Escola Teológica das Assembleias de Deus no Brasil'}</div>
             <div class="cnpj">CNPJ: ${systemConfig?.cnpj || '40.800.393/0001-32'}</div>
          </div>
          <div class="receipt-info">
             <div class="title">${title}</div>
             <div class="copy-tag">${copyType}</div>
          </div>
        </div>
        
        <div class="content">
          <div style="font-size: 24px; font-weight: 900; text-align: right; margin-bottom: 20px; color: #1e3a8a;">VALOR: ${formattedAmount}</div>
          <p>Recebemos de <strong class="uppercase" style="font-size: 1.25rem;">${transaction.description.replace('Mensalidade: ', '')}</strong></p>
          <p>A importância supra de <strong class="amount">${formattedAmount}</strong></p>
          <p>Referente ao pagamento efetuado em <strong>${dateStr}</strong>.</p>
          <p style="margin-top: 30px; font-style: italic; color: #475569; border-top: 1px solid #f1f5f9; pt: 10px;">Pela clareza e verdade, firmamos o presente.</p>
          <p style="margin-top: 5px; font-weight: 900; color: #0f172a;">Natal/RN, ${day}</p>
        </div>

        <div class="footer">
          <div class="sig-area">
            <div class="signature"></div>
            <div class="sig-label">RESPONSÁVEL FINANCEIRO / SECRETARIA</div>
          </div>
          <div class="stamp-box">
            <div class="stamp">PAGO</div>
          </div>
        </div>
      </div>
    `;

    win.document.write(`
      <html>
        <head>
          <title>Recibo de Pagamento - ${transaction.description}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e3a8a; background: #f8fafc; }
            .receipt { 
              background: white;
              border: 2px solid #e2e8f0; 
              padding: 40px; 
              max-width: 850px; 
              margin: 0 auto; 
              position: relative;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              min-height: 480px;
              display: flex;
              flex-direction: column;
            }
            .header { display: flex; items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; position: relative; }
            .logo-box { width: 120px; }
            .header-text { flex: 1; text-align: center; padding: 0 20px; }
            .school-name { font-size: 28px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; line-height: 1; }
            .sub-name { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
            .cnpj { font-size: 8px; font-weight: 900; color: #94a3b8; margin-top: 5px; }
            .receipt-info { width: 150px; text-align: right; }
            
            .placeholder-logo { width: 60px; height: 60px; background: #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 900; color: #94a3b8; }
            
            .title { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
            .copy-tag { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #ef4444; margin-top: 4px; padding: 2px 6px; border: 1px solid #fee2e2; border-radius: 4px; display: inline-block; }
            
            .content { flex: 1; line-height: 2; font-size: 15px; }
            .amount { font-weight: 900; color: #1e3a8a; background: #eff6ff; padding: 2px 8px; border-radius: 4px; }
            
            .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
            .sig-area { flex: 1; }
            .signature { border-bottom: 2px solid #0f172a; width: 320px; height: 50px; }
            .sig-label { padding-top: 8px; font-size: 10px; font-weight: 900; color: #0f172a; letter-spacing: 1px; text-transform: uppercase; }
            .stamp-box { position: relative; }
            .stamp { 
              font-size: 32px; 
              font-weight: 900; 
              color: #22c55e; 
              border: 4px solid #22c55e; 
              padding: 4px 15px; 
              opacity: 0.8; 
              transform: rotate(-10deg);
              border-radius: 8px;
            }
            .uppercase { text-transform: uppercase; }
            @media print { 
              .no-print { display: none; } 
              body { padding: 0; background: white; }
              .receipt { box-shadow: none; border: 1px solid #ccc; page-break-inside: avoid; margin-bottom: 20px; } 
              .print-divider { margin: 20px 0; border-top: 1px dashed #000; position: relative; }
              .print-divider::after { content: '✂ RECORTAR AQUI'; position: absolute; top: -8px; left: 50%; translate: -50%; background: white; padding: 0 10px; font-size: 9px; font-weight: 900; color: #000; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 40px; text-align: center; padding: 20px; background: white; border-bottom: 1px solid #e2e8f0;">
            <button onclick="window.print()" style="padding: 16px 48px; background: #1e3a8a; color: white; border: none; border-radius: 16px; cursor: pointer; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 10px 15px -3px rgba(30,58,138,0.3); font-size: 16px;">IMPRIMIR RECIBOS (2 VIAS)</button>
            <p style="margin-top: 10px; font-size: 11px; color: #64748b; font-weight: 700;">DICA: Na tela de impressão, selecione "Apenas 1 folha" para garantir o layout correto.</p>
          </div>
          
          ${receiptHtml('Recibo de Pagamento', '1ª VIA - ESCOLA')}

          <div class="print-divider"></div>

          ${receiptHtml('Recibo de Pagamento', '2ª VIA - ALUNO')}
        </body>
      </html>
    `);
    win.document.close();
  };

  const calculateCurrentValue = (base: number, discount: number, dueDateStr: string) => {
    if (!dueDateStr) return base - discount;
    const dueDate = new Date(dueDateStr + 'T23:59:59');
    const today = new Date();
    
    const discountedValue = base - discount;
    
    if (today <= dueDate) {
      return discountedValue;
    }

    // Atrasado: 2% Multa + 1% Juros Mensais (pro-rata)
    const diffTime = Math.abs(today.getTime() - dueDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const multa = discountedValue * 0.02;
    const juros = discountedValue * (0.01 / 30) * diffDays;
    
    return discountedValue + multa + juros;
  };

  const handleNewPayment = async () => {
    const finalAmount = calculateCurrentValue(paymentData.baseValue, paymentData.discount, paymentData.dueDate);
    try {
      await addDoc(collection(db, 'transactions'), {
        description: `Mensalidade: ${paymentData.studentName}`,
        amount: finalAmount,
        type: paymentData.type,
        date: serverTimestamp(),
        nucleoId: nucleo,
        status: 'Confirmado',
        receivedBy: profile?.name,
        baseValue: paymentData.baseValue,
        discount: paymentData.discount,
        dueDate: paymentData.dueDate
      });
      setIsNewPaymentOpen(false);
      setPaymentData({ 
        studentName: '', 
        baseValue: 0, 
        discount: 0, 
        originalValue: 0,
        discountValue: 0,
        dueDate: '', 
        type: 'Escola' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  const currentValue = calculateCurrentValue(paymentData.baseValue, paymentData.discount, paymentData.dueDate);

  const [parcels, setParcels] = useState<any[]>([]);
  const [parcelSearch, setParcelSearch] = useState('');
  const [studentsConfig, setStudentsConfig] = useState<any[]>([]);

  useEffect(() => {
    if (!nucleo || !user) return;
    
    // Fetch pending parcels
    const q = query(
      collection(db, 'financial_installments'),
      where('status', '==', 'Pendente')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setParcels(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'financial_installments');
    });
    
    // Fetch students to map phone numbers for WhatsApp
    const sq = query(
      collection(db, 'students')
    );
    const unsubStudents = onSnapshot(sq, (snap) => {
      setStudentsConfig(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribe();
      unsubStudents();
    };
  }, [nucleo, user]);

  const handlePayParcel = async (parcel: any) => {
    const finalAmount = calculateCurrentValue(parcel.baseValue, parcel.discount, parcel.dueDate);
    try {
      await addDoc(collection(db, 'transactions'), {
        description: `Mensalidade: ${parcel.studentName} (${parcel.parcelNumber}/${parcel.totalParcels})`,
        amount: finalAmount,
        type: 'Escola',
        date: serverTimestamp(),
        nucleoId: nucleo,
        status: 'Confirmado',
        receivedBy: profile?.name,
        baseValue: parcel.baseValue,
        discount: parcel.discount,
        dueDate: parcel.dueDate,
        parcelId: parcel.id
      });

      await updateDoc(doc(db, 'financial_installments', parcel.id), {
        status: 'Pago',
        paidAt: serverTimestamp(),
        paidValue: finalAmount
      });

      // Log action
      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        action: `Baixa de Parcela: ${parcel.studentName} - ${parcel.parcelNumber}/${parcel.totalParcels}`,
        timestamp: serverTimestamp(),
        details: `Valor recebido: R$ ${finalAmount.toFixed(2)}`
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  const filteredParcels = parcels.filter(p => 
    p.studentName.toLowerCase().includes(parcelSearch.toLowerCase()) ||
    String(p.matricula || '').includes(parcelSearch)
  );

  const billingAlerts = useMemo(() => {
    const alerts: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    parcels.forEach((p) => {
      if (!p.dueDate) return;
      const dueDate = new Date(p.dueDate + 'T00:00:00');
      
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const student = studentsConfig.find(s => s.id === p.studentId) || {};
      const phone = student.phone || '';
      
      let status = '';
      let text = '';
      let urgent = false;
      let relevant = false;
      
      // Regua triggers
      if (diffDays === 5 || diffDays === 3) {
        status = `Vence em ${diffDays} dias`;
        text = `Lembrete (Pré-vencimento)`;
        relevant = true;
      } else if (diffDays === 1) {
        status = 'Vence Amanhã';
        text = 'Lembrete Final D-1';
        relevant = true;
      } else if (diffDays === 0) {
        status = 'Vence Hoje';
        text = 'Lembrete de Vencimento';
        urgent = true;
        relevant = true;
      } else if (diffDays === -1) {
        status = 'Atrasado: 1 dia';
        text = 'Aviso D+1';
        urgent = true;
        relevant = true;
      } else if (diffDays === -3 || diffDays === -5) {
        status = `Atrasado: ${Math.abs(diffDays)} dias`;
        text = `Cobrança D+${Math.abs(diffDays)}`;
        urgent = true;
        relevant = true;
      } else if (diffDays < -5 && diffDays >= -30) {
         status = `Atrasado: ${Math.abs(diffDays)} dias`;
         text = 'Cobrança Severa / Risco Bloqueio';
         urgent = true;
         // Show it if it's a specific milestone (e.g., 7, 10, 15 days late)
         if ([-7, -10, -15, -20, -30].includes(diffDays)) {
           relevant = true;
         }
      }

      if (relevant) {
        const val = calculateCurrentValue(p.originalValue, p.discountValue, p.dueDate);
        const dateStr = p.dueDate.split('-').reverse().join('/');
        let msg = `Olá, ${p.studentName}! Tudo bem? Passando para lembrar da `;
        if (diffDays > 0) msg += `sua matrícula/mensalidade da ESTEADEB (R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}) que vence no dia ${dateStr}. `;
        else if (diffDays === 0) msg += `sua matrícula/mensalidade da ESTEADEB (R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}) que vence HOJE. `;
        else msg += `sua matrícula/mensalidade da ESTEADEB (R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}), referente ao vencimento em ${dateStr}. O sistema acusou um débito pendente. `;
        msg += `Caso já tenha efetuado o pagamento, por favor desconsidere e envie o comprovante para baixarmos no sistema. Deus te abençoe grandemente!`;
        
        let link = '';
        if (phone) {
           const cleanPhone = phone.replace(/\D/g, '');
           if (cleanPhone.length >= 10) {
             link = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`;
           }
        }
        
        alerts.push({
           id: p.id,
           student: p.studentName,
           days: diffDays,
           statusName: status,
           actionText: text,
           link,
           urgent,
           phone
        });
      }
    });

    return alerts.sort((a, b) => a.days - b.days); // Sort lowest days to highest (most late to most early)
  }, [parcels, studentsConfig]);

  const [activeSubTab, setActiveSubTab] = useState('history');

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy tracking-tight">Financeiro Master</h1>
          <p className="text-gray-500">Gestão de cobrança, baixa manual e régua automática.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isConferenceOpen} onOpenChange={setIsConferenceOpen}>
            <DialogTrigger render={
              <Button variant="outline" className="border-navy text-navy gap-2">
                <Calculator size={18} /> Conferência Cega
              </Button>
            } />
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle className="text-navy text-xl flex items-center gap-2">
                  <Banknote className="text-petrol" /> Auditoria de Caixa Físico
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-8 py-4">
                <div className="space-y-4">
                  <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400">Cédulas e Moedas</h4>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {Object.keys(physicalCash).map((val) => (
                        <div key={val} className="flex items-center justify-between gap-4">
                          <Label className="w-24 font-mono font-bold">R$ {parseFloat(val).toFixed(2)}</Label>
                          <Input 
                            type="number" 
                            className="w-24 text-right"
                            value={physicalCash[val as keyof typeof physicalCash]}
                            onChange={(e) => setPhysicalCash({...physicalCash, [val]: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl flex flex-col justify-between">
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">Saldo Digital (Sistema)</p>
                      <p className="text-2xl font-bold text-navy">R$ {cashierTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">Saldo Físico (Declarado)</p>
                      <p className="text-2xl font-bold text-petrol">R$ {physicalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className={cn(
                      "p-4 rounded-xl border-2",
                      Math.abs(difference) < 0.01 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    )}>
                      <p className="text-xs uppercase tracking-widest font-bold mb-1">Diferença</p>
                      <p className={cn("text-xl font-black", Math.abs(difference) < 0.01 ? "text-green-600" : "text-red-600")}>
                        R$ {difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] mt-2 opacity-70">
                        {Math.abs(difference) < 0.01 ? "✓ Caixa batido com sucesso." : "⚠ Atenção: O físico não coincide com o digital."}
                      </p>
                    </div>
                  </div>
                  <Button className="w-full bg-navy mt-6" onClick={() => setIsConferenceOpen(false)}>
                    Finalizar Conferência
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isNewPaymentOpen} onOpenChange={setIsNewPaymentOpen}>
            <DialogTrigger render={
              <Button className="bg-petrol hover:bg-petrol-dark gap-2">
                <Receipt size={18} /> Baixa Manual
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-navy flex items-center gap-2">
                  <DollarSign className="text-petrol" /> Novo Recebimento (Desconto Imortal)
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Aluno</Label>
                  <Input 
                    placeholder="Ex: João da Silva" 
                    value={paymentData.studentName}
                    onChange={(e) => setPaymentData({...paymentData, studentName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Base (R$)</Label>
                    <Input 
                      type="number" 
                      value={paymentData.baseValue}
                      onChange={(e) => setPaymentData({...paymentData, baseValue: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bolsa/Desconto (R$)</Label>
                    <Input 
                      type="number" 
                      value={paymentData.discount}
                      onChange={(e) => setPaymentData({...paymentData, discount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Vencimento</Label>
                    <Input 
                      type="date" 
                      value={paymentData.dueDate}
                      onChange={(e) => setPaymentData({...paymentData, dueDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Receita</Label>
                    <select 
                      className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm"
                      value={paymentData.type}
                      onChange={(e) => setPaymentData({...paymentData, type: e.target.value})}
                    >
                      <option value="Escola">Escola (Mensalidade)</option>
                      <option value="Lanche">Lanche (Cantina)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-navy/5 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>VALOR LÍQUIDO (COM DESCONTO)</span>
                    <span>R$ {(paymentData.originalValue - paymentData.discountValue).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-red-500">
                    <span>MULTA (2%) + JUROS DIÁRIOS</span>
                    <span>R$ {(currentValue - (paymentData.originalValue - paymentData.discountValue)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-navy pt-2 border-t border-navy/10">
                    <span>TOTAL A RECEBER</span>
                    <span>R$ {currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewPaymentOpen(false)}>Cancelar</Button>
                <Button className="bg-petrol" onClick={handleNewPayment}>Confirmar Recebimento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <nav className="flex gap-4 border-b border-gray-200">
        {[
          { id: 'history', label: 'Histórico', icon: Clock },
          { id: 'regua', label: 'Régua de Cobrança', icon: Clock },
          { id: 'cashier', label: 'Conferência de Caixa', icon: Calculator },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all",
              activeSubTab === tab.id ? "border-petrol text-petrol" : "border-transparent text-gray-400 hover:text-navy"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      {activeSubTab === 'history' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-100">
            <h3 className="text-xl font-black text-navy uppercase tracking-tight">Histórico de Transações</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Últimas 50 movimentações do núcleo</p>
          </div>
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Data</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Descrição</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Valor</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Tipo</TableHead>
                <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/50 transition-all">
                  <TableCell className="p-6 font-bold text-slate-600 text-xs">
                    {t.date?.toDate ? t.date.toDate().toLocaleString('pt-BR') : '---'}
                  </TableCell>
                  <TableCell className="p-6 font-black text-navy uppercase text-sm tracking-tight">
                    {t.description}
                  </TableCell>
                  <TableCell className="p-6 font-black text-emerald-600">
                    R$ {t.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="p-6">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{t.type}</Badge>
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-petrol hover:text-petrol-dark"
                        onClick={() => generateReceipt(t)}
                      >
                        <Printer size={16} />
                      </Button>
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteTransaction(t.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activeSubTab === 'regua' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-navy text-lg">Próximas Ações de Cobrança</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {billingAlerts.length > 0 ? billingAlerts.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-petrol/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                          item.urgent ? "bg-red-100 text-red-600" : "bg-navy/10 text-navy"
                        )}>
                          {item.student.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-navy text-sm">{item.student}</p>
                          <p className={cn("text-[10px] uppercase font-bold", item.urgent ? "text-red-500" : "text-gray-400")}>
                            {item.statusName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <Badge variant="outline" className="text-[10px] font-black">{item.actionText}</Badge>
                        {item.link ? (
                          <a 
                            href={item.link} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-green-500 hover:bg-green-600 text-white text-[10px] font-black py-1 px-3 rounded-full flex items-center gap-1 transition-all"
                          >
                            <MessageCircle size={12} /> Enviar Alerta
                          </a>
                        ) : (
                          <span className="text-[9px] text-gray-400 flex items-center gap-1">
                            <Smartphone size={10} /> Sem contato
                          </span>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="py-12 text-center text-gray-400">
                       <CheckCircle2 size={32} className="mx-auto mb-3 opacity-20" />
                       <p className="text-sm font-bold uppercase tracking-widest">Nenhuma ação de cobrança para hoje.</p>
                       <p className="text-xs">Todos os alertas estão em dia!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <div className="bg-navy p-6 rounded-2xl text-white">
              <h3 className="font-bold mb-4">Configuração da Régua</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span>D-5: Lembrete Antecipado</span>
                  <Badge className="bg-petrol">Ativo</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>D+1: Notificação de Atraso</span>
                  <Badge className="bg-petrol">Ativo</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>D+15: Bloqueio de Portal</span>
                  <Badge className="bg-red-500">Inativo</Badge>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-6 border-white/20 text-white hover:bg-white/10">
                Editar Fluxo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
