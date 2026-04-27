import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where,
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
  Layers,
  Clock,
  BookOpen,
  Calendar,
  ChevronDown,
  AlertTriangle,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { DataActions } from './DataActions';
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

  interface ModuleHistory {
  id: string;
  classId: string;
  className: string;
  year: string;
  moduleNumber: number;
  academicYear: string;
  semester: string;
  subjects: string[];
  startDate?: string;
  endDate?: string;
  professorsNotes?: string;
  createdAt?: any;
}

export const Modules: React.FC = () => {
  const { nucleo, profile, user } = useAuth();
  const [modules, setModules] = useState<ModuleHistory[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('Todos');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    classId: '',
    year: '1º',
    moduleNumber: 1,
    academicYear: new Date().getFullYear().toString(),
    semester: '1º Semestre',
    subjects: [] as string[],
    startDate: '',
    endDate: '',
    professorsNotes: ''
  });

  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!nucleo || !user) return;
    // Fetch Modules History
    const qModules = profile?.poloId
      ? query(
          collection(db, 'modules_history'),
          where('nucleoId', '==', nucleo),
          where('poloId', '==', profile.poloId)
        )
      : query(
          collection(db, 'modules_history'), 
          where('nucleoId', '==', nucleo)
        );

    const unsubscribeModules = onSnapshot(qModules, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ModuleHistory[];
      
      // Sort in-memory to avoid index requirements
      const sorted = [...list].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setModules(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'modules_history');
    });

    // Fetch Classes
    let qClasses = query(
      collection(db, 'classes'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );

    if (profile?.poloId) {
      qClasses = query(
        collection(db, 'classes'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId),
        orderBy('name', 'asc')
      );
    }

    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'classes');
    });

    // Fetch Grades (Subjects)
    const qGrades = query(
      collection(db, 'grades'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribeGrades = onSnapshot(qGrades, (snapshot) => {
      const rawGrades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const uniqueGrades = rawGrades.filter((v: any, i: number, a: any[]) => 
        a.findIndex((t: any) => (t.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "") === (v.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "")) === i
      );
      setGrades(uniqueGrades);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grades');
    });

    return () => {
      unsubscribeModules();
      unsubscribeClasses();
      unsubscribeGrades();
    };
  }, [nucleo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedClass = classes.find(c => c.id === formData.classId);
    const data = {
      ...formData,
      nucleoId: nucleo,
      poloId: profile?.poloId || null,
      poloName: profile?.poloName || 'MATRIZ',
      className: selectedClass?.name || '',
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || profile?.id || 'system'
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'modules_history', editingId), data);
        addToast('Módulo atualizado com sucesso!', 'success');
      } else {
        await addDoc(collection(db, 'modules_history'), {
          ...data,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || profile?.id || 'system'
        });
        addToast('Módulo registrado com sucesso!', 'success');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'modules_history');
      addToast('Erro ao salvar módulo.', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      classId: '',
      year: '1º',
      moduleNumber: 1,
      academicYear: new Date().getFullYear().toString(),
      semester: '1º Semestre',
      subjects: [],
      startDate: '',
      endDate: '',
      professorsNotes: ''
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const formatDateForInput = (dateStr: any) => {
    if (!dateStr) return '';
    const numericDate = Number(dateStr);
    if (!isNaN(numericDate) && numericDate > 30000 && numericDate < 60000) {
      const d = new Date((numericDate - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }
    if (typeof dateStr === 'string') {
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          // DD/MM/YYYY to YYYY-MM-DD
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return dateStr.split('T')[0]; // simple fallback
    }
    if (dateStr?.toDate) return dateStr.toDate().toISOString().split('T')[0];
    if (dateStr instanceof Date) return dateStr.toISOString().split('T')[0];
    return String(dateStr).split('T')[0];
  };

  const handleEdit = (mod: ModuleHistory) => {
    setFormData({
      classId: mod.classId,
      year: (() => {
        const y = mod.year?.toString().toLowerCase() || '';
        if (y === '1' || y.startsWith('1º') || y === '1 ano' || y === '1ano' || y === '1o ano') return '1º';
        if (y === '2' || y.startsWith('2º') || y === '2 ano' || y === '2ano' || y === '2o ano') return '2º';
        if (y === '3' || y.startsWith('3º') || y === '3 ano' || y === '3ano' || y === '3o ano') return '3º';
        if (y === '4' || y.startsWith('4º') || y === '4 ano' || y === '4ano' || y === '4o ano') return '4º';
        // if we couldn't match securely, try includes but avoid matching something like '2025'
        if (y.includes('1º') || y === '1') return '1º';
        if (y.includes('2º') || y === '2') return '2º';
        if (y.includes('3º') || y === '3') return '3º';
        if (y.includes('4º') || y === '4') return '4º';
        // fallback
        if (y.includes('1')) return '1º';
        if (y.includes('2') && !y.includes('20')) return '2º'; // simple avoidance of 2024
        if (y.includes('3')) return '3º';
        if (y.includes('4')) return '4º';
        return mod.year;
      })(),
      moduleNumber: mod.moduleNumber,
      academicYear: mod.academicYear,
      semester: mod.semester,
      subjects: mod.subjects || [],
      startDate: formatDateForInput(mod.startDate),
      endDate: formatDateForInput(mod.endDate),
      professorsNotes: mod.professorsNotes || ''
    });
    setEditingId(mod.id);
    setIsModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'modules_history', deleteConfirm.id));
      addToast('Módulo excluído com sucesso!', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'modules_history');
      addToast('Erro ao excluir módulo.', 'error');
    }
  };

  const toggleSubject = (subjectName: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subjectName)
        ? prev.subjects.filter(s => s !== subjectName)
        : [...prev.subjects, subjectName]
    }));
  };

  const formatDisplayDate = (date: any) => {
    if (!date) return '--';
    
    // Handle Excel serial dates (numbers or strings that look like serial numbers)
    const numericDate = Number(date);
    if (!isNaN(numericDate) && numericDate > 30000 && numericDate < 60000) {
      const d = new Date((numericDate - 25569) * 86400 * 1000);
      return d.toLocaleDateString('pt-BR');
    }

    if (typeof date === 'string') {
      if (date.includes('-')) {
        return date.split('-').reverse().join('/');
      }
      return date;
    }
    if (date.toDate && typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString('pt-BR');
    }
    if (date instanceof Date) {
      return date.toLocaleDateString('pt-BR');
    }
    return String(date);
  };

  const filteredModules = useMemo(() => {
    let filtered = modules;
    if (courseFilter !== 'Todos') {
      filtered = filtered.filter(m => {
        const cls = classes.find((c: any) => c.id === m.classId);
        return cls && (cls.courseName || '') === courseFilter;
      });
    }
    return filtered.filter(m => 
      m.className.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [modules, classes, searchTerm, courseFilter]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 relative">
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
                  Deseja realmente excluir o histórico do módulo <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>?
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

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <Layers size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingId ? 'Editar Histórico de Módulo' : 'Novo Histórico de Módulo'}
                </h2>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Turma</label>
                  <select 
                    required
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.classId}
                    onChange={(e) => setFormData({...formData, classId: e.target.value})}
                  >
                    <option value="">Selecione a Turma</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Ano do Curso</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: e.target.value})}
                  >
                    <option value="1º">1º Ano</option>
                    <option value="2º">2º Ano</option>
                    <option value="3º">3º Ano</option>
                    <option value="4º">4º Ano</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Número do Módulo</label>
                  <Input 
                    type="number"
                    min="1"
                    required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                    value={formData.moduleNumber}
                    onChange={(e) => setFormData({...formData, moduleNumber: parseInt(e.target.value) || 1})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Ano Letivo</label>
                  <Input 
                    required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({...formData, academicYear: e.target.value})}
                    placeholder="Ex: 2024"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Semestre</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.semester}
                    onChange={(e) => setFormData({...formData, semester: e.target.value})}
                  >
                    <option value="1º Semestre">1º Semestre</option>
                    <option value="2º Semestre">2º Semestre</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Data Inicial</label>
                  <Input 
                    type="date"
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold text-slate-700"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Data Final (Previsão)</label>
                  <Input 
                    type="date"
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold text-slate-700"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Professores e Anotações</label>
                <Input 
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold text-slate-700 placeholder:opacity-50"
                  placeholder="Ex: Teologia Básica: Pr. João | História: Pr. Silva"
                  value={formData.professorsNotes}
                  onChange={(e) => setFormData({...formData, professorsNotes: e.target.value})}
                />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Disciplinas do Módulo</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  {grades.map(grade => (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => toggleSubject(grade.name)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left",
                        formData.subjects.includes(grade.name)
                          ? "bg-petrol border-petrol text-white shadow-lg shadow-petrol/20"
                          : "bg-white border-slate-100 text-slate-600 hover:border-slate-200"
                      )}
                    >
                      <span className="text-xs font-bold truncate">{grade.name}</span>
                      {formData.subjects.includes(grade.name) && <Plus size={14} className="rotate-45" />}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.subjects.map(sub => (
                    <Badge key={sub} className="bg-navy text-white px-3 py-1 rounded-full flex items-center gap-2">
                      {sub}
                      <X size={12} className="cursor-pointer" onClick={() => toggleSubject(sub)} />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-4">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {editingId ? 'Salvar Alterações' : 'Registrar Módulo'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Histórico de Módulos</h1>
          <p className="text-slate-500 font-medium mt-1">Gestão de fases acadêmicas e disciplinas por turma.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-petrol hover:bg-petrol-dark text-white px-8 py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-petrol/20 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus size={24} /> Novo Módulo
        </Button>
      </div>

      {/* Filters & Stats */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex bg-slate-200/50 p-1 rounded-2xl max-w-fit">
          {(['Todos', 'Bacharelado Livre em Teologia', 'Médio em Teologia'] as const).map((course) => (
            <button
              key={course}
              onClick={() => setCourseFilter(course)}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                courseFilter === course 
                  ? "bg-white text-navy shadow-sm" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              {course === 'Bacharelado Livre em Teologia' ? 'Bacharelado' : course === 'Médio em Teologia' ? 'Médio' : course}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <Input 
              placeholder="Buscar por nome da turma..." 
              className="pl-12 h-14 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-petrol font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-14 w-14 rounded-2xl border-slate-100 text-slate-400">
            <Filter size={20} />
          </Button>
        </div>

        <div className="bg-navy p-6 rounded-3xl shadow-xl flex items-center justify-between text-white overflow-hidden relative">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Total de Módulos</p>
            <h3 className="text-3xl font-black mt-1">{filteredModules.length}</h3>
          </div>
          <Layers size={48} className="opacity-10 absolute -right-2 -bottom-2 rotate-12" />
        </div>
      </div>

      {/* Data Actions */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ações de Dados</h3>
        </div>
        <DataActions 
          collectionName="modules_history"
          data={modules}
          title="Historico_Modulos"
          headers={[
            { key: 'className', label: 'Turma' },
            { key: 'year', label: 'Ano_Curso' },
            { key: 'moduleNumber', label: 'Modulo', type: 'number' },
            { key: 'academicYear', label: 'Ano_Letivo' },
            { key: 'semester', label: 'Semestre' },
            { key: 'subjects', label: 'Disciplinas' },
            { key: 'startDate', label: 'Data_Inicial', type: 'date' },
            { key: 'endDate', label: 'Data_Termino', type: 'date' },
            { key: 'professorsNotes', label: 'Professores (Opcional)' }
          ]}
          templateHeaders={[
            { key: 'className', label: 'Turma (Obrigatório)' },
            { key: 'year', label: 'Ano_Curso' },
            { key: 'moduleNumber', label: 'Modulo', type: 'number' },
            { key: 'academicYear', label: 'Ano_Letivo' },
            { key: 'semester', label: 'Semestre' },
            { key: 'subjects', label: 'Disciplinas' },
            { key: 'startDate', label: 'Data_Inicial', type: 'date' },
            { key: 'endDate', label: 'Data_Termino', type: 'date' },
            { key: 'professorsNotes', label: 'Professores (Opcional)' }
          ]}
          onImportSuccess={(count) => {
            addToast(`${count} módulos importados com sucesso!`, 'success');
          }}
          transformRow={(row) => {
            // Find class by ID or Name (case insensitive)
            const rowClassName = row.className || row['Turma (Obrigatório)'] || row.Nome_Turma || row.Turma || row.Ano_Curso || '';
            const rowClassId = row.classId || row.ID_Turma || '';

            const selectedClass = classes.find(c => 
              (rowClassId && c.id === rowClassId) || 
              (rowClassName && c.name?.toLowerCase().trim() === rowClassName.toString().toLowerCase().trim()) ||
              // Flexible match for things like "1º Bacharelado" vs "Bacharelado" if unique
              (rowClassName && c.name?.toLowerCase().includes(rowClassName.toString().toLowerCase().trim()))
            );
            
            // If still not found, try searching classes that start with the number provided in Ano_Curso
            let finalClassName = selectedClass?.name || rowClassName || 'Turma Não Encontrada';
            let finalClassId = selectedClass?.id || rowClassId || '';

            if (!finalClassId && row.year) {
               const yearMatch = classes.find(c => c.name?.includes(row.year));
               if (yearMatch) {
                 finalClassId = yearMatch.id;
                 finalClassName = yearMatch.name;
               }
            }

            // Handle subjects if provided as comma-separated string in Excel
            let subjects = row.subjects || row.Disciplinas || row.Disciplinas_Separadas_Por_Virgula;
            if (typeof subjects === 'string') {
              subjects = Array.from(new Set(subjects.split(',').map(s => s.trim()).filter(Boolean)));
            } else if (Array.isArray(subjects)) {
              subjects = Array.from(new Set(subjects.map(s => String(s).trim()).filter(Boolean)));
            } else {
              subjects = [];
            }

            return {
              ...row,
              classId: finalClassId,
              className: finalClassName,
              subjects: subjects,
              nucleoId: nucleo,
              poloId: profile?.poloId || null,
              poloName: profile?.poloName || 'MATRIZ',
              updatedAt: serverTimestamp()
            };
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Turma / Ano</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Módulo / Período</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Disciplinas</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModules.length === 0 ? (
              <TableRow>
                <td colSpan={4} className="p-20 text-center">
                  <div className="flex flex-col items-center gap-4 text-slate-300">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                      <Layers size={40} className="opacity-20" />
                    </div>
                    <p className="font-bold uppercase tracking-widest text-xs">Nenhum histórico de módulo encontrado.</p>
                  </div>
                </td>
              </TableRow>
            ) : (
              filteredModules.map((mod) => (
                <TableRow key={mod.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="p-6">
                    <p className="font-black text-slate-900 uppercase text-sm tracking-tight">{mod.className}</p>
                    <Badge className="mt-1 bg-indigo-50 text-indigo-600 border-none font-black text-[10px]">
                      {mod.year} ANO
                    </Badge>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-navy text-white rounded-lg text-[10px] font-black uppercase">
                        MÓDULO {mod.moduleNumber}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
                      <Calendar size={10} /> {mod.academicYear} • {mod.semester}
                    </p>
                    {(mod.startDate || mod.endDate) && (
                      <p className="text-[10px] text-slate-500 font-bold mt-1">
                        {formatDisplayDate(mod.startDate)} até {formatDisplayDate(mod.endDate)}
                      </p>
                    )}
                  </td>
                  <td className="p-6">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {mod.subjects?.slice(0, 3).map((sub, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">
                          {sub}
                        </span>
                      ))}
                      {mod.subjects?.length > 3 && (
                        <span className="px-2 py-0.5 bg-petrol/10 text-petrol rounded text-[9px] font-bold uppercase">
                          +{mod.subjects.length - 3} OUTRAS
                        </span>
                      )}
                    </div>
                    {mod.professorsNotes && (
                      <p className="text-[9px] text-slate-500 font-medium italic mt-2 w-full max-w-xs block truncate" title={mod.professorsNotes}>
                         Resp: {mod.professorsNotes}
                      </p>
                    )}
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(mod)}
                        className="p-3 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition-all"
                        title="Editar Histórico"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ id: mod.id, name: `${mod.className} - Módulo ${mod.moduleNumber}` })}
                        className="p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-all"
                        title="Excluir Histórico"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
