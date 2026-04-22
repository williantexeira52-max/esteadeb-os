import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Megaphone, 
  Bell, 
  AlertTriangle, 
  Trash2, 
  Users, 
  Calendar, 
  Plus, 
  X, 
  Loader2,
  Clock,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  message: string;
  targetAudience: string;
  isUrgent: boolean;
  createdAt: any;
  createdBy: string;
}

export const Announcements: React.FC = () => {
  const { profile, user, nucleo } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, title: string } | null>(null);

  const [form, setForm] = useState({
    title: '',
    message: '',
    targetAudience: 'Todos os Alunos',
    isUrgent: false
  });

  useEffect(() => {
    if (!user || !nucleo) return;
    const unsubscribeAnnouncements = onSnapshot(
      query(
        collection(db, 'school_announcements'), 
        where('nucleoId', '==', nucleo),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'school_announcements')
    );

    const unsubscribeClasses = onSnapshot(
      query(
        collection(db, 'classes'), 
        where('nucleoId', '==', nucleo),
        orderBy('name', 'asc')
      ),
      (snapshot) => {
        setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubscribeAnnouncements();
      unsubscribeClasses();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addDoc(collection(db, 'school_announcements'), {
        ...form,
        nucleoId: nucleo,
        createdAt: serverTimestamp(),
        createdBy: profile?.name || 'Administração'
      });
      setIsModalOpen(false);
      setForm({
        title: '',
        message: '',
        targetAudience: 'Todos os Alunos',
        isUrgent: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'school_announcements');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'school_announcements', deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'school_announcements');
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Mural de Avisos</h1>
          <p className="text-slate-500 font-medium mt-1">Comunicados oficiais para alunos, professores e colaboradores.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-petrol hover:bg-petrol-dark text-white px-8 h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-petrol/20 flex items-center gap-3 transition-all transform hover:scale-[1.02]"
        >
          <Plus size={20} />
          Novo Comunicado
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats / Quick Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black text-navy uppercase tracking-tight flex items-center gap-2">
              <Info size={20} className="text-petrol" />
              Status do Mural
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-bold text-slate-500 uppercase">Total de Avisos</span>
                <span className="text-xl font-black text-navy">{announcements.length}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl">
                <span className="text-xs font-bold text-red-500 uppercase">Alta Urgência</span>
                <span className="text-xl font-black text-red-600">
                  {announcements.filter(a => a.isUrgent).length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-navy p-8 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-black uppercase tracking-tight">Dica de Gestão</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Use o nível de <strong>Alta Urgência</strong> apenas para comunicados críticos como suspensão de aulas ou prazos finais de matrícula.
              </p>
            </div>
            <Megaphone size={120} className="absolute -bottom-8 -right-8 text-white/5 rotate-12" />
          </div>
        </div>

        {/* Announcements Feed */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-12 h-12 text-petrol animate-spin" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando Comunicados...</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="bg-white p-20 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center text-center space-y-4">
              <div className="p-6 bg-slate-50 rounded-full">
                <Bell size={48} className="text-slate-300" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-navy uppercase tracking-tight">Mural Vazio</h3>
                <p className="text-slate-400 font-medium">Não há comunicados ativos no momento.</p>
              </div>
            </div>
          ) : (
            announcements.map((announcement) => (
              <div 
                key={announcement.id}
                className={cn(
                  "bg-white rounded-[2.5rem] shadow-sm border-l-[12px] transition-all hover:shadow-md group",
                  announcement.isUrgent ? "border-red-500" : "border-petrol"
                )}
              >
                <div className="p-8">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          announcement.isUrgent ? "bg-red-100 text-red-600" : "bg-petrol/10 text-petrol"
                        )}>
                          {announcement.isUrgent ? 'Alta Urgência' : 'Informativo'}
                        </Badge>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Users size={12} /> {announcement.targetAudience}
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-navy uppercase tracking-tight leading-none group-hover:text-petrol transition-colors">
                        {announcement.title}
                      </h2>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setDeleteConfirm({ id: announcement.id, title: announcement.title })}
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </Button>
                  </div>

                  <div className="prose prose-slate max-w-none mb-8">
                    <p className="text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">
                      {announcement.message}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {announcement.createdAt?.toDate().toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {announcement.createdAt?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Postado por:</span>
                      <span className="text-[10px] font-black text-navy uppercase tracking-widest">{announcement.createdBy}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
                  Deseja realmente excluir o aviso <span className="font-bold text-slate-900">"{deleteConfirm.title}"</span>?
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
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  Apagar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-8 flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-petrol rounded-2xl shadow-lg shadow-petrol/20">
                  <Megaphone size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Novo Comunicado</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Disparo de avisos institucionais</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={28} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título do Aviso *</label>
                <Input 
                  required
                  placeholder="Ex: Suspensão de Aulas - Feriado Nacional"
                  className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold text-lg"
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Público Alvo</label>
                  <select 
                    className="w-full h-14 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={form.targetAudience}
                    onChange={(e) => setForm({...form, targetAudience: e.target.value})}
                  >
                    <option value="Todos os Alunos">Todos os Alunos</option>
                    <option value="Professores">Professores</option>
                    <option value="Funcionários">Funcionários</option>
                    <option value="Todos">Público Geral</option>
                    {classes.map(c => (
                      <option key={c.id} value={`Turma: ${c.name}`}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div 
                      onClick={() => setForm({...form, isUrgent: !form.isUrgent})}
                      className={cn(
                        "w-14 h-8 rounded-full transition-all relative",
                        form.isUrgent ? "bg-red-500" : "bg-slate-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all",
                        form.isUrgent ? "left-7" : "left-1"
                      )} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-tight text-navy">Alta Urgência</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destaque em Vermelho</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mensagem Detalhada *</label>
                <Textarea 
                  required
                  placeholder="Escreva aqui o conteúdo completo do comunicado..."
                  className="min-h-[200px] bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-petrol font-medium p-6 leading-relaxed"
                  value={form.message}
                  onChange={(e) => setForm({...form, message: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest border-2" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={saving} 
                  className="flex-1 h-14 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-petrol/20"
                >
                  {saving ? <Loader2 className="animate-spin" /> : 'Publicar Aviso'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
