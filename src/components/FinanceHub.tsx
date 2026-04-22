import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Banknote, 
  TrendingDown, 
  Settings,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import components
import { Finance as FinancialDashboard } from './Finance';
import { MonthlyFees } from './MonthlyFees';
import { CashManagement } from './CashManagement';
import { OverduePayments } from './OverduePayments';
import { FinancialSettings } from './FinancialSettings';

export const FinanceHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');

  const tabs = ['Dashboard', 'Mensalidades', 'Fluxo de Caixa', 'Inadimplência', 'Configurações'];

  const getIcon = (tab: string) => {
    switch (tab) {
      case 'Dashboard': return LayoutDashboard;
      case 'Mensalidades': return Receipt;
      case 'Fluxo de Caixa': return Banknote;
      case 'Inadimplência': return TrendingDown;
      case 'Configurações': return Settings;
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

      {/* Content Area */}
      <div className="max-w-[1600px] mx-auto">
        {renderContent()}
      </div>
    </div>
  );
};
