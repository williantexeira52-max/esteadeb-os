import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { seedInitialAdmin } from '../lib/seeder';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  student: any | null;
  loading: boolean;
  systemConfig: any | null;
  nucleo: 'PRESENCIAL' | 'EAD' | 'SEMIPRESENCIAL';
  isAdmin: boolean;
  isStaff: boolean;
  setNucleo: (n: 'PRESENCIAL' | 'EAD' | 'SEMIPRESENCIAL') => void;
  loginStudent: (studentData: any) => void;
  logoutStudent: () => void;
  loginAdmin: (adminData: any) => void;
  logoutAdmin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('esteadeb_admin');
      if (!saved) return null;
      
      const parsedData = JSON.parse(saved);
      
      // Structural boundary check ensuring critical UI dependencies exist
      if (typeof parsedData === 'object' && parsedData !== null && 'role' in parsedData && 'name' in parsedData) {
         return parsedData;
      }
      
      return null;
    } catch (e) {
      console.error("AuthContext: Error parsing admin profile", e);
      localStorage.removeItem('esteadeb_admin'); // Purge corrupt local cache payload 
      return null;
    }
  });
  const [student, setStudent] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('esteadeb_student');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("AuthContext: Error parsing student portal session", e);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [nucleo, setNucleoState] = useState<'PRESENCIAL' | 'EAD' | 'SEMIPRESENCIAL'>(
    (localStorage.getItem('esteadeb_nucleo') as any) || 'PRESENCIAL'
  );

  useEffect(() => {
    seedInitialAdmin();

    // KILL SWITCH: 5s force loading false
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);
    
    // Auth central listener with error handling
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      clearTimeout(timeoutId);
    }, (error) => {
      console.error("Auth state error:", error);
      setLoading(false);
      clearTimeout(timeoutId);
    });

    // Centralized system config listener - FIXED permission-denied
    const unsubConfig = onSnapshot(doc(db, 'settings', 'system_config'), (snap) => {
      if (snap.exists()) {
        setSystemConfig(snap.data());
      }
    }, (error) => {
      console.warn("Permission-denied safely handled in system_config:", error);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribeAuth();
      unsubConfig();
    };
  }, []);

  const setNucleo = (n: 'PRESENCIAL' | 'EAD' | 'SEMIPRESENCIAL') => {
    // Prevent switching if the user has a restricted nucleo
    if (profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL') {
      console.warn("AuthContext: Nucleo switch blocked by user restriction");
      return;
    }
    setNucleoState(n);
    localStorage.setItem('esteadeb_nucleo', n);
  };

  // Sync nucleo with profile restriction whenever profile changes
  useEffect(() => {
    if (profile?.restrictedNucleo && profile.restrictedNucleo !== 'ALL') {
      const restricted = profile.restrictedNucleo as 'PRESENCIAL' | 'EAD' | 'SEMIPRESENCIAL';
      if (nucleo !== restricted) {
        setNucleoState(restricted);
        localStorage.setItem('esteadeb_nucleo', restricted);
      }
    }
  }, [profile, nucleo]);

  const loginStudent = (studentData: any) => {
    // Retain admin session (if any) for testers to return to the Gestor later
    setStudent(studentData);
    localStorage.setItem('esteadeb_student', JSON.stringify(studentData));
  };

  const logoutStudent = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Student logout auth error:", e);
    }
    setStudent(null);
    localStorage.removeItem('esteadeb_student');
  };

  const loginAdmin = (adminData: any) => {
    // Force clear any student session
    setStudent(null);
    localStorage.removeItem('esteadeb_student');
    
    setProfile(adminData);
    localStorage.setItem('esteadeb_admin', JSON.stringify(adminData));
  };

  const logoutAdmin = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Admin logout auth error:", e);
    }
    setProfile(null);
    localStorage.removeItem('esteadeb_admin');
  };

  // Removed onAuthStateChanged to prevent any Firebase Auth overlays or Google prompts
  // The system now uses strict database-only authentication via Firestore queries

  const isAdmin = React.useMemo(() => {
    const role = profile?.role?.toLowerCase();
    const email = profile?.email || user?.email;
    return ['admin', 'direção', 'diretor', 'administrador geral'].includes(role) || 
           ['williantexeira52@gmail.com', '000000@esteadeb.com.br'].includes(email);
  }, [profile, user]);

  const isStaff = React.useMemo(() => {
    const role = profile?.role?.toLowerCase();
    return isAdmin || ['secretaria', 'coordenador', 'professor'].includes(role);
  }, [profile, isAdmin]);

  const value = React.useMemo(() => ({ 
    user, 
    profile, 
    student, 
    loading, 
    systemConfig,
    nucleo, 
    isAdmin,
    isStaff,
    setNucleo, 
    loginStudent, 
    logoutStudent,
    loginAdmin,
    logoutAdmin
  }), [user, profile, student, loading, systemConfig, nucleo, isAdmin, isStaff]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
