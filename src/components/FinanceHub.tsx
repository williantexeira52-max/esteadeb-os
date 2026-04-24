import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Banknote, 
  TrendingDown, 
  Settings,
  AlertCircle,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Import components
import { Finance as FinancialDashboard } from './Finance';
import { MonthlyFees } from './MonthlyFees';
import { CashManagement } from './CashManagement';
import { OverduePayments } from './OverduePayments';
import { FinancialSettings } from './FinancialSettings';
import { CommunicationSettings } from './CommunicationSettings';

export const FinanceHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const { profile, nucleo } = useAuth();
  const [alerts, setAlerts] = useState<{ message: string, type: 'warning' | 'error' }[]>([]);

  useEffect(() => {
    if (!nucleo) return;

    let qSchoolCash = query(collection(db, 'school_cash'), where('nucleoId', '==', nucleo));
    let qSnackCash = query(collection(db, 'snack_cash'), where('nucleoId', '==', nucleo));
    
    if (profile?.poloId) {
      qSchoolCash = query(collection(db, 'school_cash'), where('nucleoId', '==', nucleo), where('poloId', '==', profile.poloId));
      qSnackCash = query(collection(db, 'snack_cash'), where('nucleoId', '==', nucleo), where('poloId', '==', profile.poloId));
    }

    const calcBalance = (docs: any[]) => {
      return docs.reduce((acc, curr) => {
        if (curr.type === 'ENTRY' || (!curr.type && Number(curr.amount) > 0)) return acc + Number(curr.amount || 0);
        if (curr.type === 'WITHDRAWAL' || (!curr.type && Number(curr.amount) < 0)) return acc - Math.abs(Number(curr.amount || 0));
        return acc;
      }, 0);
    };

    const unsubSchool = onSnapshot(qSchoolCash, (snap) => {
      const balance = calcBalance(snap.docs.map(d => d.data()));
      setAlerts(prev => {
        const filtered = prev.filter(a => !a.message.includes('Caixa Escola'));
        if (balance < 0) return [...filtered, { message: 'Saldo Negativo no Caixa Escola!', type: 'error' }];
        if (balance <= 50) return [...filtered, { message: 'Atenção: Saldo baixo no Caixa Escola. Solicite troco.', type: 'warning' }];
        return filtered;
      });
    });

    const unsubSnack = onSnapshot(qSnackCash, (snap) => {
      const balance = calcBalance(snap.docs.map(d => d.data()));
      setAlerts(prev => {
        const filtered = prev.filter(a => !a.message.includes('Caixa Cantina'));
        if (balance < 0) return [...filtered, { message: 'Saldo Negativo no Caixa Cantina/Lanche!', type: 'error' }];
        if (balance <= 50) return [...filtered, { message: 'Atenção: Saldo baixo no Caixa Cantina. Solicite troco.', type: 'warning' }];
        return filtered;
      });
    });

    return () => {
      unsubSchool();
      unsubSnack();
    };
  }, [nucleo, profile]);

  const tabs = ['Dashboard', 'Mensalidades', 'Fluxo de Caixa', 'Inadimplência', 'Configurações', 'Automação'];

  const getIcon = (tab: string) => {
    switch (tab) {
      case 'Dashboard': return LayoutDashboard;
      case 'Mensalidades': return Receipt;
      case 'Fluxo de Caixa': return Banknote;
      case 'Inadimplência': return TrendingDown;
      case 'Configurações': return Settings;
      case 'Automação': return Bot;
      default: return LayoutDashboard;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard': return <FinancialDashboard />;
      case 'Mensalidades': return <MonthlyFees />;
      case 'Fluxo de Caixa': return <CashManagement />;
      case 'Inadimplência': return <OverduePayments />;
      case 'Configurações': return <FinancialSettings />;
      case 'Automação': return <CommunicationSettings />;
      default: return <FinancialDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-8">
          <div className="flex items-center h-20 gap-8">
            <div className="flex items-center gap-3 mr-4">
              <div className="p-2 bg-navy rounded-xl text-white">
                <Banknote size={24} />
              </div>
              <span className="font-black text-navy uppercase tracking-tighter text-xl">Hub Financeiro</span>
            </div>

            <nav className="flex items-center h-full">
              {tabs.map((tab) => {
                const Icon = getIcon(tab);
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex items-center gap-2 px-6 h-full text-sm font-black uppercase tracking-widest transition-all border-b-4 relative",
                      isActive 
                        ? "border-petrol text-petrol bg-petrol/5" 
                        : "border-transparent text-slate-400 hover:text-navy hover:bg-slate-50"
                    )}
                  >
                    <Icon size={18} />
                    {tab}
                    {tab === 'Inadimplência' && (
                      <span className="absolute top-6 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="max-w-[1600px] mx-auto px-8 pt-6 space-y-2">
          {alerts.map((alert, index) => (
            <div 
              key={index} 
              className={cn(
                "p-4 rounded-2xl flex items-center gap-3 border shadow-sm",
                alert.type === 'error' ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
              )}
            >
              <AlertCircle size={24} className="shrink-0" />
              <p className="font-bold">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="max-w-[1600px] mx-auto pt-2">
        {renderContent()}
      </div>
    </div>
  );
};
