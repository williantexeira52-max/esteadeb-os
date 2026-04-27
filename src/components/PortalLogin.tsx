import React, { useState } from 'react';
import { LogIn, User, Lock, Eye, EyeOff, Loader2, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, doc, getDocs, query, where, getDocFromServer } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const PortalLogin: React.FC = () => {
  const { loginStudent, systemConfig } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log("PortalLogin: Submitting...", { identifier, hasPassword: !!password });
    setError('');
    
    if (!identifier || !password) {
      setError('Por favor, preencha todos os campos.');
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 500);
      return;
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    if (cleanIdentifier.length < 3) {
      setError('Identificador muito curto. Verifique seu Usuário, Matrícula ou CPF.');
      return;
    }

    setIsLoading(true);
    try {
      console.log("PortalLogin: Authenticating with Firebase Auth first...");
      const isEmail = cleanIdentifier.includes('@');
      const studentEmail = isEmail ? cleanIdentifier : `${cleanIdentifier.replace(/\D/g, '') || cleanIdentifier}@estudante.esteadeb.com.br`;
      const authPassword = password.length < 6 ? `${password}_student` : password;
      
      let isNewAuthProvision = false;

      // 1. Try to log in with Firebase Auth
      try {
        await signInWithEmailAndPassword(auth, studentEmail, authPassword);
      } catch (authErr: any) {
        if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/user-not-found') {
          try {
             // If we didn't find them, we can't provision safely yet because we don't know their real CPF
             // But the rules require auth. Let's do an anonymous login? Not enabled.
             // We will provision them with this email, and if it fails to find the doc, we delete the user.
            await createUserWithEmailAndPassword(auth, studentEmail, authPassword);
            isNewAuthProvision = true;
          } catch (createErr: any) {
             throw createErr;
          }
        } else {
          throw authErr;
        }
      }

      // 2. NOW we are authenticated. We can query Firestore safely.
      // Since identifier could be CPF, user, matricula or email.
      console.log("PortalLogin: Querying student doc...");
      let studentData = null;
      let studentDocId = null;

      const studentsRef = collection(db, 'students');
      
      // We will try several queries
      const queries = [
        query(studentsRef, where('cpf', '==', cleanIdentifier.replace(/\D/g, ''))), // CPF formatting
        query(studentsRef, where('matricula', '==', cleanIdentifier)),
        query(studentsRef, where('email', '==', cleanIdentifier))
      ];

      for (const q of queries) {
        try {
          const snap = await getDocs(q);
          if (!snap.empty) {
            studentDocId = snap.docs[0].id;
            studentData = { id: studentDocId, ...snap.docs[0].data() };
            break;
          }
        } catch (e) {
          console.warn("Query failed, might be rules restriction", e);
        }
      }

      // Fallback: If cleanIdentifier happens to be the document ID (CPF) directly
      if (!studentData) {
        try {
          // just try with raw numbers (usually document ID is raw CPF)
          const rawCpf = cleanIdentifier.replace(/\D/g, '');
          if (rawCpf && rawCpf.length === 11) {
            const snap = await getDocFromServer(doc(db, 'students', rawCpf));
            if (snap.exists()) {
              studentData = { id: snap.id, ...snap.data() };
            }
          }
        } catch (e) {
            console.warn("Direct doc fetch failed");
        }
      }

      const genericError = 'Login incorreto. Verifique suas credenciais.';

      if (!studentData) {
        console.warn("PortalLogin: Student not found in Firestore");
        await auth.signOut(); // Kick them out if not a real student
        setError('Aluno não encontrado com este identificador. Tente usar seu CPF apenas com números ou Matrícula correta.');
        setIsLoading(false);
        return;
      }

      // 3. Logic: Verify the password against Firestore custom pass logic
      if (isNewAuthProvision) {
        const cpfNumbers = (studentData.cpf || studentData.id || "").toString().replace(/\D/g, '');
        const lastFourOfCpf = cpfNumbers.slice(-4);
        const expectedPassword = studentData.portalPassword || studentData.matricula || lastFourOfCpf;
        
        if (password !== expectedPassword) {
          console.warn("PortalLogin: Password mismatch on first provision");
          if (auth.currentUser) {
            try {
              // Delete the incorrectly created auth user so they can try again with the right password
              await auth.currentUser.delete();
            } catch (err) {
              console.error("Failed to delete incorrect auth provision", err);
            }
          }
          await auth.signOut();
          setError('Senha incorreta.');
          setIsLoading(false);
          return;
        }
      }

      // 4. Login successful
      console.log("PortalLogin: Login successful!");
      loginStudent(studentData);
    } catch (err: any) {
      console.error("LOGIN_DEBUG_ERROR:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O provedor de E-mail/Senha não está ativado no Console do Firebase. Ative-o em Autenticação > Sign-in method.');
      } else {
        setError(`ERRO DE CONEXÃO: ${err.message || 'Desconhecido'} (Código: ${err.code || 'sem-codigo'}). Verifique se o banco de dados está online.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Immersive Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-esteadeb-blue/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-esteadeb-yellow/5 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="bg-[#0f1115] rounded-[2rem] md:rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden border border-white/5">
          <div className="bg-[#002147] p-8 md:p-12 text-center relative overflow-hidden border-b border-white/5">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-4 mb-6"
            >
              {systemConfig?.logoUrl ? (
                 <img src={systemConfig.logoUrl} alt="ESTEADEB Logo" className="h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
              ) : (
                <>
                  <GraduationCap size={44} className="text-white" strokeWidth={1.5} />
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-white uppercase tracking-tighter">ESTEADEB</span>
                    <div className="bg-white text-[#002147] w-9 h-9 rounded flex items-center justify-center font-black text-2xl shadow-xl">E</div>
                  </div>
                </>
              )}
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.4 }}
              className="text-white font-black uppercase text-sm tracking-[0.4em] mt-4"
            >
              Portal do Aluno
            </motion.h2>
          </div>

          <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8 bg-black/20 backdrop-blur-sm">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Usuário, Matrícula ou CPF</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-esteadeb-blue transition-colors">
                  <User size={20} />
                </div>
                <input 
                  type="text"
                  required
                  placeholder="Digite sua identificação..."
                  className="w-full h-16 pl-14 pr-6 bg-white/[0.03] border border-white/10 rounded-2xl focus:border-esteadeb-blue/50 focus:bg-white/[0.05] outline-none transition-all font-bold text-white placeholder:text-white/10 text-lg"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 flex justify-between">
                <span>Senha Digital</span>
                <span className="text-white/20">Sua Matrícula</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-esteadeb-blue transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-16 pl-14 pr-16 bg-white/[0.03] border border-white/10 rounded-2xl focus:border-esteadeb-blue/50 focus:bg-white/[0.05] outline-none transition-all font-bold text-white placeholder:text-white/10 text-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-5 flex items-center text-white/20 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
              <div className="flex justify-between items-center px-2">
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest italic flex items-center gap-2">
                  <span className="w-1 h-1 bg-esteadeb-blue rounded-full" />
                  Padrão: 4 últimos dígitos do CPF
                </p>
                <a href="#" className="text-[10px] text-esteadeb-blue font-black uppercase tracking-widest hover:text-esteadeb-yellow transition-colors">Esqueceu a senha?</a>
              </div>
            </div>

            <div className="pt-4 space-y-6">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-rose-400 text-xs font-black text-center bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 uppercase tracking-tight"
                >
                  {error}
                </motion.div>
              )}
              <button 
                type="submit"
                disabled={isLoading}
                onClick={() => console.log("Submit button raw click detected")}
                className="w-full h-18 bg-esteadeb-blue hover:bg-esteadeb-blue/90 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                {isLoading ? (
                  <Loader2 className="animate-spin w-6 h-6" />
                ) : (
                  <>
                    <span className="text-sm">Autenticar Acesso</span>
                    <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>

            <div className="pt-6 text-center">
              <p className="text-[10px] text-white/10 font-bold uppercase tracking-[0.5em]">
                Secure Cloud Infrastructure • SIGA v3
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
