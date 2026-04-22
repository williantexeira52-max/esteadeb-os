import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  setDoc,
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
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Globe,
  ShieldAlert,
  Phone,
  Shield,
  AlertTriangle,
  UserCircle
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  cpf: string;
  unitId: string;
  unitName: string;
  isGlobalAccess: boolean;
  restrictedNucleo?: 'ALL' | 'PRESENCIAL' | 'EAD' | 'SEMIPRESENCIAL';
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

export const Users: React.FC = () => {
  const { profile, user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    cpf: '',
    unitId: '',
    isGlobalAccess: false,
    restrictedNucleo: 'ALL' as 'ALL' | 'PRESENCIAL' | 'EAD' | 'SEMIPRESENCIAL',
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
    // Fetch Users
    const qUsers = query(collection(db, 'app_users'), orderBy('name', 'asc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
      setUsers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'app_users');
    });

    // Fetch Units
    const qUnits = query(collection(db, 'school_units'), orderBy('name', 'asc'));
    const unsubscribeUnits = onSnapshot(qUnits, (snapshot) => {
      setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeUsers();
      unsubscribeUnits();
    };
  }, []);

  const handleOpenModal = (user?: AppUser) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        name: user.name,
        email: user.email,
        password: user.password,
        phone: user.phone,
        cpf: user.cpf || '',
        unitId: user.unitId,
        isGlobalAccess: user.isGlobalAccess || false,
        restrictedNucleo: user.restrictedNucleo || 'ALL',
        permissions: user.permissions || []
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        cpf: '',
        unitId: '',
        isGlobalAccess: false,
        restrictedNucleo: 'ALL',
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
    const isPoloRequired = formData.restrictedNucleo === 'SEMIPRESENCIAL' || formData.restrictedNucleo === 'ALL';
    
    if (!formData.name || !formData.email || !formData.password || (isPoloRequired && !formData.unitId)) {
      addToast('Preencha os campos obrigatórios', 'error');
      return;
    }

    const selectedUnit = units.find(u => u.id === formData.unitId);
    const finalUnitName = formData.unitId === 'none' || !formData.unitId ? 'MATRIZ' : (selectedUnit?.name || '');
    const finalUnitId = formData.unitId === 'none' ? '' : formData.unitId;

    try {
      const normalizedEmail = formData.email.toLowerCase().trim();
      const data = {
        ...formData,
        email: normalizedEmail,
        unitId: finalUnitId,
        unitName: finalUnitName,
        role: formData.isGlobalAccess ? 'Direção' : 'Coordenador',
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'app_users', editingId), data);
        // Also ensure a copy exists at the email ID for robust rules lookup
        await setDoc(doc(db, 'app_users', normalizedEmail), {
          ...data,
          lastSync: serverTimestamp()
        }, { merge: true });
        addToast('Usuário atualizado com sucesso', 'success');
      } else {
        // Use email as primary ID for new users to simplify security rules
        await setDoc(doc(db, 'app_users', normalizedEmail), {
          ...data,
          createdAt: serverTimestamp(),
          createdBy: profile?.uid || user?.uid || 'system'
        });
        addToast('Usuário criado com sucesso', 'success');
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'app_users');
      addToast('Erro ao salvar usuário', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'app_users', deleteConfirm.id));
      addToast('Usuário excluído com sucesso', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'app_users');
      addToast('Erro ao excluir usuário', 'error');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.unitName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(u.cpf || '').includes(searchTerm)
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
                  Deseja realmente excluir o usuário <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>?
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
            <UserCircle className="text-petrol" /> Gestão de Coordenadores
          </h1>
          <p className="text-gray-500">Administração de acessos para coordenadores de polos e núcleos.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-petrol hover:bg-petrol-dark gap-2">
          <Plus size={18} /> Novo Coordenador
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar por nome, e-mail ou núcleo..." 
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
                <TableHead className="font-bold text-navy">Coordenador</TableHead>
                <TableHead className="font-bold text-navy">Núcleo Vinculado</TableHead>
                <TableHead className="font-bold text-navy">Escopo de Acesso</TableHead>
                <TableHead className="font-bold text-navy">Credenciais</TableHead>
                <TableHead className="text-right font-bold text-navy">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-gray-400">
                    Nenhum coordenador encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50 transition-colors group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-petrol/10 flex items-center justify-center text-petrol font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-navy leading-none">{user.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{user.email}</p>
                          {user.cpf && <p className="text-[10px] text-petrol font-bold mt-1 uppercase tracking-tighter">CPF: {user.cpf}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">{user.unitName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.isGlobalAccess ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-none gap-1">
                          <Globe size={10} /> Global
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-none gap-1">
                          <ShieldAlert size={10} /> Restrito
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono text-gray-500">ID: {user.email || user.cpf || '---'}</p>
                        <p className="text-[10px] font-mono text-gray-400">Senha: ••••••••</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-petrol hover:bg-petrol/5"
                          onClick={() => handleOpenModal(user)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-400 hover:bg-red-50"
                          onClick={() => setDeleteConfirm({ id: user.id, name: user.name })}
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
              {editingId ? 'Editar Coordenador' : 'Novo Coordenador'}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="grid gap-6 py-4">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-navy uppercase tracking-widest border-b pb-2">Perfil do Coordenador</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input id="cpf" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value.replace(/\D/g, '').slice(0, 11)})} placeholder="Somente números" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail (Login)</Label>
                    <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"}
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-petrol"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-navy uppercase tracking-widest border-b pb-2">Vínculo e Escopo</h3>
                <div className="grid grid-cols-2 gap-6 items-end">
                  <div className="space-y-2">
                    <Label>Núcleo / Polo de Origem</Label>
                    <Select 
                      value={formData.unitId || 'none'} 
                      onValueChange={val => setFormData({...formData, unitId: val === 'none' ? '' : val})}
                      disabled={formData.restrictedNucleo === 'EAD' || formData.restrictedNucleo === 'PRESENCIAL'}
                    >
                      <SelectTrigger className={cn("bg-gray-50 border-none", (formData.restrictedNucleo === 'EAD' || formData.restrictedNucleo === 'PRESENCIAL') && "opacity-50")}>
                        <SelectValue placeholder={formData.restrictedNucleo === 'EAD' || formData.restrictedNucleo === 'PRESENCIAL' ? "MATRIZ" : "Selecione um núcleo"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">MATRIZ (Geral)</SelectItem>
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(formData.restrictedNucleo === 'EAD' || formData.restrictedNucleo === 'PRESENCIAL') && (
                      <p className="text-[10px] text-petrol font-bold italic mt-1">
                        * Modalidade {formData.restrictedNucleo} vinculada automaticamente à MATRIZ.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold text-navy">Acesso Global</Label>
                      <p className="text-[10px] text-gray-500 leading-tight">Permite visualizar dados de todos os núcleos.</p>
                    </div>
                    <Switch 
                      checked={formData.isGlobalAccess}
                      onCheckedChange={val => setFormData({...formData, isGlobalAccess: val})}
                    />
                  </div>
                </div>

                <div className="p-4 bg-petrol/5 rounded-2xl border border-petrol/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-bold text-navy">Restrição de Modalidade</Label>
                      <p className="text-xs text-gray-500">Defina se este usuário atua em uma modalidade específica.</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Select 
                      value={formData.restrictedNucleo || 'ALL'} 
                      onValueChange={(val: any) => setFormData({...formData, restrictedNucleo: val})}
                    >
                      <SelectTrigger className="bg-white border-none shadow-sm">
                        <SelectValue placeholder="Selecione a modalidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas as Modalidades (Global)</SelectItem>
                        <SelectItem value="PRESENCIAL">Somente PRESENCIAL</SelectItem>
                        <SelectItem value="EAD">Somente EAD</SelectItem>
                        <SelectItem value="SEMIPRESENCIAL">Somente SEMIPRESENCIAL</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {formData.restrictedNucleo && formData.restrictedNucleo !== 'ALL' && (
                      <div className="flex items-center gap-2 text-petrol bg-petrol/10 px-3 py-2 rounded-lg">
                        <ShieldAlert size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Acesso Restrito ao {formData.restrictedNucleo}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-navy uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                  <Shield size={16} className="text-petrol" /> Módulos Permitidos
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
              {editingId ? 'Salvar Alterações' : 'Criar Coordenador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
