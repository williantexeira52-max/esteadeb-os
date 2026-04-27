import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DataActions } from './DataActions';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  FileText,
  X,
  Check,
  AlertCircle,
  BookOpen,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface GradeItem {
  id: string;
  name: string;
  year: string;
  module: string;
  workload: number;
  course: string;
  createdAt?: any;
}

interface CourseItem {
  id: string;
  name: string;
}

// Custom Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-10 duration-300 ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      <p className="text-sm font-black uppercase tracking-wider">{message}</p>
      <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
};

export const Grade: React.FC = () => {
  const { nucleo, profile, user } = useAuth();
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('Todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [isDeletingDuplicates, setIsDeletingDuplicates] = useState(false);

  const gradeHeaders = [
    { key: 'name', label: 'Disciplina' },
    { key: 'year', label: 'Ano' },
    { key: 'module', label: 'Módulo' },
    { key: 'workload', label: 'Carga Horária', type: 'number' as const },
    { key: 'course', label: 'Curso' }
  ];

  const [formData, setFormData] = useState({
    name: '',
    year: '1º',
    module: '',
    workload: 0,
    course: ''
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  // Real-time Grades Sync
  useEffect(() => {
    if (!nucleo || !user) return;
    const q = query(
      collection(db, 'grades'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GradeItem[];
      setGrades(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grades');
    });
    return () => unsubscribe();
  }, []);

  // Real-time Courses Sync
  useEffect(() => {
    if (!nucleo || !user) return;
    const q = query(
      collection(db, 'courses'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as CourseItem[];
      setCourses(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'grades', editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || profile?.id || 'system'
        });
        showToast("Disciplina atualizada com sucesso!", "success");
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'grades'), {
          ...formData,
          nucleoId: nucleo,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || profile?.id || 'system'
        });
        showToast("Disciplina cadastrada com sucesso!", "success");
      }
      setFormData({ name: '', year: '1º', module: '', workload: 0, course: '' });
      setIsFormOpen(false);
    } catch (error) {
      showToast("Erro ao salvar disciplina.", "error");
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'grades');
    }
  };

  const handleEdit = (grade: GradeItem) => {
    setFormData({
      name: grade.name,
      year: grade.year,
      module: grade.module,
      workload: grade.workload,
      course: grade.course
    });
    setEditingId(grade.id);
    setIsFormOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    
    // OPTIMISTIC UI: Remove from screen immediately
    setGrades(prev => prev.filter(g => g.id !== id));
    setDeleteConfirm(null);

    try {
      // Try both collection names just in case
      await deleteDoc(doc(db, 'grades', id));
      await deleteDoc(doc(db, 'matriz', id));
      showToast("Disciplina removida com sucesso.", "success");
    } catch (error) {
      console.error("Erro na exclusão:", error);
      handleFirestoreError(error, OperationType.DELETE, 'grades');
    }
  };

  const handleRemoveDuplicates = async () => {
    if (!grades || grades.length === 0) return;
    setIsDeletingDuplicates(true);
    try {
      const seen = new Set<string>();
      const duplicatesToDelete: string[] = [];

      for (const g of grades) {
        const normCourse = (g.course || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        const normName = (g.name || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        const key = `${normCourse}_${normName}`;
        if (seen.has(key)) {
          duplicatesToDelete.push(g.id);
        } else {
          seen.add(key);
        }
      }

      if (duplicatesToDelete.length === 0) {
        showToast("Nenhuma disciplina duplicada encontrada.", "success");
        setIsDeletingDuplicates(false);
        return;
      }

      const confirmDelete = window.confirm(`Foram encontradas ${duplicatesToDelete.length} disciplinas duplicadas. Deseja remover todas? Esta ação não pode ser desfeita.`);
      if (!confirmDelete) {
        setIsDeletingDuplicates(false);
        return;
      }

      let batch = writeBatch(db);
      let count = 0;
      let totalDeleted = 0;

      for (const id of duplicatesToDelete) {
        batch.delete(doc(db, 'grades', id));
        count++;
        totalDeleted++;

        if (count === 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      showToast(`${totalDeleted} disciplinas duplicadas foram removidas!`, "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao remover duplicadas.", "error");
    } finally {
      setIsDeletingDuplicates(false);
    }
  };

  const filteredGrades = useMemo(() => {
    let filtered = grades;
    if (courseFilter !== 'Todos') {
      filtered = filtered.filter(g => (g.course || '') === courseFilter);
    }
    return filtered.filter(g => 
      (g.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.course || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.module || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [grades, searchTerm, courseFilter]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
                  Deseja realmente apagar a disciplina <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>? Esta ação não pode ser desfeita.
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

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Grade Curricular Master</h1>
          <p className="text-slate-500 font-medium">Gestão modular de matrizes e disciplinas acadêmicas.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <DataActions 
            collectionName="grades"
            data={grades}
            headers={gradeHeaders}
            title="Grade Curricular"
            onImportSuccess={(count) => showToast(`${count} disciplinas importadas!`, "success")}
            transformRow={(row) => ({ ...row, nucleoId: nucleo })}
          />
          <button
            onClick={handleRemoveDuplicates}
            disabled={isDeletingDuplicates}
            className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-all text-sm font-black shadow-lg shadow-rose-200 uppercase tracking-widest h-10"
          >
            {isDeletingDuplicates ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
            Limpar Duplicatas
          </button>
          <button 
            onClick={() => {
              setIsFormOpen(true);
              setEditingId(null);
              setFormData({ name: '', year: '1º', module: '', workload: 0, course: courses[0]?.name || '' });
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-black shadow-lg shadow-indigo-200 uppercase tracking-widest h-10"
          >
            <Plus size={20} />
            Nova Disciplina
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disciplinas</p>
            <p className="text-2xl font-black text-slate-900">{filteredGrades.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cursos Ativos</p>
            <p className="text-2xl font-black text-slate-900">{courses.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">C.H. Média</p>
            <p className="text-2xl font-black text-slate-900">
              {filteredGrades.length > 0 ? Math.round(filteredGrades.reduce((acc, g) => acc + (g.workload || 0), 0) / filteredGrades.length) : 0}h
            </p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      {isFormOpen && (
        <div className="bg-white p-8 rounded-2xl border-2 border-indigo-100 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {editingId ? 'Editar Disciplina' : 'Cadastrar Disciplina'}
              </h2>
            </div>
            <button 
              onClick={() => setIsFormOpen(false)} 
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            >
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Disciplina</label>
              <input 
                required
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Ex: Teologia Sistemática I"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Curso (Sincronizado)</label>
              <select 
                required
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all appearance-none"
                value={formData.course}
                onChange={e => setFormData({...formData, course: e.target.value})}
              >
                <option value="">Selecione o Curso...</option>
                {courses.map(course => (
                  <option key={course.id} value={course.name}>{course.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ano Letivo</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all appearance-none"
                value={formData.year}
                onChange={e => setFormData({...formData, year: e.target.value})}
              >
                <option value="1º">1º Ano</option>
                <option value="2º">2º Ano</option>
                <option value="3º">3º Ano</option>
                <option value="4º">4º Ano</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Módulo / Fase</label>
              <input 
                required
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all"
                value={formData.module}
                onChange={e => setFormData({...formData, module: e.target.value})}
                placeholder="Ex: Módulo I"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Carga Horária (h)</label>
              <input 
                type="number"
                required
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-sm font-bold transition-all"
                value={formData.workload}
                onChange={e => setFormData({...formData, workload: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="flex items-end">
              <button 
                type="submit"
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-black shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Check size={18} />
                {editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Data Table Section */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex bg-slate-200/50 p-1 rounded-2xl max-w-fit">
          {(['Todos', 'Bacharelado Livre em Teologia', 'Médio em Teologia'] as const).map((course) => (
            <button
              key={course}
              onClick={() => setCourseFilter(course)}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                courseFilter === course 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              {course === 'Bacharelado Livre em Teologia' ? 'Bacharelado' : course === 'Médio em Teologia' ? 'Médio' : course}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="search"
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none text-sm font-bold transition-all shadow-sm"
              placeholder="Pesquisar por disciplina, curso ou módulo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Disciplina</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ano / Módulo</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">C.H.</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Curso Vinculado</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredGrades.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <FileText size={32} className="opacity-20 text-slate-900" />
                      </div>
                      <p className="font-bold uppercase tracking-widest text-xs">Nenhum registro encontrado na matriz.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGrades.map((grade) => (
                  <tr key={grade.id} className="hover:bg-indigo-50/30 transition-all group">
                    <td className="p-6">
                      <p className="font-black text-slate-900 uppercase text-sm tracking-tight">{grade.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">REF: {grade.id}</p>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">
                          {grade.year}
                        </span>
                        <span className="text-slate-600 text-xs font-bold uppercase">{grade.module}</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-black">
                        {grade.workload}h
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider">
                        {grade.course}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(grade)}
                          className="p-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                          title="Editar Disciplina"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            setDeleteConfirm({ id: grade.id, name: grade.name });
                          }}
                          className="relative z-50 p-3 bg-red-600 text-white hover:bg-red-800 rounded-xl transition-all shadow-lg flex items-center gap-2 font-black text-[10px] uppercase"
                          title="Excluir Permanentemente"
                        >
                          <Trash2 size={18} />
                          Apagar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Exibindo <span className="text-indigo-600">{filteredGrades.length}</span> disciplinas na matriz curricular.
          </p>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 uppercase font-black tracking-widest">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              Sincronizado via Firestore Cloud
            </div>
            <AlertCircle size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};
