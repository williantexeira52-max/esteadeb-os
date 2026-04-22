import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  AlertCircle, 
  DollarSign,
  Cake,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export const Dashboard = () => {
  const { profile, nucleo, user } = useAuth();
  const [stats, setStats] = useState({
    inadimplencia: 12,
    receita: 0,
    matriculas: 0,
    evasao: 5,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [birthdays, setBirthdays] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || !nucleo || !user) return;

    let qStudents = query(collection(db, 'students'), where('nucleoId', '==', nucleo));
    if (profile?.poloId) {
      qStudents = query(
        collection(db, 'students'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId)
      );
    }

    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const all = snap.docs.map(d => d.data());
      const unique = Array.from(new Set(all.map((s: any) => s.id || s.cpf)));
      
      const active = all.filter((s:any) => s.status === 'Ativo').length;
      const trancado = all.filter((s:any) => s.status === 'Trancado').length;
      const desistente = all.filter((s:any) => s.status === 'Desistente').length;
      
      // Birthdays logic - Improved for multiple date formats
      const today = new Date();
      const tDay = today.getDate().toString().padStart(2, '0');
      const tMonth = (today.getMonth() + 1).toString().padStart(2, '0');
      const todayKey = `${tDay}/${tMonth}`;
      const todayKeyIso = `${tMonth}-${tDay}`;

      const todayBirthdays = all.filter((s: any) => {
        if (!s.birthDate) return false;
        // Check formats: DD/MM/YYYY or YYYY-MM-DD
        if (s.birthDate.includes('/')) {
          const [d, m] = s.birthDate.split('/');
          return d.padStart(2, '0') === tDay && m.padStart(2, '0') === tMonth;
        } else if (s.birthDate.includes('-')) {
          const parts = s.birthDate.split('-');
          if (parts.length === 3) {
            // Check if parts[2] is day or year (usually YYYY-MM-DD)
            const d = parts[0].length === 4 ? parts[2] : parts[0];
            const m = parts[1];
            return d.padStart(2, '0') === tDay && m.padStart(2, '0') === tMonth;
          }
        }
        return false;
      });
      setBirthdays(todayBirthdays);
      
      setPieData([
        { name: 'Ativos', value: active },
        { name: 'Trancados', value: trancado },
        { name: 'Desistentes', value: desistente }
      ]);
      
      setStats(prev => ({ ...prev, matriculas: unique.length }));
    }, (err) => {
      console.warn("Students snapshot failed:", err);
    });

    let qTransactions = query(collection(db, 'transactions'), where('nucleoId', '==', nucleo));
    if (profile?.poloId) {
      qTransactions = query(
        collection(db, 'transactions'),
        where('nucleoId', '==', nucleo),
        where('poloId', '==', profile.poloId)
      );
    }

    const unsubTransactions = onSnapshot(qTransactions, (snap) => {
      const allTransactions = snap.docs.map(d => d.data());
      
      // Also fetch paid installments to ensure revenue is accurate
      let qInstallments = query(
        collection(db, 'financial_installments'), 
        where('status', '==', 'Pago'),
        where('nucleoId', '==', nucleo)
      );
      if (profile?.poloId) {
        qInstallments = query(
          collection(db, 'financial_installments'),
          where('status', '==', 'Pago'),
          where('nucleoId', '==', nucleo),
          where('poloId', '==', profile.poloId)
        );
      }

      getDocs(qInstallments).then(instSnap => {
        const paidInstallments = instSnap.docs.map(d => d.data());
        
        // Merge both sources for total revenue logic
        const total = allTransactions.reduce((acc, curr: any) => acc + (curr.amount || 0), 0) +
                      paidInstallments.reduce((acc, curr: any) => acc + (curr.finalPaidValue || curr.baseValue || 0), 0);
        
        setStats(prev => ({ ...prev, receita: total }));
        
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const currentYear = new Date().getFullYear();
        const monthlyData = months.map((m, i) => {
          // Transactions filtering
          const transTotal = allTransactions.filter((t: any) => {
            const d = t.date?.toDate ? t.date.toDate() : (t.date ? new Date(t.date) : null);
            return d && d.getMonth() === i && d.getFullYear() === currentYear;
          }).reduce((acc, curr: any) => acc + (curr.amount || 0), 0);
          
          // Installments filtering (using dueDate month as paid month for charts)
          const instTotal = paidInstallments.filter((p: any) => {
            const d = p.updatedAt?.toDate ? p.updatedAt.toDate() : (p.updatedAt ? new Date(p.updatedAt) : new Date(p.dueDate));
            return d && d.getMonth() === i && d.getFullYear() === currentYear;
          }).reduce((acc, curr: any) => acc + (curr.finalPaidValue || curr.baseValue || 0), 0);
          
          return { name: m, receita: transTotal + instTotal };
        });
        setChartData(monthlyData.slice(0, 6));
      });
    }, (err) => {
      console.warn("Transactions snapshot failed:", err);
    });

    return () => {
      unsubStudents();
      unsubTransactions();
    };
  }, [profile?.id]);

  const COLORS = ['#1e3a8a', '#cda53f', '#c8102e', '#007a33'];

  const dashboardStats = [
    { label: 'Inadimplência', value: `${stats.inadimplencia}%`, icon: AlertCircle, color: 'text-esteadeb-red', trend: 'down', trendVal: '0%' },
    { label: 'Receita Total', value: `R$ ${stats.receita.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-esteadeb-green', trend: 'up', trendVal: '0%' },
    { label: 'Total Matrículas', value: stats.matriculas.toString(), icon: Users, color: 'text-esteadeb-blue', trend: 'up', trendVal: '0%' },
    { label: 'Taxa de Evasão', value: `${stats.evasao}%`, icon: TrendingUp, color: 'text-orange-500', trend: 'down', trendVal: '0%' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-esteadeb-blue tracking-tight">
            {profile?.role === 'Direção' || profile?.role === 'admin' || profile?.role === 'Administrador Geral' ? 'Painel de BI do Diretor' : 'Dashboard Operacional'}
          </h1>
          <p className="text-gray-500">Visão estratégica e saúde institucional em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-esteadeb-blue text-esteadeb-blue">Exportar Relatório</Button>
          <Button className="bg-esteadeb-blue hover:bg-esteadeb-blue/90">Atualizar Dados</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg bg-gray-50", stat.color)}>
                <stat.icon size={24} />
              </div>
              <div className={cn("flex items-center text-xs font-bold", stat.trend === 'up' ? "text-esteadeb-green" : "text-esteadeb-red")}>
                {stat.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {stat.trendVal}
              </div>
            </div>
            <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-esteadeb-blue mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-esteadeb-blue mb-6">Receita por Mês ({new Date().getFullYear()})</h3>
          <div className="h-[300px]">
            {chartData.length > 0 && chartData.some(d => d.receita > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="receita" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                Sem dados de receita para exibir
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-esteadeb-blue mb-6 flex items-center gap-2">
            <Cake size={20} className="text-esteadeb-yellow" />
            Aniversariantes do Dia
          </h3>
          <ScrollArea className="h-[300px]">
            {birthdays.length > 0 ? (
              <div className="space-y-4">
                {birthdays.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 group hover:border-esteadeb-blue/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-esteadeb-blue/10 flex items-center justify-center text-esteadeb-blue font-bold">
                        {b.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-esteadeb-blue text-sm">{b.name}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-black">{b.matricula || 'Sem Matrícula'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-esteadeb-yellow text-white text-[9px] font-black uppercase tracking-widest">
                        Parabéns!
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-40 py-10">
                <Cake size={48} className="text-gray-300" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Nenhum aniversariante hoje</p>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-esteadeb-blue mb-6">Distribuição de Status de Alunos</h3>
          <div className="h-[300px] flex items-center">
            {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}}></div>
                      <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                Nenhum aluno cadastrado
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
