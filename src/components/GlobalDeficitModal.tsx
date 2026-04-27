import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from '@/components/ui/dialog';
import { 
  collection, 
  query, 
  getDocs, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { BookOpen, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GlobalDeficitModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: any[];
  nucleo: string;
}

interface DeficitMap {
  [subject: string]: {
    turmas: string[];
    count: number;
    course: string;
  };
}

export const GlobalDeficitModal: React.FC<GlobalDeficitModalProps> = ({ isOpen, onClose, classes, nucleo }) => {
  const [loading, setLoading] = useState(true);
  const [deficitMap, setDeficitMap] = useState<DeficitMap>({});

  useEffect(() => {
    if (isOpen && nucleo) {
      calculateGlobalDeficit();
    }
  }, [isOpen, nucleo, classes]);

  const calculateGlobalDeficit = async () => {
    setLoading(true);
    try {
      // 1. Fetch Curriculum
      const qCurriculum = query(collection(db, 'grades'), where('nucleoId', '==', nucleo));
      const gradeSnap = await getDocs(qCurriculum);
      const curriculum = gradeSnap.docs.map(d => ({ ...d.data(), id: d.id } as any));

      // 2. Fetch Modules History (What has been taken)
      const modulesSnap = await getDocs(collection(db, 'modules_history'));
      const modules = modulesSnap.docs.map(d => ({ ...d.data(), id: d.id } as any));

      const newDeficit: DeficitMap = {};

      // 3. Process per active class
      const activeClasses = classes.filter(c => c.status !== 'Inativo');

      activeClasses.forEach(cls => {
        const expectedCourse = (cls.courseName || '').toLowerCase().trim();
        if (!expectedCourse) return;

        // All subjects for this course
        const courseSubjects = curriculum.filter(g => (g.course || '').toLowerCase().trim() === expectedCourse);
        
        // Modules taken by this class
        const clsMods = modules.filter(m => m.classId === cls.id);
        const completedSubjects = new Set(clsMods.flatMap(m => m.subjects || []).map((s: string) => s.toLowerCase().trim()));

        // Find missing subjects
        courseSubjects.forEach(subject => {
          if (!completedSubjects.has(subject.name.toLowerCase().trim())) {
            const subjectKey = subject.name.trim();

            if (!newDeficit[subjectKey]) {
              newDeficit[subjectKey] = {
                turmas: [],
                count: 0,
                course: subject.course || 'Geral'
              };
            }
            newDeficit[subjectKey].turmas.push(cls.name);
            newDeficit[subjectKey].count += 1;
          }
        });
      });

      setDeficitMap(newDeficit);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const sortedDeficits = Object.entries(deficitMap)
    .sort((a, b) => b[1].count - a[1].count)
    .filter(([_, data]) => data.count > 1); // Only show missing in > 1 classes

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] rounded-[2rem] p-0 overflow-hidden flex flex-col bg-slate-50 border-none shadow-2xl">
        <DialogHeader className="p-8 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center">
              <BookOpen className="text-amber-500" size={28} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-navy uppercase tracking-tight">Demandas de Disciplinas</DialogTitle>
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">Disciplinas pendentes em mais de uma turma</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
              <p className="font-bold tracking-widest uppercase text-xs">Calculando déficit global...</p>
            </div>
          ) : sortedDeficits.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
              <BookOpen className="h-16 w-16 opacity-20" />
              <p className="font-bold tracking-widest uppercase text-xs text-center max-w-sm">
                Nenhuma disciplina pendente em múltiplas turmas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDeficits.map(([subject, data], idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border-2 border-slate-50 hover:border-amber-100 transition-all flex items-start gap-6 group">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex flex-col items-center justify-center shrink-0 group-hover:bg-amber-50 transition-colors">
                    <span className="font-black text-2xl text-navy group-hover:text-amber-600">{data.count}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Turmas</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-black text-lg text-navy uppercase">{subject}</h4>
                      <Badge className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold">{data.course}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {data.turmas.map((t, i) => (
                        <Badge key={i} variant="outline" className="border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider">{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
