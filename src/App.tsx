import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { auth, db } from './firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { 
  TrendingUp, 
  Users, 
  AlertCircle, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Settings,
  GraduationCap,
  ChevronDown,
  Info,
  History,
  ShieldAlert,
  Menu
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
import { cn } from '@/lib/utils';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLogin } from './components/AdminLogin';
import { PortalLogin } from './components/PortalLogin';
import { LandingPage } from './components/LandingPage';
import { Students } from './components/Students';
import { FinanceHub } from './components/FinanceHub';
import { Academic } from './components/Academic';
import { Staff } from './components/Staff';
import { Audit } from './components/Audit';
import { ImportSmart } from './components/ImportSmart';
import { Carnets } from './components/Carnets';
import { Grade } from './components/Grade';
import { Settings as SchoolSettings } from './components/Settings';
import { StudentPortal } from './components/StudentPortal';
import { StaffPortal } from './components/StaffPortal';
import { Classes } from './components/Classes';
import { Courses } from './components/Courses';
import { Modules } from './components/Modules';
import { GradesEntry } from './components/GradesEntry';
import { Requests } from './components/Requests';
import { Schedule } from './components/Schedule';
import { Reports } from './components/Reports';
import { SchoolCalendar } from './components/SchoolCalendar';
import { Announcements } from './components/Announcements';
import { Inventory } from './components/Inventory';
import { Polos } from './components/Polos';
import { Employees } from './components/Employees';
import { Users as AppUsers } from './components/Users';

import { MonthlyFees } from './components/MonthlyFees';
import { CashManagement } from './components/CashManagement';
import { OverduePayments } from './components/OverduePayments';
import { ContractAutomation } from './components/ContractAutomation';

import { Dashboard } from './components/Dashboard';

const Login = () => {
  return <Navigate to="/admin/login" replace />;
};

const AdminLayout: React.FC<{
  user: any;
  profile: any;
  student: any;
  activeTab: string;
  setActiveTab: (t: string) => void;
  nucleo: string;
  setNucleo: (n: any) => void;
  systemConfig: any;
  renderContent: (t: string) => React.ReactNode;
}> = React.memo(({ user, profile, student, activeTab, setActiveTab, nucleo, setNucleo, systemConfig, renderContent }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (student) return <Navigate to="/portal" replace />;
  
  // If no profile, go to login
  if (!profile) return <Navigate to="/admin/login" replace />;
  
  return (
    <div className="flex min-h-screen bg-white md:bg-gray-50 font-sans relative">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isMobileOpen={isMobileOpen} 
        setIsMobileOpen={setIsMobileOpen} 
      />
      <main className="flex-1 overflow-x-hidden">
        <header className="bg-white border-b border-gray-200 p-3 sm:p-4 flex items-center justify-between sticky top-0 z-[40] shadow-sm">
          <div className="flex items-center gap-2 sm:gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-navy"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu size={24} />
            </Button>

            {systemConfig?.logoUrl ? (
              <img src={systemConfig.logoUrl} alt="Logo" className="h-8 sm:h-10 w-auto object-contain" />
            ) : (
              <div className="flex items-center gap-2 scale-90 sm:scale-100">
                <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center">
                  <GraduationCap className="text-white w-5 h-5" />
                </div>
                <span className="font-black text-navy tracking-tighter text-lg uppercase hidden xs:block">ESTEADEB</span>
              </div>
            )}
            
            <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block" />

            <div className="relative group">
              <button 
                disabled={profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL'}
                className={cn(
                  "flex items-center gap-2 bg-navy text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-sm transition-all shadow-md",
                  profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL' 
                    ? "opacity-80 cursor-not-allowed" 
                    : "hover:bg-navy-dark"
                )}
              >
                <span className="text-petrol uppercase hidden xs:inline">MODALIDADE:</span> {nucleo}
                {!(profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL') && <ChevronDown size={14} className="sm:w-4 sm:h-4" />}
              </button>
              {!(profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL') && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                  {['PRESENCIAL', 'SEMIPRESENCIAL', 'EAD'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setNucleo(m as any)}
                      className={cn(
                        "w-full text-left px-4 py-3 text-sm font-bold transition-colors hover:bg-gray-50",
                        nucleo === m ? "text-petrol bg-petrol/5" : "text-navy"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-navy/5 px-2 sm:px-3 py-1 rounded-full hidden md:flex items-center gap-2">
              <Clock size={14} className="text-navy" />
              <span className="text-[10px] font-bold text-navy uppercase tracking-wider">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
               </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex gap-1 sm:gap-2 mr-1 sm:mr-4 border-r pr-1 sm:pr-4 border-gray-200">
              <Button variant="ghost" size="icon" title="Auditoria" onClick={() => setActiveTab('audit')}>
                <History size={18} className="text-gray-400 sm:w-5 sm:h-5" />
              </Button>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-navy leading-none uppercase tracking-tight">{profile?.name}</p>
              <p className="text-[10px] text-petrol font-bold uppercase tracking-widest mt-1">{profile?.role}</p>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-navy text-white flex items-center justify-center font-bold shadow-lg text-sm sm:text-base">
              {profile?.name?.charAt(0)}
            </div>
          </div>
        </header>
        
        <div className="max-w-[1600px] mx-auto p-0 sm:p-4">
          {renderContent(activeTab)}
        </div>
      </main>
    </div>
  );
});

const AppContent: React.FC = () => {
  const { user, profile, loading, nucleo, setNucleo, student, systemConfig } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  console.log("App: AppContent Rendering", { loading, hasProfile: !!profile, hasStudent: !!student });

  const renderContent = useCallback((tab: string) => {
    // Add internal sanity role check. Fallback to Dashboard silently.
    const userRole = profile?.role?.toLowerCase() || '';
    const isAdminUser = ['admin', 'direção', 'administrador geral', 'administrador'].includes(userRole);

    const guard = (Component: React.FC, requiredRoles: string[]) => {
      if (isAdminUser) return <Component />;
      
      const normalizedRoles = (requiredRoles || []).map(r => r.toLowerCase());
      if (normalizedRoles.includes(userRole)) return <Component />;
      
      // Safety check for permissions array
      const userPermissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
      if (userPermissions.includes(tab)) return <Component />;
      
      return <Dashboard />; 
    };

    switch (tab) {
      case 'dashboard': return <Dashboard />;
      case 'academic': return guard(Academic, ['staff', 'secretaria', 'coordenador']);
      case 'students': return guard(Students, ['staff', 'secretaria', 'coordenador']);
      case 'classes': return guard(Classes, ['staff', 'secretaria', 'coordenador']);
      case 'courses': return guard(Courses, ['staff', 'secretaria', 'coordenador']);
      case 'curriculum':
      case 'grade': return guard(Grade, ['staff', 'secretaria', 'coordenador']);
      case 'modules': return guard(Modules, ['staff', 'secretaria', 'coordenador']);
      case 'grades': return guard(GradesEntry, ['staff', 'secretaria', 'coordenador']);
      case 'requests': return guard(Requests, ['staff', 'secretaria', 'coordenador']);
      case 'schedules': return guard(Schedule, ['staff', 'secretaria', 'coordenador']);
      case 'finance': return guard(FinanceHub, ['staff', 'secretaria', 'coordenador']);
      case 'monthly-fees': return guard(MonthlyFees, ['staff', 'secretaria', 'coordenador']);
      case 'announcements': return guard(Announcements, ['staff', 'secretaria', 'coordenador']);
      case 'settings': return guard(SchoolSettings, ['admin', 'direção']);
      case 'audit': return guard(Audit, ['admin', 'direção']);
      case 'carnets': return guard(Carnets, ['staff', 'secretaria', 'coordenador']);
      case 'inventory':
      case 'stock': return guard(Inventory, ['staff', 'secretaria', 'coordenador']);
      case 'audit-logs': return guard(Audit, ['admin', 'direção']);
      case 'polos':
      case 'units': return guard(Polos, ['staff', 'secretaria', 'coordenador']);
      case 'users': return guard(AppUsers, ['admin', 'direção']);
      case 'staff':
      case 'employees': return guard(Employees, ['admin', 'direção']);
      case 'grades-entry': return guard(GradesEntry, ['staff', 'secretaria', 'coordenador']);
      case 'reports': return guard(Reports, ['staff', 'secretaria', 'coordenador']);
      case 'calendar': return guard(SchoolCalendar, ['staff', 'secretaria', 'coordenador']);
      case 'cash-management': return guard(CashManagement, ['staff', 'secretaria', 'coordenador']);
      case 'overdue-payments': return guard(OverduePayments, ['staff', 'secretaria', 'coordenador']);
      case 'staff-portal': return guard(StaffPortal, ['staff', 'secretaria', 'coordenador']);
      case 'student-portal': return guard(StudentPortal, ['staff', 'secretaria', 'coordenador']);
      case 'trash': return guard(Audit, ['admin', 'direção']);
      default: return <Dashboard />;
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#001529] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-white font-black animate-pulse uppercase tracking-[0.3em] text-[10px]">ERP ESTEADEB • BLACK VERSION</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin/login" element={profile ? <Navigate to="/admin" replace /> : <AdminLogin />} />
      <Route 
        path="/admin/*" 
        element={
          <AdminLayout 
            user={user}
            profile={profile} 
            student={student} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            nucleo={nucleo}
            setNucleo={setNucleo}
            systemConfig={systemConfig}
            renderContent={renderContent}
          />
        } 
      />
      <Route path="/aluno/login" element={<Navigate to="/portal/login" replace />} />
      <Route path="/aluno/*" element={<Navigate to="/portal" replace />} />
      <Route path="/portal/login" element={student ? <Navigate to="/portal" replace /> : <PortalLogin />} />
      <Route path="/portal/*" element={student ? <StudentPortal /> : <Navigate to="/portal/login" replace />} />
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
