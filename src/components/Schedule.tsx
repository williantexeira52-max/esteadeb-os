import React, { useState, useEffect, useMemo } from 'react';
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
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Plus, 
  Search, 
  Trash2, 
  Users,
  Edit2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  MapPin,
  User,
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ScheduleEntry {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  room: string;
  weekday: string;
  period: 'Manhã' | 'Noite' | 'Integral';
  startTime: string;
  endTime: string;
  nucleoId?: string;
  createdAt?: any;
}

const WEEKDAYS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo'
];

const PERIODS = ['Manhã', 'Noite', 'Integral'];

export const Schedule: React.FC = () => {
  const { nucleo, profile, user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    classIds: [] as string[],
    classId: '',
    subjectId: '',
    teacherId: '',
    room: '',
    weekday: 'Segunda-feira',
    period: 'Noite' as 'Manhã' | 'Noite' | 'Integral',
    startTime: '19:00',
    endTime: '22:00'
  });

  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!nucleo || !profile || !user) return;

    // Fetch Schedules
    const qSchedules = query(collection(db, 'schedules'), orderBy('startTime', 'asc'));
    const unsubscribeSchedules = onSnapshot(qSchedules, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduleEntry[];
      
      // Memory filter to prevent composite index requirements
      const filtered = list.filter(schedule => {
        const schedNucleo = schedule.nucleoId || 'PRESENCIAL';
        return schedNucleo === nucleo;
      });
      setSchedules(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schedules');
    });

    // Fetch Classes
    const qClasses = query(collection(db, 'classes'), orderBy('name', 'asc'));
    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
      const cls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filteredCls = cls.filter((c: any) => (c.nucleoId || 'PRESENCIAL') === nucleo);
      setClasses(filteredCls);
    });

    // Fetch Subjects (Grades)
    const qSubjects = query(collection(db, 'grades'), orderBy('name', 'asc'));
    const unsubscribeSubjects = onSnapshot(qSubjects, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Teachers (Staff where role == Professor)
    const qTeachers = query(collection(db, 'school_employees'), where('role', '==', 'Professor'), orderBy('name', 'asc'));
    const unsubscribeTeachers = onSnapshot(qTeachers, (snapshot) => {
      const profs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filteredProfs = profs.filter((p: any) => (p.nucleoId || 'PRESENCIAL') === nucleo);
      setTeachers(filteredProfs);
    });

    return () => {
      unsubscribeSchedules();
      unsubscribeClasses();
      unsubscribeSubjects();
      unsubscribeTeachers();
    };
  }, [nucleo]);

  const filteredSubjects = useMemo(() => {
    // If editing, use classId filter
    if (editingId && formData.classId) {
      const selectedClass = classes.find(c => c.id === formData.classId);
      if (!selectedClass) return subjects;
      return subjects.filter(s => s.course === selectedClass.courseName);
    }
    
    // If creating, use classIds filter (if any selected)
    if (!editingId && formData.classIds.length > 0) {
      const selectedCourses = classes
        .filter(c => formData.classIds.includes(c.id))
        .map(c => c.courseName);
      
      const uniqueCourses = Array.from(new Set(selectedCourses));
      return subjects.filter(s => uniqueCourses.includes(s.course));
    }
    
    return subjects;
  }, [formData.classId, formData.classIds, classes, subjects, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedSubject = subjects.find(s => s.id === formData.subjectId);
    const selectedTeacher = teachers.find(t => t.id === formData.teacherId);

    const baseData = {
      subjectId: formData.subjectId,
      teacherId: formData.teacherId,
      room: formData.room,
      weekday: formData.weekday,
      period: formData.period,
      startTime: formData.startTime,
      endTime: formData.endTime,
      subjectName: selectedSubject?.name || '',
      teacherName: selectedTeacher?.name ? `Professor(a) ${selectedTeacher.name}` : '',
      updatedAt: serverTimestamp(),
      nucleoId: nucleo,
    };

    try {
      if (editingId) {
        const selectedClass = classes.find(c => c.id === formData.classId);
        await updateDoc(doc(db, 'schedules', editingId), {
          ...baseData,
          classId: formData.classId,
          className: selectedClass?.name || ''
        });
        addToast('Horário atualizado com sucesso!', 'success');
      } else {
        if (!formData.classIds || formData.classIds.length === 0) {
           addToast('Selecione pelo menos uma turma.', 'error');
           return;
        }
        
        for (const cId of formData.classIds) {
          const selectedClass = classes.find(c => c.id === cId);
          await addDoc(collection(db, 'schedules'), {
            ...baseData,
            classId: cId,
            className: selectedClass?.name || '',
            createdAt: serverTimestamp()
          });
        }
        addToast('Horários registrados com sucesso!', 'success');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'schedules');
      addToast('Erro ao salvar horário.', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      classIds: [],
      classId: '',
      subjectId: '',
      teacherId: '',
      room: '',
      weekday: 'Segunda-feira',
      period: 'Noite' as any,
      startTime: '19:00',
      endTime: '22:00'
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleEdit = (entry: ScheduleEntry) => {
    setFormData({
      classId: entry.classId,
      subjectId: entry.subjectId,
      teacherId: entry.teacherId,
      room: entry.room,
      weekday: entry.weekday,
      period: entry.period,
      startTime: entry.startTime,
      endTime: entry.endTime
    });
    setEditingId(entry.id);
    setIsModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'schedules', deleteConfirm.id));
      addToast('Horário excluído com sucesso!', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'schedules');
      addToast('Erro ao excluir horário.', 'error');
    }
  };

  const filteredSchedules = useMemo(() => {
    let filtered = schedules;
    if (selectedCourseFilter !== 'all') {
      const classIdsInCourse = classes.filter(c => c.courseName === selectedCourseFilter).map(c => c.id);
      filtered = filtered.filter(s => classIdsInCourse.includes(s.classId));
    }
    if (selectedClassFilter !== 'all') {
      filtered = filtered.filter(s => s.classId === selectedClassFilter);
    }
    return filtered;
  }, [schedules, selectedCourseFilter, selectedClassFilter, classes]);

  const timetableData = useMemo(() => {
    const grid: Record<string, ScheduleEntry[]> = {};
    WEEKDAYS.forEach(day => {
      grid[day] = filteredSchedules.filter(s => s.weekday === day);
    });
    return grid;
  }, [filteredSchedules]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen relative">
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
                  Deseja realmente excluir o horário de <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>?
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
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <Calendar size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingId ? 'Editar Horário' : 'Novo Horário de Aula'}
                </h2>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Turma(s)</label>
                  {editingId ? (
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
                  ) : (
                    <div className="w-full h-32 overflow-y-auto p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl space-y-2 relative">
                      {classes.length === 0 && <span className="text-sm text-slate-400 font-bold">Nenhuma turma cadastrada.</span>}
                      {classes.map(c => (
                        <label key={c.id} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox"
                            checked={formData.classIds?.includes(c.id) || false}
                            onChange={(e) => {
                              if (e.target.checked) setFormData({...formData, classIds: [...(formData.classIds || []), c.id]});
                              else setFormData({...formData, classIds: formData.classIds.filter(id => id !== c.id)});
                            }}
                            className="w-5 h-5 rounded-md border-2 border-slate-300 text-petrol focus:ring-petrol"
                          />
                          <span className="font-bold text-slate-700 text-sm group-hover:text-petrol transition-colors">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Disciplina</label>
                  <select 
                    required
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.subjectId}
                    onChange={(e) => setFormData({...formData, subjectId: e.target.value})}
                    disabled={(!editingId && (!formData.classIds || formData.classIds.length === 0)) || (editingId && !formData.classId)}
                  >
                    <option value="">
                      {(!editingId && formData.classIds && formData.classIds.length > 0) || (editingId && formData.classId) 
                        ? 'Selecione a Disciplina' 
                        : 'Selecione uma Turma primeiro'}
                    </option>
                    {filteredSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Professor</label>
                  <select 
                    required
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.teacherId}
                    onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                  >
                    <option value="">Selecione o Professor</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sala</label>
                  <Input 
                    required
                    placeholder="Ex: Sala 102"
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                    value={formData.room}
                    onChange={(e) => setFormData({...formData, room: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Dia da Semana</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.weekday}
                    onChange={(e) => setFormData({...formData, weekday: e.target.value})}
                  >
                    {WEEKDAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Período</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={formData.period}
                    onChange={(e) => setFormData({...formData, period: e.target.value as any})}
                  >
                    {PERIODS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Início</label>
                  <Input 
                    type="time"
                    required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Término</label>
                  <Input 
                    type="time"
                    required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-4">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {editingId ? 'Salvar Alterações' : 'Registrar Horário'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Grade Horária</h1>
          <p className="text-slate-500 font-medium mt-1">Organização semanal de aulas, salas e professores.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-petrol hover:bg-petrol-dark text-white px-8 py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-petrol/20 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus size={24} /> Novo Horário
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-3 text-navy w-40">
            <Filter size={20} className="text-petrol" />
            <span className="font-black uppercase text-xs tracking-widest">Curso:</span>
          </div>
          <div className="flex-1 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCourseFilter('all')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                selectedCourseFilter === 'all' 
                  ? "bg-navy text-white shadow-lg shadow-navy/20" 
                  : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              )}
            >
              Todos os Cursos
            </button>
            {Array.from(new Set(classes.map(c => c.courseName))).filter(Boolean).map(courseName => (
              <button
                key={courseName}
                onClick={() => {
                  setSelectedCourseFilter(courseName);
                  setSelectedClassFilter('all');
                }}
                className={cn(
                  "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  selectedCourseFilter === courseName 
                    ? "bg-petrol text-white shadow-lg shadow-petrol/20" 
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                )}
              >
                {courseName}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-3 text-navy w-40">
            <Users size={20} className="text-petrol" />
            <span className="font-black uppercase text-xs tracking-widest">Turma:</span>
          </div>
          <div className="flex-1 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedClassFilter('all')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                selectedClassFilter === 'all' 
                  ? "bg-navy text-white shadow-lg shadow-navy/20" 
                  : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              )}
            >
              Todas as Turmas
            </button>
            {classes
              .filter(c => selectedCourseFilter === 'all' || c.courseName === selectedCourseFilter)
              .map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassFilter(c.id)}
                  className={cn(
                    "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    selectedClassFilter === c.id 
                      ? "bg-petrol text-white shadow-lg shadow-petrol/20" 
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  )}
                >
                  {c.name}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6">
        {WEEKDAYS.map(day => (
          <div key={day} className="space-y-4">
            <div className="bg-navy p-4 rounded-2xl shadow-lg relative overflow-hidden">
              <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] relative z-10">{day}</h3>
              <div className="absolute -right-2 -bottom-2 opacity-10 text-white rotate-12">
                <Clock size={48} />
              </div>
            </div>

            <div className="space-y-3">
              {timetableData[day].length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300">
                  <Clock size={24} className="opacity-20 mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Sem Aulas</span>
                </div>
              ) : (
                timetableData[day].map(entry => (
                  <div 
                    key={entry.id} 
                    className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group relative"
                  >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                      <button 
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ id: entry.id, name: `${entry.subjectName} (${entry.className})` })}
                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 border-none",
                          entry.period === 'Manhã' ? "bg-amber-100 text-amber-600" :
                          entry.period === 'Noite' ? "bg-indigo-100 text-indigo-600" :
                          "bg-emerald-100 text-emerald-600"
                        )}>
                          {entry.period}
                        </Badge>
                        <span className="text-[10px] font-black text-slate-400">{entry.startTime} - {entry.endTime}</span>
                      </div>

                      <div>
                        <h4 className="font-black text-navy uppercase text-xs leading-tight tracking-tight">{entry.subjectName}</h4>
                        <p className="text-[10px] font-bold text-petrol uppercase mt-0.5">{entry.className}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-50 space-y-1.5">
                        <div className="flex items-center gap-2 text-slate-500">
                          <User size={12} className="text-slate-400" />
                          <span className="text-[10px] font-bold truncate">{entry.teacherName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <MapPin size={12} className="text-slate-400" />
                          <span className="text-[10px] font-bold">{entry.room}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
