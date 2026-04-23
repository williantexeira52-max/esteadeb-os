import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Wallet, 
  FileText, 
  LogOut,
  Menu,
  X,
  BookOpen,
  Layers,
  Calendar,
  UserCog,
  UserCircle,
  Settings,
  Puzzle,
  ClipboardCheck,
  Clock,
  BarChart3,
  Package,
  Bell,
  Building2,
  Trash2,
  UserCheck,
  ChevronDown,
  Banknote,
  Briefcase,
  Globe,
  Receipt,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  roles: string[];
}

interface NavCategory {
  id: string;
  label: string;
  icon: any;
  items?: NavItem[];
  roles: string[];
  isDirect?: boolean;
}

export const Sidebar: React.FC<SidebarProps & { isMobileOpen?: boolean; setIsMobileOpen?: (v: boolean) => void }> = ({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen }) => {
  const { profile, logoutAdmin, systemConfig } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Close mobile sidebar on tab change
  useEffect(() => {
    if (setIsMobileOpen) setIsMobileOpen(false);
  }, [activeTab]);

  const categories: NavCategory[] = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'],
      isDirect: true 
    },
    {
      id: 'academic',
      label: 'Acadêmico',
      icon: GraduationCap,
      roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'],
      items: [
        { id: 'students', label: 'Alunos', icon: GraduationCap, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'classes', label: 'Turmas', icon: Users, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'courses', label: 'Cursos', icon: BookOpen, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'curriculum', label: 'Disciplinas', icon: Layers, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'modules', label: 'Módulos', icon: Puzzle, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'grades', label: 'Notas', icon: ClipboardCheck, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'requests', label: 'Requerimentos', icon: FileText, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'schedules', label: 'Horários', icon: Clock, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
      ]
    },
    {
      id: 'finance',
      label: 'Financeiro',
      icon: Banknote,
      roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'],
      items: [
        { id: 'finance', label: 'Hub Financeiro', icon: Wallet, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
      ]
    },
    {
      id: 'operation',
      label: 'Gestão & Operação',
      icon: Briefcase,
      roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'],
      items: [
        { id: 'reports', label: 'Relatórios', icon: BarChart3, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'stock', label: 'Estoque', icon: Package, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'announcements', label: 'Avisos', icon: Bell, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'calendar', label: 'Calendário', icon: Calendar, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'polos', label: 'Polos', icon: Building2, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
      ]
    },
    {
      id: 'config',
      label: 'Configurações & RH',
      icon: Settings,
      roles: ['admin', 'Direção'],
      items: [
        { id: 'staff', label: 'Funcionários', icon: UserCog, roles: ['admin', 'Direção'] },
        { id: 'users', label: 'Usuários', icon: UserCircle, roles: ['admin', 'Direção'] },
        { id: 'settings', label: 'Configuração', icon: Settings, roles: ['admin', 'Direção'] },
        { id: 'trash', label: 'Lixeira', icon: Trash2, roles: ['admin', 'Direção'] },
      ]
    },
    {
      id: 'portals',
      label: 'Portais Extras',
      icon: Globe,
      roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'],
      items: [
        { id: 'student-portal', label: 'Portal do Aluno', icon: GraduationCap, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
        { id: 'staff-portal', label: 'Portal do Funcionário', icon: UserCheck, roles: ['admin', 'staff', 'Direção', 'Secretaria', 'Coordenador'] },
      ]
    }
  ];

  // Auto-open category based on active tab
  useEffect(() => {
    const category = categories.find(cat => 
      cat.items?.some(item => item.id === activeTab)
    );
    if (category) {
      setOpenCategory(category.id);
    }
  }, [activeTab]);

  const toggleCategory = (categoryId: string) => {
    if (!isOpen) {
      setIsOpen(true);
      setOpenCategory(categoryId);
      return;
    }
    setOpenCategory(openCategory === categoryId ? null : categoryId);
  };

  const handleItemClick = (itemId: string) => {
    setActiveTab(itemId);
  };

  const isAllowed = (itemRoles: string[], itemId?: string) => {
    if (!profile) return false;
    
    const role = profile.role?.toLowerCase() || '';
    
    // Admins and Directors see everything
    if (['admin', 'direção', 'administrador geral', 'administrador'].includes(role)) return true;
    
    // If the user has a custom permissions array, USE IT strictly for non-admins
    if (Array.isArray(profile.permissions)) {
      if (itemId && profile.permissions.includes(itemId)) return true;
      return false;
    }
    
    // Check for explicit role match (case-insensitive) as fallback
    if (itemRoles.some(r => r.toLowerCase() === role)) return true;
    
    // Check for explicit module permission (fallback if permissions is not array but string? shouldn't happen)
    if (itemId && profile.permissions?.includes(itemId)) return true;
    
    return false;
  };

  const filteredCategories = categories.filter(cat => {
    // A category is allowed if the user has the role OR if any of its items are explicitly allowed by permission
    if (isAllowed(cat.roles, cat.id)) return true;
    if (cat.items?.some(item => isAllowed(item.roles, item.id))) return true;
    return false;
  });

  return (
    <div className={cn(
      "bg-[#0a0c10] text-[#a0a0a0] h-screen transition-all duration-500 flex flex-col border-r border-white/5 relative z-50 shadow-[20px_0_40px_rgba(0,0,0,0.4)]",
      isOpen ? "w-72" : "w-24",
      "fixed left-0 top-0 lg:sticky lg:translate-x-0 transition-transform",
      isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden -z-10" 
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}
      <div className="p-6 flex items-center justify-between border-b border-white/5 shrink-0 h-24">
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            {systemConfig?.logoUrl ? (
              <img src={systemConfig.logoUrl} alt="Logo" className="h-10 w-auto object-contain brightness-0 invert shadow-glow" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-esteadeb-blue rounded-xl flex items-center justify-center text-white font-black shadow-md">E</div>
                <span className="font-black text-white text-xl tracking-tighter uppercase italic">
                  ESTEADEB
                </span>
              </div>
            )}
          </motion.div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsOpen(!isOpen)} 
          className="text-white/20 hover:text-white hover:bg-white/5 rounded-2xl w-10 h-10"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pt-10 pb-6 px-4 space-y-4">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="space-y-2">
            {cat.isDirect ? (
              <button
                onClick={() => handleItemClick(cat.id)}
                className={cn(
                  "w-full flex items-center p-4 rounded-2xl transition-all group relative",
                  activeTab === cat.id 
                    ? "bg-esteadeb-blue text-white shadow-lg scale-[1.02]" 
                    : "hover:bg-white/5 text-white/40 hover:text-white"
                )}
                title={!isOpen ? cat.label : undefined}
              >
                <cat.icon size={22} className={cn(activeTab === cat.id ? "text-white" : "group-hover:text-esteadeb-blue transition-colors")} />
                {isOpen && <span className="ml-4 text-[11px] font-black uppercase tracking-widest">{cat.label}</span>}
                {activeTab === cat.id && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute left-[-1rem] w-1.5 h-8 bg-white rounded-r-full shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                  />
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "w-full flex items-center p-4 rounded-2xl transition-all group relative",
                    openCategory === cat.id ? "bg-white/[0.03] text-white" : "text-white/40 hover:text-white hover:bg-white/5",
                    cat.items?.some(i => i.id === activeTab) && !openCategory && "text-esteadeb-blue bg-esteadeb-blue/5 shadow-inner"
                  )}
                  title={!isOpen ? cat.label : undefined}
                >
                  <cat.icon size={22} className={cn(openCategory === cat.id ? "text-esteadeb-blue" : "group-hover:text-esteadeb-yellow transition-colors")} />
                  {isOpen && (
                    <>
                      <span className="ml-4 text-[11px] font-black uppercase tracking-widest flex-1 text-left">{cat.label}</span>
                      <ChevronDown 
                        size={16} 
                        className={cn("transition-all duration-500", openCategory === cat.id ? "rotate-180 text-esteadeb-blue" : "opacity-20")} 
                      />
                    </>
                  )}
                  {cat.items?.some(i => i.id === activeTab) && !openCategory && (
                    <div className="absolute left-[-1rem] w-1.5 h-8 bg-esteadeb-blue rounded-r-full shadow-sm" />
                  )}
                </button>

                <AnimatePresence>
                  {isOpen && openCategory === cat.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden ml-6 border-l border-white/5 pl-4 space-y-2 mt-2"
                    >
                      {cat.items?.filter(item => isAllowed(item.roles, item.id)).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item.id)}
                          className={cn(
                            "w-full flex items-center p-3 rounded-xl transition-all group relative",
                            activeTab === item.id 
                              ? "text-esteadeb-blue font-black bg-esteadeb-blue/10 shadow-inner" 
                              : "hover:bg-white/5 text-white/30 hover:text-white"
                          )}
                        >
                          <item.icon size={18} className={cn(activeTab === item.id ? "text-esteadeb-blue" : "group-hover:text-esteadeb-yellow transition-colors")} />
                          <span className="ml-4 text-[10px] uppercase font-bold tracking-widest">{item.label}</span>
                          {activeTab === item.id && (
                            <motion.div 
                              layoutId={`sub-active-${cat.id}`}
                              className="absolute left-0 w-1 h-5 bg-esteadeb-blue rounded-full"
                            />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="p-6 bg-black/40 backdrop-blur-3xl border-t border-white/5">
        <div className="flex items-center mb-6 group cursor-pointer">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-esteadeb-blue to-navy-dark flex items-center justify-center font-black text-white text-lg shadow-xl group-hover:scale-110 transition-transform">
            {profile?.name?.charAt(0) || 'U'}
          </div>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="ml-4 overflow-hidden"
            >
              <p className="text-sm font-black text-white truncate uppercase tracking-tighter leading-none">{profile?.name}</p>
              <p className="text-[9px] text-esteadeb-yellow/40 font-black uppercase tracking-[0.2em] mt-1.5">{profile?.role}</p>
            </motion.div>
          )}
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-white/20 hover:text-rose-400 hover:bg-rose-500/10 h-14 rounded-2xl transition-all"
          onClick={logoutAdmin}
        >
          <LogOut size={22} />
          {isOpen && <span className="ml-4 font-black text-[10px] uppercase tracking-[0.2em]">Terminate Session</span>}
        </Button>
      </div>
    </div>
  );
};

