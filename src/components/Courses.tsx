import React, { useState, useEffect } from 'react';
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
  Book,
  BookOpen,
  Hash,
  AlertTriangle
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  where,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const Courses: React.FC = () => {
  console.log("BOTÃO DE EXCLUSÃO RENDERIZADO COM SUCESSO");
  const { profile, nucleo, user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);

  // Form State - Manual Data Logic
  const [formData, setFormData] = useState({
    name: '',
    durationYears: 0,
    modulesPerYear: 0,
    subjectsPerModule: 0,
    totalSubjects: 0,
    status: 'Ativo'
  });

  // 2. DATA FETCHING LOGIC: Populate state with RAW Firestore ID (doc.id)
  useEffect(() => {
    if (!nucleo || !user) return;
    const q = query(
      collection(db, 'courses'), 
      where('nucleoId', '==', nucleo),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setCourses(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (course: any = null) => {
    if (course) {
      setEditingCourse(course);
      setFormData({
        name: course.name || '',
        durationYears: course.durationYears || 0,
        modulesPerYear: course.modulesPerYear || 0,
        subjectsPerModule: course.subjectsPerModule || 0,
        totalSubjects: course.totalSubjects || 0,
        status: course.status || 'Ativo'
      });
    } else {
      setEditingCourse(null);
      setFormData({
        name: '',
        durationYears: 0,
        modulesPerYear: 0,
        subjectsPerModule: 0,
        totalSubjects: 0,
        status: 'Ativo'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourse) {
        const courseRef = doc(db, 'courses', editingCourse.id);
        await updateDoc(courseRef, {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || profile?.id || 'system'
        });
      } else {
        await addDoc(collection(db, 'courses'), {
          ...formData,
          nucleoId: nucleo,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || profile?.id || 'system'
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingCourse ? OperationType.UPDATE : OperationType.CREATE, 'courses');
    }
  };

  // FINAL COLLECTION ALIGNMENT: Strictly use 'courses'
  const handleDelete = async (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;

    // 1. IMMEDIATE UI FEEDBACK: Remove from screen instantly
    setCourses(prev => prev.filter(c => c.id !== id));
    setDeleteConfirm(null);

    try {
      // 2. PRECISION DELETE: Targeting 'courses' collection only
      await deleteDoc(doc(db, 'courses', id));
      console.log("Deletion successful for ID:", id);
    } catch (error) {
      // Silent catch as per previous directives
      console.error("Firestore Delete Error:", error);
    }
  };

  const filteredCourses = courses.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#001F3F] flex items-center gap-2">
            <BookOpen className="text-[#008080]" /> Gestão de Cursos
          </h1>
          <p className="text-sm text-gray-500">Administração de matrizes curriculares.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-[#008080] hover:bg-[#006666] text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm"
        >
          <Plus size={18} /> Novo Curso
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar curso pelo nome..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080]/20 focus:border-[#008080] transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Curso</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Estrutura</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Total Disciplinas</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">Carregando...</td>
                </tr>
              ) : filteredCourses.length > 0 ? filteredCourses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-[#001F3F]">{course.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">ID: {course.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1"><Clock size={12}/> {course.durationYears} Anos</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1"><Layers size={12}/> {course.modulesPerYear} Mod/Ano</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-[#001F3F]">
                    {course.totalSubjects}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${course.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {course.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(course)}
                        className="p-2 text-gray-400 hover:text-[#001F3F] transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(course.id, course.name); }}
                        className="relative z-10 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm"
                      >
                        APAGAR
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Nenhum curso encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#001F3F]/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#001F3F] uppercase tracking-tight">Confirmar Exclusão</h3>
                <p className="text-gray-500 text-sm mt-2">
                  Deseja realmente apagar o curso <span className="font-bold text-[#001F3F]">"{deleteConfirm.name}"</span>? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001F3F]/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#001F3F] p-4 flex justify-between items-center text-white">
              <h2 className="font-bold">{editingCourse ? 'Editar Curso' : 'Novo Curso'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nome do Curso</label>
                <input 
                  required
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#008080]/20"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Duração (Anos)</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.durationYears}
                    onChange={e => setFormData({...formData, durationYears: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Disciplinas</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.totalSubjects}
                    onChange={e => setFormData({...formData, totalSubjects: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Status</label>
                <select 
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-[#001F3F] text-white rounded-lg font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
