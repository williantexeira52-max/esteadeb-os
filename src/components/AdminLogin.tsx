import React, { useState } from 'react';
import { collection, query, where, getDocs, getDocsFromServer } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { GraduationCap, Lock, User, Loader2, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const AdminLogin: React.FC = () => {
  const { loginAdmin } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log("AdminLogin: Submitting...", { identifier });
    setLoading(true);
    setError('');
    
    if (!identifier || !password) {
      setError('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    try {
      const cleanIdentifier = identifier.replace(/\D/g, '');
      const isCpfCandidate = cleanIdentifier.length === 11 || (cleanIdentifier.length >= 4 && !identifier.includes('@'));

      // 1. Map identifier to hidden email (legacy behavior)
      let mappedEmail = identifier.includes('@') 
        ? identifier.toLowerCase().trim() 
        : (cleanIdentifier ? `${cleanIdentifier}@esteadeb.com.br` : `${identifier.toLowerCase().replace(/\s+/g, '')}@esteadeb.com.br`);
      const authPassword = (identifier === '000000' && password === '123456') 
        ? password 
        : (password.length < 6 ? `${password}_admin` : password);
      
      console.log("AdminLogin: Attempting Auth for", mappedEmail);

      try {
        // 2. Authenticate with Firebase Auth
        await signInWithEmailAndPassword(auth, mappedEmail, authPassword);
      } catch (authErr: any) {
        // If user doesn't exist in Auth, we check if they exist in Firestore
        // If they do, we provision the Auth account on the fly
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
          console.log("AdminLogin: Initial Auth failed. Checking Firestore by Email or CPF...");
          
          // Check app_users collection by email OR CPF
          let userData: any = null;
          
          // Try Email first
          const emailSnap = await getDocsFromServer(query(collection(db, 'app_users'), where('email', '==', mappedEmail)));
          if (!emailSnap.empty) {
            userData = emailSnap.docs[0].data();
          } else if (isCpfCandidate) {
            // Try CPF
            console.log("AdminLogin: Checking Firestore by CPF:", cleanIdentifier);
            const cpfSnap = await getDocsFromServer(query(collection(db, 'app_users'), where('cpf', '==', cleanIdentifier)));
            if (!cpfSnap.empty) {
              userData = cpfSnap.docs[0].data();
              // Update mapped email to the real one found in the profile
              mappedEmail = userData.email;
              console.log("AdminLogin: Found profile by CPF. Using email:", mappedEmail);
            }
          }
          
          if (userData) {
            console.log("AdminLogin: User found in Firestore. Provisioning/Verifying...");
            
            // Strictly verify password against Firestore password (if set)
            const expectedPassword = userData.password || userData.cpf || (userData.email ? userData.email.split('@')[0] : '123456');
            
            if (password === expectedPassword || (password.length < 6 && `${password}_admin` === expectedPassword)) {
               try {
                 await createUserWithEmailAndPassword(auth, mappedEmail, authPassword);
                 console.log("AdminLogin: Auth account provisioned successfully!");
               } catch (createErr: any) {
                 if (createErr.code === 'auth/email-already-in-use') {
                    // If already in use, try to sign in with the found email
                    await signInWithEmailAndPassword(auth, mappedEmail, authPassword);
                 } else {
                    throw createErr;
                 }
               }
            } else {
               throw authErr;
            }
          } else {
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      // 3. Now that we are authenticated, we can query Firestore securely
      let adminData: any = null;
      
      // Try by UID first (most secure for rules)
      try {
        const userDoc = await getDocsFromServer(query(collection(db, 'app_users'), where('uid', '==', auth.currentUser?.uid)));
        if (!userDoc.empty) {
          adminData = { id: userDoc.docs[0].id, ...userDoc.docs[0].data() };
        }
      } catch (e) {
        console.warn("Lookup by UID failed, trying email...");
      }

      if (!adminData) {
        const snap = await getDocsFromServer(query(collection(db, 'app_users'), where('email', '==', mappedEmail)));
        if (!snap.empty) {
          adminData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      }
      
      if (!adminData) {
        setError('Acesso autenticado, mas perfil não encontrado ou sem permissão de acesso ao sistema (app_users).');
      } else {
        // Sync UID to Firestore profile to ensure security rules function correctly
        if (auth.currentUser?.uid && adminData.uid !== auth.currentUser.uid) {
           const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
           await updateDoc(doc(db, 'app_users', adminData.id), {
             uid: auth.currentUser.uid,
             lastLogin: serverTimestamp()
           });
        }

        // Fix for legacy users or users without explicit roles
        if (!adminData.role) {
          adminData.role = adminData.isGlobalAccess ? 'Direção' : 'Coordenador';
        }
        loginAdmin(adminData);
      }
    } catch (err: any) {
      console.log("Login details:", err.code);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O provedor de E-mail/Senha não está ativado no Console do Firebase. Ative-o em Autenticação > Sign-in method.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Formato de usuário/e-mail inválido. Verifique o que foi digitado.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Credenciais inválidas. Verifique seu identificador e senha.');
      } else {
        setError(`ERRO DE CONEXÃO ADMIN: ${err.message || 'Desconhecido'} (Código: ${err.code || 'sem-codigo'}). Verifique a configuração do Firebase.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-esteadeb-blue/10 rounded-full blur-[160px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-esteadeb-yellow/5 rounded-full blur-[160px]" />
      </div>

      <div className="max-w-xl w-full relative z-10 transition-all duration-1000">
        <div className="bg-[#0f1115] rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden border border-white/5 relative">
          
          <div className="bg-gradient-to-b from-[#161922] to-[#0f1115] p-12 text-center border-b border-white/5 relative">
            <div className="absolute inset-0 bg-esteadeb-blue/5 opacity-50 blur-3xl pointer-events-none" />
            
            <div className="w-28 h-28 bg-[#ffffff]/5 rounded-[2.5rem] mx-auto mb-8 flex items-center justify-center shadow-2xl backdrop-blur-3xl border border-white/10 group hover:border-esteadeb-blue/50 transition-all duration-500">
              <GraduationCap className="text-white w-14 h-14 group-hover:scale-110 transition-transform" />
            </div>
            
            <h1 className="text-white text-5xl font-black tracking-tighter uppercase leading-none italic">
              ESTEADEB
            </h1>
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className="h-[1px] w-8 bg-esteadeb-blue/30" />
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">Black Edition • Control Panel</p>
              <span className="h-[1px] w-8 bg-esteadeb-blue/30" />
            </div>
          </div>

          <div className="p-14 bg-black/20 backdrop-blur-sm">
            <form onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] ml-2">Identidade Administrativa</label>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-esteadeb-blue transition-colors" size={20} />
                  <Input 
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-14 h-16 bg-white/[0.03] border border-white/10 rounded-2xl focus:border-esteadeb-blue/50 focus:bg-white/[0.05] outline-none transition-all font-bold text-white text-lg placeholder:text-white/10"
                    placeholder="CPF ou Matrícula"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] ml-2">Senha de Segurança</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-esteadeb-blue transition-colors" size={20} />
                  <Input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-14 h-16 bg-white/[0.03] border border-white/10 rounded-2xl focus:border-esteadeb-blue/50 focus:bg-white/[0.05] outline-none transition-all font-bold text-white text-lg placeholder:text-white/10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl">
                  <p className="text-rose-400 text-xs font-black text-center uppercase tracking-tight">{error}</p>
                </div>
              )}

              <Button 
                type="submit"
                disabled={loading}
                onClick={() => console.log("AdminLogin button raw click detected")}
                className="w-full bg-esteadeb-blue hover:bg-esteadeb-blue/90 text-white h-20 rounded-2xl font-black uppercase tracking-[0.3em] shadow-xl flex items-center justify-center gap-4 transition-all transform hover:scale-[1.02] active:scale-[0.98] group"
              >
                {loading ? (
                  <Loader2 className="animate-spin w-8 h-8" />
                ) : (
                  <>
                    <span className="text-sm">Log In System</span>
                    <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-12 flex justify-between items-center px-2">
              <p className="text-[9px] text-white/10 uppercase font-black tracking-widest leading-relaxed">
                Acesso restrito aos <br /> colaboradores autorizados
              </p>
              <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 group hover:border-esteadeb-blue transition-colors">
                <p className="text-[10px] text-esteadeb-blue font-bold tracking-tighter shadow-[0_0_10px_rgba(2,63,198,0.3)]">SIGA V3.0 • ERP System</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
