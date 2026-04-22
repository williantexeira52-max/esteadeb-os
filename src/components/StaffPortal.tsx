import React, { useState } from 'react';
import { 
  ClipboardList, 
  CheckSquare, 
  Users, 
  FileText, 
  Clock, 
  AlertCircle,
  Search,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../contexts/AuthContext';

export const StaffPortal: React.FC = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const [permissions, setPermissions] = useState({
    canLaunchGrades: true,
    canManageGED: true,
    canCheckCashier: false,
    canManageStudents: true,
    canViewReports: false
  });

  const tasks = [
    { id: 1, title: 'Lançar Notas - Módulo I', priority: 'Alta', deadline: 'Hoje' },
    { id: 2, title: 'Validar GED - João Silva', priority: 'Média', deadline: 'Amanhã' },
    { id: 3, title: 'Conferência de Caixa', priority: 'Alta', deadline: 'Hoje' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy tracking-tight">Portal do Funcionário</h1>
          <p className="text-gray-500">Painel operacional para gestão rápida de tarefas e pautas.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-bold text-navy">{profile?.name}</p>
            <p className="text-[10px] text-petrol font-bold uppercase tracking-widest">{profile?.role}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-navy text-white flex items-center justify-center font-bold shadow-lg">
            {profile?.name?.charAt(0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Minhas Tarefas */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-navy text-lg flex items-center gap-2">
                <CheckSquare className="text-petrol" size={20} /> Minhas Tarefas
              </CardTitle>
              <Badge className="bg-navy">{tasks.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-petrol transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-navy group-hover:text-petrol">{task.title}</h4>
                    <Badge variant="outline" className={cn(
                      "text-[10px] uppercase font-bold",
                      task.priority === 'Alta' ? "border-red-200 text-red-600 bg-red-50" : "border-blue-200 text-blue-600 bg-blue-50"
                    )}>
                      {task.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                    <Clock size={12} /> Prazo: {task.deadline}
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-xs font-bold text-petrol hover:bg-petrol/5">
                Ver Todas as Tarefas
              </Button>
            </CardContent>
          </Card>

          <div className="bg-navy p-6 rounded-2xl text-white shadow-xl">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="text-petrol" size={18} /> Alerta de Sistema
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              O fechamento do caixa mensal ocorre em 3 dias. Certifique-se de que todas as baixas manuais foram conferidas.
            </p>
          </div>
        </div>

        {/* Ações Rápidas & Busca */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-navy mb-4">Busca Rápida de Aluno</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                placeholder="Digite nome, CPF ou matrícula..." 
                className="pl-10 h-12 bg-gray-50 border-none focus-visible:ring-petrol"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {permissions.canLaunchGrades && (
              <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-4 bg-petrol/10 text-petrol rounded-2xl group-hover:bg-petrol group-hover:text-white transition-all">
                    <ClipboardList size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-navy">Lançar Notas</h4>
                    <p className="text-xs text-gray-400">Pauta eletrônica modular</p>
                  </div>
                  <ArrowRight className="text-gray-300 group-hover:text-petrol group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-navy/10 text-navy rounded-2xl group-hover:bg-navy group-hover:text-white transition-all">
                  <Users size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-navy">Frequência</h4>
                  <p className="text-xs text-gray-400">Check-in de alunos</p>
                </div>
                <ArrowRight className="text-gray-300 group-hover:text-navy group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>

            {permissions.canManageGED && (
              <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-4 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-navy">GED & Documentos</h4>
                    <p className="text-xs text-gray-400">Validação de arquivos</p>
                  </div>
                  <ArrowRight className="text-gray-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Área de Configuração de Permissões (Apenas para demonstração do conceito de checkbox) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-navy mb-4 flex items-center gap-2">
              <ShieldCheck className="text-petrol" size={20} /> Controle de Acesso (Simulação de Checkbox)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(permissions).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <input 
                    type="checkbox" 
                    checked={value} 
                    onChange={() => setPermissions(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="w-4 h-4 text-petrol border-gray-300 rounded focus:ring-petrol"
                  />
                  <label className="text-xs font-bold text-navy uppercase tracking-wider cursor-pointer">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function for conditional classes
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
