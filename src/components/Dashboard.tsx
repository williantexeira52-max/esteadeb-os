import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  AlertCircle, 
  DollarSign,
  Cake,
  ArrowUpRight,
  ArrowDownRight,
  Percent
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
    inadimplencia: 0,
    recuperacao: 0,
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

      const todayBirthdays = all.filter((s: any) => {
        if (!s.birthDate) return false;
        if (s.birthDate.includes('/')) {
          const [d, m] = s.birthDate.split('/');
          return d.padStart(2, '0') === tDay && m.padStart(2, '0') === tMonth;
        } else if (s.birthDate.includes('-')) {
          const parts = s.birthDate.split('-');
          if (parts.length === 3) {
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
      console.warn("Dashboard: Students snapshot failed:", err);
    });

    let qSchoolCash = query(collection(db, 'school_cash'), where('nucleoId', '==', nucleo));
    if (profile?.poloId) {
      qSchoolCash = query(collection(db, 'school_cash'), where('nucleoId', '==', nucleo), where('poloId', '==', profile.poloId));
    }
    const unsubSchoolCash = onSnapshot(qSchoolCash, (snap) => {
      updateFinancials();
    }, (err) => console.warn("Dashboard: SchoolCash fail:", err));

    let qSnackCash = query(collection(db, 'snack_cash'), where('nucleoId', '==', nucleo));
    if (profile?.poloId) {
      qSnackCash = query(collection(db, 'snack_cash'), where('nucleoId', '==', nucleo), where('poloId', '==', profile.poloId));
    }
    const unsubSnackCash = onSnapshot(qSnackCash, (snackSnap) => {
      updateFinancials();
    }, (err) => console.warn("Dashboard: SnackCash fail:", err));

    let qTransactions = query(collection(db, 'transactions'), where('nucleoId', '==', nucleo));
    if (profile?.poloId) {
      qTransactions = query(collection(db, 'transactions'), where('nucleoId', '==', nucleo), where('poloId', '==', profile.poloId));
    }
    const unsubTransactions = onSnapshot(qTransactions, (snapTrans) => {
      updateFinancials();
    }, (err) => console.warn("Dashboard: Transactions fail:", err));

    const updateFinancials = async () => {
      try {
        const [snapSchool, snapSnack, snapTrans] = await Promise.all([
          getDocs(qSchoolCash),
          getDocs(qSnackCash),
          getDocs(qTransactions)
        ]);

        const allSchoolCash = snapSchool.docs.map(d => d.data());
        const allSnackCash = snapSnack.docs.map(d => d.data());
        const allTransactions = snapTrans.docs.map(d => d.data());

        let qInstallments = query(collection(db, 'financial_installments'), where('status', '==', 'Pago'), where('nucleoId', '==', nucleo));
        if (profile?.poloId) {
          qInstallments = query(collection(db, 'financial_installments'), where('status', '==', 'Pago'), where('nucleoId', '==', nucleo), where('poloId', '==', profile.poloId));
        }

        const instSnap = await getDocs(qInstallments);
        const paidInstallments = instSnap.docs.map(d => d.data()).filter((d: any) => d.paymentMethod !== 'Permuta de Serviço');
        
        let qAllInstallments = query(collection(db, 'financial_installments'), where('nucleoId', '==', nucleo));
        if (profile?.poloId) {
          qAllInstallments = query(collection(db, 'financial_installments'), where('nucleoId', '==', nucleo), where('poloId', '==', profile.poloId));
        }
        
        const allInstSnap = await getDocs(qAllInstallments);
        const allInst = allInstSnap.docs.map(d => d.data());
        
        const todayDate = new Date().toISOString().split('T')[0];
        const stillLate = allInst.filter(i => i.status !== 'Pago' && i.dueDate < todayDate).length;
        const recovered = allInst.filter(i => {
          if (i.status === 'Pago' && i.paymentDate && i.dueDate) {
            return i.paymentDate > i.dueDate;
          }
          return false;
        }).length;
        
        const recoveryRate = (recovered + stillLate) > 0 ? Math.round((recovered / (recovered + stillLate)) * 100) : 0;
        const currentLateRate = allInst.length > 0 ? Math.round((stillLate / allInst.length) * 100) : 0;
        
        const calcCashSum = (arr: any[]) => {
          return arr.reduce((acc, curr) => {
            if (curr.type === 'ENTRY' || (!curr.type && Number(curr.amount) > 0)) return acc + Number(curr.amount || 0);
            if (curr.type === 'WITHDRAWAL' || (!curr.type && Number(curr.amount) < 0)) return acc - Math.abs(Number(curr.amount || 0));
            return acc;
          }, 0);
        };

        const adminTotal = calcCashSum(allTransactions) + paidInstallments.reduce((acc, curr: any) => acc + (curr.finalPaidValue || curr.baseValue || 0), 0);
        const schoolTotalValue = calcCashSum(allSchoolCash);
        const snackTotalValue = calcCashSum(allSnackCash);

        setStats(prev => ({ 
          ...prev, 
          receita: adminTotal + schoolTotalValue + snackTotalValue,
          inadimplencia: currentLateRate,
          recuperacao: recoveryRate
        }));
        
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const currentYear = new Date().getFullYear();
        const monthlyData = months.map((m, i) => {
          const getMonthlySum = (arr: any[], dateField1: string, dateField2?: string) => {
            return arr.filter((t: any) => {
              const dt = t[dateField1] || (dateField2 && t[dateField2]);
              const d = dt?.toDate ? dt.toDate() : (dt ? new Date(dt) : null);
              return d && d.getMonth() === i && d.getFullYear() === currentYear && (t.type === 'ENTRY' || (!t.type && Number(t.amount) > 0));
            }).reduce((acc, curr: any) => acc + Number(curr.amount || 0), 0);
          };

          const transTotal = getMonthlySum(allTransactions, 'date');
          const schoolTotal = getMonthlySum(allSchoolCash, 'date');
          const snackTotal = getMonthlySum(allSnackCash, 'date');
          
          const instTotal = paidInstallments.filter((p: any) => {
            const d = p.paymentDate ? new Date(p.paymentDate) : (p.updatedAt?.toDate ? p.updatedAt.toDate() : new Date(p.dueDate));
            return d && d.getMonth() === i && d.getFullYear() === currentYear;
          }).reduce((acc, curr: any) => acc + (curr.finalPaidValue || curr.baseValue || 0), 0);
          
          const projetadoTotal = allInst.filter((p: any) => {
            const d = p.dueDate ? new Date(p.dueDate + 'T12:00:00') : null;
            return d && d.getMonth() === i && d.getFullYear() === currentYear;
          }).reduce((acc, curr: any) => acc + (curr.baseValue || 0), 0);
          
          return { 
            name: m, 
            receitaAdm: transTotal + instTotal,
            projetado: projetadoTotal,
            receitaEscola: schoolTotal,
            receitaCantina: snackTotal
          };
        });
        setChartData(monthlyData.slice(0, 7));
      } catch (e) {
        console.error("Dashboard: Error updating financials", e);
      }
    };

    return () => {
      unsubStudents();
      unsubSchoolCash();
      unsubSnackCash();
      unsubTransactions();
    };
  }, [nucleo, profile, user]);

  const COLORS = ['#1e3a8a', '#cda53f', '#c8102e', '#007a33'];

  const dashboardStats = [
    { label: 'Inadimplência', value: `${stats.inadimplencia}%`, icon: AlertCircle, color: 'text-esteadeb-red', trend: stats.inadimplencia > 20 ? 'up' : 'down', trendVal: stats.inadimplencia > 20 ? 'Crítico' : 'Saudável' },
    { label: 'Taxa de Recuperação', value: `${stats.recuperacao}%`, icon: Percent, color: 'text-emerald-500', trend: stats.recuperacao > 50 ? 'up' : 'down', trendVal: stats.recuperacao > 50 ? 'Excelente' : 'A melhorar' },
    { label: 'Receita Estima (Mês)', value: `R$ ${(stats.receita / 12).toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-esteadeb-green', trend: 'up', trendVal: '+12%' },
    { label: 'Previsão Anual', value: `R$ ${(stats.receita * 1.1).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-indigo-500', trend: 'up', trendVal: 'Projetado' },
  ];

  const enrollmentHealth = stats.matriculas > 0 ? Math.min(100, (stats.matriculas / 500) * 100) : 0;

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
            {chartData.length > 0 && chartData.some(d => d.projetado > 0 || d.receitaAdm > 0 || d.receitaEscola > 0 || d.receitaCantina > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="projetado" name="Projetado" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="receitaAdm" name="Realizado: Adm" stackId="a" fill="#1e3a8a" />
                  <Bar dataKey="receitaEscola" name="Realizado: Escola" stackId="a" fill="#007a33" />
                  <Bar dataKey="receitaCantina" name="Realizado: Cantina" stackId="a" fill="#cda53f" radius={[4, 4, 0, 0]} />
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
