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
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  X, 
  Loader2,
  Trash2,
  Edit,
  BookOpen,
  GraduationCap,
  AlertCircle,
  Coffee,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface SchoolEvent {
  id: string;
  title: string;
  type: 'Aula' | 'Prova' | 'Módulo' | 'Recesso' | 'Evento Especial';
  startDate: string;
  endDate: string;
  targetClass: string;
  color: string;
  createdBy: string;
}

const EVENT_TYPES = [
  { label: 'Aula', icon: BookOpen, color: 'bg-blue-500' },
  { label: 'Prova', icon: AlertCircle, color: 'bg-red-500' },
  { label: 'Módulo', icon: GraduationCap, color: 'bg-indigo-500' },
  { label: 'Recesso', icon: Coffee, color: 'bg-orange-500' },
  { label: 'Evento Especial', icon: Star, color: 'bg-emerald-500' },
];

const PREDEFINED_COLORS = [
  { name: 'Blue', value: 'bg-blue-500' },
  { name: 'Red', value: 'bg-red-500' },
  { name: 'Indigo', value: 'bg-indigo-500' },
  { name: 'Orange', value: 'bg-orange-500' },
  { name: 'Emerald', value: 'bg-emerald-500' },
];

export const SchoolCalendar: React.FC = () => {
  const { profile, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1)); // Default to April 2026 as requested
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
  
  const [eventForm, setEventForm] = useState({
    title: '',
    type: 'Aula' as SchoolEvent['type'],
    startDate: '',
    endDate: '',
    targetClass: 'Todas as Turmas',
    color: 'bg-blue-500'
  });

  useEffect(() => {
    if (!user) return;
    const unsubscribeEvents = onSnapshot(
      query(collection(db, 'school_events')),
      (snapshot) => {
        setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolEvent)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'school_events')
    );

    const unsubscribeClasses = onSnapshot(
      query(collection(db, 'classes'), orderBy('name', 'asc')),
      (snapshot) => {
        setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubscribeEvents();
      unsubscribeClasses();
    };
  }, []);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    
    const calendarDays = [];
    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    // Days of current month
    for (let i = 1; i <= days; i++) {
      calendarDays.push(new Date(year, month, i));
    }
    return calendarDays;
  }, [currentDate]);

  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    setEditingEvent(null);
    setEventForm({
      title: '',
      type: 'Aula',
      startDate: dateStr,
      endDate: dateStr,
      targetClass: 'Todas as Turmas',
      color: 'bg-blue-500'
    });
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: SchoolEvent) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      type: event.type,
      startDate: event.startDate,
      endDate: event.endDate,
      targetClass: event.targetClass || 'Todas as Turmas',
      color: event.color
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'school_events', editingEvent.id), {
          ...eventForm,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'school_events'), {
          ...eventForm,
          createdAt: serverTimestamp(),
          createdBy: profile?.name || 'Sistema'
        });
      }
      setIsModalOpen(false);
      setEditingEvent(null);
      setEventForm({
        title: '',
        type: 'Aula',
        startDate: '',
        endDate: '',
        targetClass: 'Todas as Turmas',
        color: 'bg-blue-500'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'school_events');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Excluir este evento permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'school_events', id));
      // No need for state update as onSnapshot will handle it
    } catch (error) {
      console.error("Delete error:", error);
      handleFirestoreError(error, OperationType.DELETE, 'school_events');
    }
  };

  const getEventsForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => {
      const start = e.startDate;
      const end = e.endDate || e.startDate;
      return dateStr >= start && dateStr <= end;
    });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Calendário Escolar</h1>
          <p className="text-slate-500 font-medium mt-1">Gestão visual de aulas, provas e eventos institucionais.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="hover:bg-slate-50">
            <ChevronLeft size={20} />
          </Button>
          <h2 className="text-lg font-black text-navy uppercase min-w-[180px] text-center tracking-tight">
            {monthName}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="hover:bg-slate-50">
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {daysInMonth.map((date, i) => {
            const dayEvents = date ? getEventsForDay(date) : [];
            return (
              <div 
                key={i} 
                onClick={() => date && handleDayClick(date)}
                className={cn(
                  "min-h-[140px] p-2 border-r border-b border-slate-50 transition-all relative group",
                  !date ? "bg-slate-50/30" : "hover:bg-slate-50/80 cursor-pointer"
                )}
              >
                {date && (
                  <>
                    <span className={cn(
                      "inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black transition-colors",
                      date.toDateString() === new Date().toDateString() 
                        ? "bg-petrol text-white shadow-lg shadow-petrol/20" 
                        : "text-slate-400 group-hover:text-navy"
                    )}>
                      {date.getDate()}
                    </span>
                    
                    <div className="mt-2 space-y-1">
                      {dayEvents.map(event => (
                        <div 
                          key={event.id}
                          className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-black text-white truncate flex items-center justify-between group/event",
                            event.color
                          )}
                        >
                          <span className="truncate uppercase tracking-tighter">{event.title}</span>
                        </div>
                      ))}
                    </div>

                    {date.getDate() === 1 && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-navy text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <Plus size={12} /> Novo Evento
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Events List View */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-navy uppercase tracking-tight">Lista de Eventos: {monthName}</h3>
          <Badge className="bg-slate-100 text-slate-500 font-bold">{events.length} Totais</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events
            .filter(e => {
              const eventDate = new Date(e.startDate + 'T00:00:00');
              return eventDate.getMonth() === currentDate.getMonth() && eventDate.getFullYear() === currentDate.getFullYear();
            }).length > 0 ? (
            events
              .filter(e => {
                const eventDate = new Date(e.startDate + 'T00:00:00');
                return eventDate.getMonth() === currentDate.getMonth() && eventDate.getFullYear() === currentDate.getFullYear();
              })
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map(event => (
                <div key={event.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn("p-3 rounded-2xl text-white", event.color)}>
                      {EVENT_TYPES.find(t => t.label === event.type)?.icon && React.createElement(EVENT_TYPES.find(t => t.label === event.type)!.icon, { size: 20 })}
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => handleEditEvent(event)}
                         className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                         title="Editar"
                       >
                         <Edit size={16} />
                       </button>
                       <button 
                         onClick={(e) => handleDeleteEvent(event.id, e)}
                         className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                         title="Excluir"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </div>
                  <h4 className="font-black text-navy uppercase tracking-tight line-clamp-1">{event.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{event.type} • {event.targetClass || 'Todas as Turmas'}</p>
                  
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Clock size={12} />
                      <span className="font-bold">{new Date(event.startDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                    {event.endDate && event.endDate !== event.startDate && (
                      <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold uppercase">
                        Até {new Date(event.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>
              ))
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
               <CalendarIcon size={48} className="mx-auto text-slate-100 mb-4" />
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum evento registrado para este mês.</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-full mb-2">Legenda de Cores</p>
        {EVENT_TYPES.map(type => (
          <div key={type.label} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", type.color)}></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{type.label}</span>
          </div>
        ))}
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-petrol rounded-xl">
                  <CalendarIcon size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingEvent ? 'Editar Evento Escolar' : 'Novo Evento Escolar'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título do Evento *</label>
                <Input 
                  required
                  placeholder="Ex: Prova de Teologia Sistemática"
                  className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={eventForm.type}
                    onChange={(e) => {
                      const type = e.target.value as SchoolEvent['type'];
                      const typeConfig = EVENT_TYPES.find(t => t.label === type);
                      setEventForm({...eventForm, type, color: typeConfig?.color || 'bg-blue-500'});
                    }}
                  >
                    {EVENT_TYPES.map(t => (
                      <option key={t.label} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Turma Alvo</label>
                  <select 
                    className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol outline-none transition-all font-bold text-slate-700"
                    value={eventForm.targetClass}
                    onChange={(e) => setEventForm({...eventForm, targetClass: e.target.value})}
                  >
                    <option value="Todas as Turmas">Todas as Turmas</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Início</label>
                  <Input 
                    type="date" required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold text-xs"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({...eventForm, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Fim</label>
                  <Input 
                    type="date" required
                    className="h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-petrol font-bold text-xs"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({...eventForm, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor do Evento</label>
                <div className="flex gap-3">
                  {PREDEFINED_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEventForm({...eventForm, color: color.value})}
                      className={cn(
                        "w-10 h-10 rounded-xl transition-all transform hover:scale-110",
                        color.value,
                        eventForm.color === color.value ? "ring-4 ring-navy ring-offset-2" : "opacity-60"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="flex-1 h-12 bg-petrol hover:bg-petrol-dark rounded-2xl font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="animate-spin" /> : editingEvent ? 'Atualizar Evento' : 'Salvar Evento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
