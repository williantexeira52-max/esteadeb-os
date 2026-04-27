import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  Shield, 
  UserCog, 
  Lock, 
  CheckSquare, 
  Square,
  Search,
  MoreVertical,
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
  TableRow, 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { DataActions } from './DataActions';

export const Staff: React.FC = () => {
  const { profile, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [polos, setPolos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isPermDialogOpen, setIsPermDialogOpen] = useState(false);
  const [selectedPoloId, setSelectedPoloId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const qPolos = query(collection(db, 'school_units'), orderBy('name', 'asc'));
    const unsubscribePolos = onSnapshot(qPolos, (snapshot) => {
      setPolos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'school_units');
    });

    return () => {
      unsubscribe();
      unsubscribePolos();
    };
  }, []);

  const handleUpdateAccess = async () => {
    if (!selectedUser) return;
    try {
      const polo = polos.find(p => p.id === selectedPoloId);
      const updateData = {
        role: selectedRole,
        poloId: selectedPoloId === 'none' ? null : selectedPoloId,
        poloName: selectedPoloId === 'none' ? 'MATRIZ' : (polo ? polo.name : 'MATRIZ'),
        restrictedNucleo: selectedRole === 'Coordenador' && selectedPoloId !== 'none' ? 'SEMIPRESENCIAL' : null,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'users', selectedUser.id), updateData);
      
      // Sync with app_users (which is used for Login/Profile)
      if (selectedUser.email) {
        const { getDocs, query, collection, where, setDoc } = await import('firebase/firestore');
        const appUserSnap = await getDocs(query(collection(db, 'app_users'), where('email', '==', selectedUser.email)));
        if (!appUserSnap.empty) {
          // Update all matches (usually just one)
          for (const appDoc of appUserSnap.docs) {
            await updateDoc(doc(db, 'app_users', appDoc.id), {
              ...updateData,
              // Map for component compatibility
              unitId: updateData.poloId,
              unitName: updateData.poloName
            });
          }
        }
      }

      setIsPermDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.id}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const permissionsList = [
    { id: 'view_academic', label: 'Ver Acadêmico' },
    { id: 'edit_academic', label: 'Editar Acadêmico' },
    { id: 'view_finance', label: 'Ver Financeiro' },
    { id: 'edit_finance', label: 'Editar Financeiro' },
    { id: 'view_audit', label: 'Ver Auditoria' },
    { id: 'manage_staff', label: 'Gerir Funcionários' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy tracking-tight">Gestão de RH</h1>
          <p className="text-gray-500">Controle de acessos e matriz de permissões granulares.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DataActions 
            collectionName="users"
            data={users}
            title="Funcionarios"
            headers={[
              { key: 'name', label: 'Nome' },
              { key: 'email', label: 'E-mail' },
              { key: 'role', label: 'Cargo' },
              { key: 'nucleoId', label: 'Núcleo' }
            ]}
          />
          <Button className="bg-navy gap-2">
            <UserCog size={18} /> Novo Colaborador
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar colaborador por nome ou e-mail..." 
              className="pl-10 bg-gray-50 border-none focus-visible:ring-petrol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-bold text-navy">Colaborador</TableHead>
              <TableHead className="font-bold text-navy">Nível de Acesso</TableHead>
              <TableHead className="font-bold text-navy">Polo Base</TableHead>
              <TableHead className="font-bold text-navy">Status</TableHead>
              <TableHead className="text-right font-bold text-navy">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                      <AvatarFallback className="bg-petrol text-white text-xs">{user.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-navy leading-none">{user.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn(
                    "font-bold uppercase text-[10px]",
                    user.role === 'admin' ? "bg-navy text-white" : "bg-gray-100 text-gray-700"
                  )}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium text-gray-600">{user.poloName || 'MATRIZ'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-green-600 font-bold text-xs">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Ativo
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-navy font-bold gap-2"
                    onClick={() => {
                      setSelectedUser(user);
                      setSelectedPoloId(user.poloId || 'none');
                      setSelectedRole(user.role || 'Colaborador');
                      setIsPermDialogOpen(true);
                    }}
                  >
                    <Lock size={14} /> Permissões
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isPermDialogOpen} onOpenChange={setIsPermDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="pb-4 border-b border-slate-50">
            <DialogTitle className="text-navy text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Shield className="text-petrol" size={24} /> Configurar Acesso
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 space-y-8">
            <div className="flex items-center gap-5 p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <Avatar className="h-14 w-14 shadow-lg border-2 border-white">
                <AvatarFallback className="bg-navy text-white font-black">{selectedUser?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-black text-navy text-lg uppercase leading-none">{selectedUser?.name}</p>
                <p className="text-xs text-slate-500 font-medium mt-1 font-mono uppercase opacity-70 tracking-widest">{selectedUser?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Nível de Acesso (Cargo)</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="h-14 rounded-2xl bg-white border-2 border-slate-100 focus:border-petrol outline-none font-bold text-slate-700 shadow-sm transition-all">
                    <SelectValue placeholder="Selecione o Cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin" className="font-bold">ADMINISTRADOR GERAL</SelectItem>
                    <SelectItem value="Direção" className="font-bold">DIRETOR(A)</SelectItem>
                    <SelectItem value="Coordenador" className="font-bold text-petrol">COORDENADOR DE POLO</SelectItem>
                    <SelectItem value="Secretaria" className="font-bold">SECRETARIA ACADÊMICA</SelectItem>
                    <SelectItem value="Financeiro" className="font-bold">GESTOR FINANCEIRO</SelectItem>
                    <SelectItem value="Colaborador" className="font-bold opacity-60">COLABORADOR PADRÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Polo de Atuação</Label>
                <Select value={selectedPoloId} onValueChange={setSelectedPoloId}>
                  <SelectTrigger className="h-14 rounded-2xl bg-white border-2 border-slate-100 focus:border-petrol outline-none font-bold text-slate-700 shadow-sm transition-all">
                    <SelectValue placeholder="Selecione um Polo ou MATRIZ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="font-black">MATRIZ (CENTRAL)</SelectItem>
                    {polos.map(polo => (
                      <SelectItem key={polo.id} value={polo.id} className="font-bold">{polo.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400 font-medium italic mt-2 px-1">
                  * O acesso aos alunos, turmas e financeiro será restrito automaticamente com base nesta seleção e no cargo atribuído.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-6 border-t border-slate-50 gap-3">
            <Button variant="outline" className="h-12 rounded-xl font-bold border-slate-200" onClick={() => setIsPermDialogOpen(false)}>Cancelar</Button>
            <Button className="h-12 bg-navy px-8 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-navy/20" onClick={handleUpdateAccess}>Salvar Configuração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
