import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowRight, ShieldCheck, User, BookOpen, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-esteadeb-blue overflow-x-hidden relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-esteadeb-blue/10 rounded-full blur-[160px] animate-[pulse-glow_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-esteadeb-yellow/5 rounded-full blur-[160px] animate-[pulse-glow_10s_ease-in-out_infinite_reverse]" />
        
        {/* Subtle Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        
        {/* Grain Texture */}
        <div className="absolute inset-0 bg-grain" />
      </div>

      <header className="relative z-50 max-w-7xl mx-auto px-6 h-24 flex items-center justify-between backdrop-blur-md bg-black/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-esteadeb-blue/10 rounded-xl border border-esteadeb-blue/20 shadow-md">
            <GraduationCap className="text-esteadeb-blue w-8 h-8" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tighter uppercase italic leading-none">ESTEADEB</span>
            <span className="text-[8px] font-bold text-esteadeb-yellow uppercase tracking-[0.2em] mt-1 hidden xs:block">Theological Excellence</span>
          </div>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="text-white/60 hover:text-white uppercase text-[10px] font-black tracking-widest hidden sm:flex"
            onClick={() => navigate('/aluno/login')}
          >
            Portal do Aluno
          </Button>
          <Button 
            className="bg-esteadeb-blue hover:bg-esteadeb-blue/90 h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-esteadeb-blue/20 transition-all hover:scale-105 active:scale-95 border border-esteadeb-blue/30"
            onClick={() => navigate('/admin/login')}
          >
            Acesso Restrito
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center px-4 py-2 bg-esteadeb-yellow/10 text-esteadeb-yellow rounded-full text-[10px] font-black tracking-widest uppercase border border-esteadeb-yellow/20 mb-8 backdrop-blur-md shadow-lg shadow-esteadeb-yellow/5">
              <span className="w-2 h-2 bg-esteadeb-yellow rounded-full mr-3 animate-pulse shadow-sm" />
              SIGA • Sistema de Gestão Acadêmica v3.0
            </div>
            <h1 className="text-7xl md:text-[8rem] font-black tracking-tighter leading-[0.85] uppercase italic mb-8 select-none">
              Formação <br /> 
              <span className="text-esteadeb-blue text-glow inline-block hover:scale-[1.02] transition-transform duration-500 cursor-default">
                Teológica
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/50 font-medium leading-relaxed max-w-2xl mb-12">
              Capacitando líderes e obreiros com <span className="text-white/90">doutrina bíblica sólida</span> e ferramentas de gestão de alta performance. A referência nacional em ensino pentecostal.
            </p>

            <div className="flex flex-col sm:flex-row gap-6">
              <button 
                onClick={() => navigate('/aluno/login')}
                className="h-24 px-12 bg-white text-black rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-between gap-10 group hover:bg-esteadeb-yellow/[0.05] transition-all shadow-2xl active:scale-95 border border-transparent hover:border-esteadeb-yellow/20"
              >
                Sou Aluno
                <div className="w-10 h-10 bg-[#020617] rounded-full flex items-center justify-center text-white group-hover:bg-esteadeb-blue transition-all group-hover:translate-x-2">
                  <ArrowRight size={20} />
                </div>
              </button>
              
              <button 
                onClick={() => navigate('/admin/login')}
                className="h-24 px-12 bg-white/5 border border-white/10 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-between gap-10 group hover:bg-white/10 hover:border-esteadeb-blue/50 backdrop-blur-xl transition-all shadow-2xl active:scale-95"
              >
                Sou Colaborador
                <div className="p-3 bg-esteadeb-blue/20 rounded-2xl text-esteadeb-blue group-hover:scale-110 group-hover:shadow-lg transition-all">
                  <ShieldCheck size={24} />
                </div>
              </button>
            </div>
          </motion.div>
        </div>

        <div className="mt-40 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { 
              icon: BookOpen, 
              title: "Ensino Ministerial", 
              desc: "Cursos Básico, Médio e Bacharelado em Teologia, focados no crescimento espiritual e conhecimento acadêmico." 
            },
            { 
              icon: ScrollText, 
              title: "Gestão Integrada", 
              desc: "Controle total de registros, avaliações e documentação acadêmica com segurança institucional máxima." 
            },
            { 
              icon: User, 
              title: "Polo do Aluno", 
              desc: "Acesso direto a conteúdos, histórico escolar e suporte administrativo em um ecossistema 100% digital." 
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="p-12 bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] border border-white/5 shadow-2xl group hover:bg-white/[0.05] hover:border-esteadeb-blue/20 transition-all duration-500 relative overflow-hidden"
            >
              {/* Card Accent Glow */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-esteadeb-blue/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="w-20 h-20 bg-esteadeb-blue/10 rounded-[1.5rem] flex items-center justify-center text-esteadeb-blue mb-10 border border-esteadeb-blue/10 group-hover:scale-110 transition-transform duration-500">
                <feature.icon size={36} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4 group-hover:text-esteadeb-yellow transition-colors">{feature.title}</h3>
              <p className="text-white/40 text-base font-medium leading-relaxed group-hover:text-white/60 transition-colors uppercase italic text-[11px] tracking-wide">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-24 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
              <GraduationCap className="text-esteadeb-blue w-8 h-8" />
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">ESTEADEB</h2>
            </div>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.4em] max-w-sm">Escola Teológica da Assembléia de Deus no Brasil</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-12 text-center md:text-right">
            <div className="flex gap-10">
              <span className="text-[10px] text-white/40 font-black uppercase tracking-widest hover:text-esteadeb-yellow transition-colors cursor-default underline decoration-esteadeb-yellow/30 underline-offset-8">Políticas</span>
              <span className="text-[10px] text-white/40 font-black uppercase tracking-widest hover:text-esteadeb-yellow transition-colors cursor-default underline decoration-esteadeb-yellow/30 underline-offset-8">Contato</span>
            </div>
            <div className="flex flex-col md:items-end">
              <span className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">© 2026 ESTEADEB SIGA</span>
              <span className="text-[10px] text-esteadeb-blue font-black uppercase tracking-[0.2em] mt-2 bg-esteadeb-blue/10 px-3 py-1 rounded-full border border-esteadeb-blue/20">Black Edition Institutional</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
