import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
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
  User,
  Phone,
  Mail,
  Shield,
  Briefcase,
  Calendar,
  MapPin,
  MoreVertical,
  CheckSquare,
  Square,
  UserCog,
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
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  address: string;
  role: string;
  admissionDate: string;
  permissions: string[];
  createdAt?: any;
}

const SYSTEM_MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'students', label: 'Alunos' },
  { id: 'classes', label: 'Turmas' },
  { id: 'courses', label: 'Cursos' },
  { id: 'curriculum', label: 'Grade' },
  { id: 'modules', label: 'Módulos' },
  { id: 'grades', label: 'Notas' },
  { id: 'requests', label: 'Requerimentos' },
  { id: 'schedules', label: 'Horários' },
  { id: 'finance', label: 'Hub Financeiro' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'stock', label: 'Estoque' },
  { id: 'announcements', label: 'Avisos' },
  { id: 'calendar', label: 'Calendário' },
  { id: 'units', label: 'Unidades' }
];

export const Employees: React.FC = () => {
  const { profile, nucleo, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    phone: '',
    email: '',
    address: '',
    role: '',
    admissionDate: new Date().toISOString().split('T')[0],
    permissions: [] as string[]
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
    const q = query(collection(db, 'school_employees'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'school_employees');
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setEditingId(employee.id);
      setFormData({
        name: employee.name,
        cpf: employee.cpf,
        phone: employee.phone,
        email: employee.email,
        address: employee.address,
        role: employee.role,
        admissionDate: employee.admissionDate,
        permissions: employee.permissions || []
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        cpf: '',
        phone: '',
        email: '',
        address: '',
        role: '',
        admissionDate: new Date().toISOString().split('T')[0],
        permissions: []
      });
    }
    setIsModalOpen(true);
  };

  const handleTogglePermission = (moduleId: string) => {
    setFormData(prev => {
      const permissions = prev.permissions.includes(moduleId)
        ? prev.permissions.filter(p => p !== moduleId)
        : [...prev.permissions, moduleId];
      return { ...prev, permissions };
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.role || !formData.email) {
      addToast('Preencha os campos obrigatórios', 'error');
      return;
    }

    try {
      const data = {
        ...formData,
        nucleoId: nucleo,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'school_employees', editingId), data);
        
        // Sync with app_users for RBAC access using email as the stable ID
        if (formData.email) {
          const userDocId = formData.email;
          await setDoc(doc(db, 'app_users', userDocId), {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            permissions: formData.permissions,
            nucleoId: nucleo,
            cpf: formData.cpf,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        
        addToast('Funcionário atualizado com sucesso', 'success');
      } else {
        const empRef = await addDoc(collection(db, 'school_employees'), {
          ...data,
          createdAt: serverTimestamp(),
          createdBy: profile?.id || profile?.uid || 'system'
        });

        // Create initial app_users record using email as the stable ID
        if (formData.email) {
          await setDoc(doc(db, 'app_users', formData.email), {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            permissions: formData.permissions,
            nucleoId: nucleo,
            cpf: formData.cpf,
            createdAt: serverTimestamp()
          });
        }

        addToast('Funcionário cadastrado com sucesso', 'success');
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'school_employees');
      addToast('Erro ao salvar funcionário', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'school_employees', deleteConfirm.id));
      addToast('Funcionário excluído com sucesso', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'school_employees');
      addToast('Erro ao excluir funcionário', 'error');
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cpf.toString().includes(searchTerm)
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
                  Deseja realmente excluir o funcionário <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>?
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
            <UserCog className="text-petrol" /> Gestão de Funcionários
          </h1>
          <p className="text-gray-500">Controle de colaboradores presenciais e permissões de acesso.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-petrol hover:bg-petrol-dark gap-2">
          <Plus size={18} /> Novo Funcionário
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar por nome, cargo ou CPF..." 
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
                <TableHead className="font-bold text-navy">Funcionário</TableHead>
                <TableHead className="font-bold text-navy">Cargo / Função</TableHead>
                <TableHead className="font-bold text-navy">Acesso</TableHead>
                <TableHead className="font-bold text-navy">Admissão</TableHead>
                <TableHead className="text-right font-bold text-navy">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-gray-400">
                    Nenhum funcionário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-gray-50 transition-colors group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-navy/5 flex items-center justify-center text-navy font-bold">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-navy leading-none">{emp.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{emp.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-bold text-petrol border-petrol/20">
                        {emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-navy/5 text-navy border-none font-bold text-[10px] uppercase">
                        {emp.permissions?.length || 0} Módulos
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(emp.admissionDate).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-petrol hover:bg-petrol/5"
                          onClick={() => handleOpenModal(emp)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-400 hover:bg-red-50"
                          onClick={() => setDeleteConfirm({ id: emp.id, name: emp.name })}
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-navy text-xl">
              {editingId ? 'Editar Funcionário' : 'Novo Funcionário'}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="grid gap-6 py-4">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-navy uppercase tracking-widest border-b pb-2">Dados Pessoais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input id="cpf" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-navy uppercase tracking-widest border-b pb-2">Dados Profissionais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Cargo / Função</Label>
                    <Input id="role" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="Ex: Secretário" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admission">Data de Admissão</Label>
                    <Input id="admission" type="date" value={formData.admissionDate} onChange={e => setFormData({...formData, admissionDate: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-navy uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                  <Shield size={16} className="text-petrol" /> Permissões de Acesso
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {SYSTEM_MODULES.map((module) => (
                    <div 
                      key={module.id} 
                      className={cn(
                        "flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer",
                        formData.permissions.includes(module.id) 
                          ? "bg-petrol/5 border-petrol/20 text-petrol" 
                          : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200"
                      )}
                      onClick={() => handleTogglePermission(module.id)}
                    >
                      <Checkbox 
                        id={module.id} 
                        checked={formData.permissions.includes(module.id)}
                        onCheckedChange={() => handleTogglePermission(module.id)}
                      />
                      <Label htmlFor={module.id} className="text-xs font-bold cursor-pointer flex-1 uppercase tracking-tighter">
                        {module.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button className="bg-navy" onClick={handleSave}>
              {editingId ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
