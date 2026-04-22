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
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  MapPin,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Building2
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Polo {
  id: string;
  name: string;
  address: string;
  city?: string;
  coordinator: string;
  phone: string;
  email: string;
  createdAt?: any;
}

export const Polos: React.FC = () => {
  const { profile, user } = useAuth();
  const [units, setUnits] = useState<Polo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    coordinator: '',
    phone: '',
    email: ''
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
    const q = query(collection(db, 'school_units'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Polo[];
      setUnits(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'school_units');
    });

    return () => unsubscribe();
  }, [user]);

  const handleOpenModal = (unit?: Polo) => {
    if (unit) {
      setEditingId(unit.id);
      setFormData({
        name: unit.name,
        address: unit.address,
        city: unit.city || '',
        coordinator: unit.coordinator,
        phone: unit.phone,
        email: unit.email
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        address: '',
        city: '',
        coordinator: '',
        phone: '',
        email: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.coordinator) {
      addToast('Preencha os campos obrigatórios', 'error');
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'school_units', editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || profile?.uid || 'system'
        });
        addToast('Núcleo atualizado com sucesso', 'success');
      } else {
        await addDoc(collection(db, 'school_units'), {
          ...formData,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || profile?.uid || 'system'
        });
        addToast('Núcleo criado com sucesso', 'success');
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'school_units');
      addToast('Erro ao salvar núcleo', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'school_units', deleteConfirm.id));
      addToast('Núcleo excluído com sucesso', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'school_units');
      addToast('Erro ao excluir núcleo', 'error');
    }
  };

  const filteredUnits = units.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.coordinator.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[300] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-right-full duration-300",
            t.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
          )}>
            {t.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-bold">{t.title}</span>
          </div>
        ))}
      </div>

      {/* Delete Confirmation */}
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
                  Deseja realmente excluir o núcleo <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>? Esta ação é irreversível.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                <Button variant="destructive" className="flex-1" onClick={handleDelete}>Excluir</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy tracking-tight flex items-center gap-3">
            <Building2 className="text-petrol" /> Gestão de Polos
          </h1>
          <p className="text-gray-500">Administração de polos e unidades de ensino remoto.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-petrol hover:bg-petrol-dark gap-2">
          <Plus size={18} /> Novo Polo
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar por nome, coordenador ou cidade..." 
              className="pl-10 bg-gray-50 border-none focus-visible:ring-petrol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-bold text-navy">Polo</TableHead>
                <TableHead className="font-bold text-navy">Coordenador</TableHead>
                <TableHead className="font-bold text-navy">Contato</TableHead>
                <TableHead className="text-right font-bold text-navy">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-gray-400">
                    Nenhum polo encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUnits.map((unit) => (
                  <TableRow key={unit.id} className="hover:bg-gray-50 transition-colors group">
                    <TableCell>
                      <div>
                        <p className="font-bold text-navy leading-none">{unit.name}</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <MapPin size={12} /> {unit.address}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-petrol" />
                        <span className="text-sm text-gray-600">{unit.coordinator}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <Phone size={12} /> {unit.phone}
                        </p>
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <Mail size={12} /> {unit.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-petrol hover:bg-petrol/5"
                          onClick={() => handleOpenModal(unit)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-400 hover:bg-red-50"
                          onClick={() => setDeleteConfirm({ id: unit.id, name: unit.name })}
                        >
                          <Trash2 size={16} />
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-navy text-xl">
              {editingId ? 'Editar Polo' : 'Novo Polo'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Polo</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Polo São Paulo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <Input 
                  id="address" 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coordinator">Coordenador</Label>
                  <Input 
                    id="coordinator" 
                    value={formData.coordinator} 
                    onChange={e => setFormData({...formData, coordinator: e.target.value})}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input 
                    id="phone" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="contato@polo.com"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button className="bg-navy" onClick={handleSave}>
              {editingId ? 'Salvar Alterações' : 'Criar Núcleo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
