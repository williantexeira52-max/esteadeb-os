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
  orderBy,
  where,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Package, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  AlertTriangle,
  Loader2,
  Tag,
  Boxes,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  History,
  FileText,
  BarChart3,
  Printer,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  minStock: number;
  updatedAt: any;
}

export const Inventory: React.FC = () => {
  const { nucleo, user, profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const [movementForm, setMovementForm] = useState({
    type: 'ENTRY' as 'ENTRY' | 'WITHDRAWAL',
    quantity: 0,
    observation: ''
  });

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // 1st of current month
    end: new Date().toISOString().split('T')[0]
  });

  const [reportData, setReportData] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: '',
    category: 'Uniforme',
    quantity: 0,
    price: 0,
    minStock: 5
  });

  useEffect(() => {
    if (!user || !nucleo) return;
    const q = query(
      collection(db, 'inventory'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'inventory'));

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), {
          ...form,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'inventory'), {
          ...form,
          nucleoId: nucleo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setForm({ name: '', category: 'Uniforme', quantity: 0, price: 0, minStock: 5 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este item do estoque?')) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory');
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSaving(true);
    try {
      const newQuantity = movementForm.type === 'ENTRY' 
        ? selectedItem.quantity + movementForm.quantity 
        : selectedItem.quantity - movementForm.quantity;

      if (newQuantity < 0) {
        alert('Erro: Estoque insuficiente para esta retirada.');
        return;
      }

      // 1. Update Inventory
      await updateDoc(doc(db, 'inventory', selectedItem.id), {
        quantity: newQuantity,
        updatedAt: serverTimestamp()
      });

      // 2. Record Movement
      await addDoc(collection(db, 'inventory_movements'), {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        type: movementForm.type,
        quantity: movementForm.quantity,
        previousQuantity: selectedItem.quantity,
        newQuantity,
        observation: movementForm.observation,
        date: new Date().toISOString().split('T')[0],
        timestamp: serverTimestamp(),
        nucleoId: nucleo,
        createdBy: profile?.name || 'Sistema'
      });

      setIsMovementModalOpen(false);
      setMovementForm({ type: 'ENTRY', quantity: 0, observation: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory_movements');
    } finally {
      setSaving(false);
    }
  };

  const generatePeriodReport = async () => {
    setGeneratingReport(true);
    try {
      // We need movements from START to NOW to calculate the back-calculation of Starting Balance
      const qAllAfterStart = query(
        collection(db, 'inventory_movements'),
        where('nucleoId', '==', nucleo),
        where('date', '>=', dateRange.start)
      );
      const snapAll = await getDocs(qAllAfterStart);
      const allMovementsAfterStart = snapAll.docs.map(d => d.data());

      const prodStats: any = {};

      items.forEach(item => {
        // Back-calculate Saldo Inicial: Item.quantity (current) - sum of changes since Start
        const itemMoves = allMovementsAfterStart.filter((m: any) => m.itemId === item.id);
        const netChangeSinceStart = itemMoves.reduce((acc, m: any) => {
          return m.type === 'ENTRY' ? acc + m.quantity : acc - m.quantity;
        }, 0);

        const startingBalance = item.quantity - netChangeSinceStart;

        prodStats[item.id] = {
          name: item.name,
          startingBalance,
          entries: 0,
          withdrawals: 0,
          currentStock: item.quantity,
          minStock: item.minStock,
          dailyUsage: [] as number[]
        };
      });

      // Filter for the period selected [start, end]
      const periodMovements = allMovementsAfterStart.filter((m: any) => m.date <= dateRange.end);

      periodMovements.forEach((m: any) => {
        if (!prodStats[m.itemId]) return;
        if (m.type === 'ENTRY') prodStats[m.itemId].entries += m.quantity;
        else {
          prodStats[m.itemId].withdrawals += m.quantity;
          prodStats[m.itemId].dailyUsage.push(m.quantity);
        }
      });

      const finalReport = Object.values(prodStats).map((s: any) => {
        const usage = s.dailyUsage;
        const mean = usage.length > 0 ? usage.reduce((a: any, b: any) => a+b, 0) / usage.length : 0;
        const sorted = [...usage].sort((a, b) => a - b);
        const median = sorted.length > 0 
          ? (sorted.length % 2 === 0 
              ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2 
              : sorted[Math.floor(sorted.length/2)]) 
          : 0;

        return { ...s, mean, median };
      });

      setReportData(finalReport);
      setIsReportModalOpen(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'inventory_movements');
    } finally {
      setGeneratingReport(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Gestão de Estoque</h1>
          <p className="text-slate-500 font-medium mt-1">Materiais, uniformes e suprimentos institucionais.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={() => generatePeriodReport()}
            disabled={generatingReport}
            variant="outline"
            className="h-14 px-8 rounded-2xl border-2 border-slate-200 text-slate-600 font-black uppercase tracking-widest flex items-center gap-3"
          >
            {generatingReport ? <Loader2 className="animate-spin" /> : <BarChart3 size={20} />}
            Relatório
          </Button>
          <DataActions 
            collectionName="inventory"
            data={items}
            title="Estoque"
            headers={[
              { key: 'name', label: 'Nome do Item' },
              { key: 'category', label: 'Categoria' },
              { key: 'quantity', label: 'Quantidade', type: 'number' },
              { key: 'price', label: 'Preço Unitário', type: 'number' },
              { key: 'minStock', label: 'Estoque Mínimo', type: 'number' }
            ]}
          />
          <Button 
            onClick={() => {
              setEditingItem(null);
              setForm({ name: '', category: 'Uniforme', quantity: 0, price: 0, minStock: 5 });
              setIsModalOpen(true);
            }}
            className="bg-petrol hover:bg-petrol-dark text-white px-8 h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-petrol/20 flex items-center gap-3"
          >
            <Plus size={20} />
            Novo Item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Boxes size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Itens</p>
            <h3 className="text-2xl font-black text-navy">{items.length}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque Baixo</p>
            <h3 className="text-2xl font-black text-red-600">{items.filter(i => i.quantity <= i.minStock).length}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Tag size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor em Estoque</p>
            <h3 className="text-2xl font-black text-emerald-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(items.reduce((acc, i) => acc + (i.price * i.quantity), 0))}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Buscar item no estoque..." 
            className="pl-12 h-14 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-petrol font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <ScrollArea className="max-h-[600px] w-full">
          <Table>
            <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Item</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Categoria</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Quantidade</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Preço</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <td colSpan={5} className="p-20 text-center">
                  <Loader2 className="w-10 h-10 text-petrol animate-spin mx-auto mb-4" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando Estoque...</p>
                </td>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <td colSpan={5} className="p-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Nenhum item encontrado.</td>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-all group">
                  <TableCell className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                        <Package size={18} />
                      </div>
                      <span className="font-black text-navy uppercase text-sm tracking-tight">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-6">
                    <Badge variant="outline" className="font-bold uppercase text-[10px] border-slate-200 text-slate-500">
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-6">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-black text-lg",
                        item.quantity <= item.minStock ? "text-red-500" : "text-navy"
                      )}>
                        {item.quantity}
                      </span>
                      {item.quantity <= item.minStock && (
                        <AlertTriangle size={14} className="text-red-500 animate-pulse" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-6 font-bold text-slate-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setSelectedItem(item);
                          setIsMovementModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl"
                        title="Movimentar Estoque"
                      >
                        <History size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setEditingItem(item);
                          setForm({
                            name: item.name,
                            category: item.category,
                            quantity: item.quantity,
                            price: item.price,
                            minStock: item.minStock
                          });
                          setIsModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-petrol hover:bg-petrol/5 rounded-xl"
                      >
                        <Edit2 size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(item.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <Package size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingItem ? 'Editar Item' : 'Novo Item'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Item *</label>
                <Input 
                  required
                  placeholder="Ex: Camisa Polo ESTEADEB G"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                <select 
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                  value={form.category}
                  onChange={(e) => setForm({...form, category: e.target.value})}
                >
                  <option value="Uniforme">Uniforme</option>
                  <option value="Livro">Livro</option>
                  <option value="Material de Escritório">Material de Escritório</option>
                  <option value="Limpeza">Limpeza</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
                  <Input 
                    type="number" required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                    value={form.quantity}
                    onChange={(e) => setForm({...form, quantity: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Unitário</label>
                  <Input 
                    type="number" step="0.01" required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                    value={form.price}
                    onChange={(e) => setForm({...form, price: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estoque Mínimo (Alerta)</label>
                <Input 
                  type="number" required
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={form.minStock}
                  onChange={(e) => setForm({...form, minStock: Number(e.target.value)})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="animate-spin" /> : 'Salvar Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {isMovementModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <History size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Movimentar Estoque</h2>
              </div>
              <button onClick={() => setIsMovementModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleMovement} className="p-8 space-y-5">
              <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Selecionado</p>
                  <p className="font-bold text-navy">{selectedItem.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Atual</p>
                  <p className="font-black text-xl text-navy">{selectedItem.quantity}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementForm({...movementForm, type: 'ENTRY'})}
                  className={cn(
                    "h-12 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                    movementForm.type === 'ENTRY' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-50 border-slate-100 text-slate-400"
                  )}
                >
                  <ArrowUpCircle size={18} /> Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setMovementForm({...movementForm, type: 'WITHDRAWAL'})}
                  className={cn(
                    "h-12 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                    movementForm.type === 'WITHDRAWAL' ? "bg-red-600 border-red-600 text-white" : "bg-slate-50 border-slate-100 text-slate-400"
                  )}
                >
                  <ArrowDownCircle size={18} /> Saída
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
                <Input 
                  type="number" required min="1"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm({...movementForm, quantity: Number(e.target.value)})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observação / Motivo</label>
                <Input 
                  placeholder="Ex: Reposição de fornecedor"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={movementForm.observation}
                  onChange={(e) => setMovementForm({...movementForm, observation: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setIsMovementModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving || movementForm.quantity <= 0} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="animate-spin" /> : 'Confirmar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {isReportModalOpen && (
        <div id="inventory-report-modal" className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:bg-white print:p-0 print:static print:block">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* Ensure the modal is visible and takes up the whole page */
              body {
                visibility: hidden;
                background: white !important;
              }
              
              #inventory-report-modal, #inventory-report-modal * {
                visibility: visible !important;
              }

              #inventory-report-modal {
                display: block !important;
                position: absolute !important;
                left: 0;
                top: 0;
                width: 100%;
                height: auto !important;
                margin: 0;
                padding: 0;
                background: white !important;
              }

              /* Hide UI buttons and unnecessary modal parts */
              .no-print, [role="button"], button {
                display: none !important;
              }

              /* Expand scroll area */
              [data-radix-scroll-area-viewport], [data-slot="scroll-area-viewport"] {
                display: block !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
              }
              
              /* Reset padding/margins for print */
              .p-8, .p-10 { padding: 0 !important; }
            }
          `}} />
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col print:h-auto print:rounded-none print:shadow-none print:w-full print:block">
            <div className="bg-navy p-6 flex items-center justify-between text-white no-print">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Relatório de Movimentação</h2>
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Período: {dateRange.start.split('-').reverse().join('/')} até {dateRange.end.split('-').reverse().join('/')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 bg-white/10 p-2 rounded-xl">
                   <Input 
                     type="date" 
                     className="h-8 bg-transparent border-none text-white text-xs font-bold w-32" 
                     value={dateRange.start}
                     onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                   />
                   <span className="text-white/30">➜</span>
                   <Input 
                     type="date" 
                     className="h-8 bg-transparent border-none text-white text-xs font-bold w-32" 
                     value={dateRange.end}
                     onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                   />
                   <Button size="sm" className="h-8 bg-petrol" onClick={generatePeriodReport}>Filtrar</Button>
                 </div>
                 <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-8 print:p-0 print:overflow-visible">
              <div id="inventory-report-content">
                <div className="hidden print:flex items-center justify-between mb-10 border-b-4 border-navy pb-6">
                  <div className="flex items-center gap-4">
                    {useAuth().systemConfig?.logoUrl ? (
                      <img src={useAuth().systemConfig.logoUrl} alt="Logo" className="h-16 w-auto" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-16 h-16 bg-navy rounded-xl flex items-center justify-center">
                        <GraduationCap className="text-white w-10 h-10" />
                      </div>
                    )}
                    <div>
                      <h1 className="text-3xl font-black uppercase tracking-tighter text-navy">ESTEADEB</h1>
                      <p className="text-[10px] font-bold text-petrol uppercase tracking-[0.3em]">Sistema de Gestão Educacional</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-black uppercase tracking-tight text-navy">Relatório de Estoque</h2>
                    <p className="text-sm font-bold text-slate-500">Período: {dateRange.start.split('-').reverse().join('/')} até {dateRange.end.split('-').reverse().join('/')}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                  </div>
                </div>
                
                <Table className="print:text-black">
                  <TableHeader className="bg-slate-50 print:bg-slate-100">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-navy print:text-black">Produto</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center text-navy print:text-black">Saldo Inicial</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center text-navy print:text-black">Entradas</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center text-navy print:text-black">Saídas</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center text-navy print:text-black">Saldo Atual</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center text-navy print:text-black">Média</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, idx) => (
                      <TableRow key={idx} className={cn(
                        "hover:bg-slate-50",
                        item.currentStock <= item.minStock && "bg-red-50/50 print:bg-transparent"
                      )}>
                        <TableCell className="font-black text-navy py-4 uppercase text-xs tracking-tight print:text-black">
                          {item.name}
                          {item.currentStock <= item.minStock && (
                            <Badge className="ml-2 bg-red-600 text-white text-[8px] h-4 no-print shadow-none">ESTOQUE BAIXO</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-600 print:text-black">{item.startingBalance}</TableCell>
                        <TableCell className="text-center font-bold text-emerald-600 print:text-emerald-700">+{item.entries}</TableCell>
                        <TableCell className="text-center font-bold text-red-600 print:text-red-700">-{item.withdrawals}</TableCell>
                        <TableCell className={cn(
                          "text-center font-black",
                          item.currentStock <= item.minStock ? "text-red-600" : "text-navy print:text-black"
                        )}>{item.currentStock}</TableCell>
                        <TableCell className="text-center text-slate-500 font-mono text-[10px] print:text-black">
                          {item.mean.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="hidden print:grid grid-cols-2 gap-10 mt-20">
                  <div className="text-center border-t border-slate-300 pt-4">
                    <p className="text-xs font-black uppercase text-navy">{profile?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{profile?.role}</p>
                  </div>
                  <div className="text-center border-t border-slate-300 pt-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável pelo Estoque</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
            
            <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-between items-center no-print">
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest text-[8px]">Sinalização de Estoque Baixo</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsReportModalOpen(false)} className="rounded-xl px-8 h-12 font-bold">Fechar</Button>
                <Button onClick={() => window.print()} className="bg-navy hover:bg-navy-dark text-white rounded-xl px-8 h-12 font-black uppercase tracking-widest flex items-center gap-2">
                  <Printer size={18} /> Imprimir Relatório
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
