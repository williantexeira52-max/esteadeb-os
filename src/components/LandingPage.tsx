import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowRight, ShieldCheck, User, BookOpen, ScrollText, MapPin, Monitor, Users, Shield } from 'lucide-react';
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
            <span className="text-xl md:text-2xl font-black tracking-tighter uppercase italic leading-none">ESTEADEB</span>
            <span className="text-[8px] font-bold text-esteadeb-yellow uppercase tracking-[0.2em] mt-1 hidden xs:block">Excelência Teológica</span>
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
            className="bg-esteadeb-blue hover:bg-esteadeb-blue/90 h-11 px-6 md:px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-esteadeb-blue/20 transition-all hover:scale-105 active:scale-95 border border-esteadeb-blue/30"
            onClick={() => navigate('/admin/login')}
          >
            <span className="hidden sm:inline">Acesso Restrito</span>
            <span className="sm:hidden">Entrar</span>
          </Button>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-32">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center px-4 py-2 bg-esteadeb-yellow/10 text-esteadeb-yellow rounded-full text-[10px] font-black tracking-widest uppercase border border-esteadeb-yellow/20 mb-8 backdrop-blur-md shadow-lg shadow-esteadeb-yellow/5">
                <span className="w-2 h-2 bg-esteadeb-yellow rounded-full mr-3 animate-pulse shadow-sm" />
                SISTEMA INTEGRADO DE GESTÃO INSTITUCIONAL
              </div>
              <h1 className="text-6xl sm:text-7xl md:text-[8rem] font-black tracking-tighter leading-[0.85] uppercase italic mb-8 select-none">
                Escola <br /> 
                <span className="text-esteadeb-blue text-glow inline-block hover:scale-[1.02] transition-transform duration-500 cursor-default">
                  Teológica
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-white/50 font-medium leading-relaxed max-w-2xl mb-12">
                Capacitando líderes e obreiros com <strong className="text-white">doutrina bíblica sólida</strong> em todo o Brasil. <br className="hidden sm:block" /> Experiência completa do campus até você.
              </p>

              <div className="flex flex-col sm:flex-row gap-6">
                <button 
                  onClick={() => navigate('/aluno/login')}
                  className="h-20 sm:h-24 px-8 sm:px-12 bg-white text-black rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-between gap-6 sm:gap-10 group hover:bg-esteadeb-yellow/[0.05] hover:text-white transition-all shadow-2xl active:scale-95 border border-transparent hover:border-esteadeb-yellow/20"
                >
                  <span className="text-sm sm:text-base">Sou Aluno</span>
                  <div className="w-10 h-10 bg-[#020617] rounded-full flex items-center justify-center text-white group-hover:bg-esteadeb-blue transition-all group-hover:translate-x-2">
                    <ArrowRight size={20} />
                  </div>
                </button>
                
                <button 
                  onClick={() => navigate('/admin/login')}
                  className="h-20 sm:h-24 px-8 sm:px-12 bg-white/5 border border-white/10 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center justify-between gap-6 sm:gap-10 group hover:bg-white/10 hover:border-esteadeb-blue/50 backdrop-blur-xl transition-all shadow-2xl active:scale-95"
                >
                  <span className="text-sm sm:text-base">Sou Equipe</span>
                  <div className="p-3 bg-esteadeb-blue/20 rounded-2xl text-esteadeb-blue group-hover:scale-110 group-hover:shadow-lg transition-all">
                    <ShieldCheck size={24} />
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Why choose us / Modalities */}
        <section className="border-t border-white/5 bg-black/40 backdrop-blur-md py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-20 text-center md:text-left">
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic mb-6">Por que escolher a gente?</h2>
              <p className="text-xl text-white/50 font-medium max-w-2xl"><strong className="text-esteadeb-yellow selection:bg-white selection:text-black">"Quer saber como defender a sua fé das ideologias perniciosas?"</strong> — Aprenda teologia de forma profunda, seja você de nível Médio ou Bacharelado, presencial ou EAD.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  icon: Users, 
                  title: "Presencial Regular", 
                  badge: "Campus",
                  desc: "Experiência completa do campus com alunos e professores durante toda a trajetória da graduação, proporcionando forte networking e comunhão." 
                },
                { 
                  icon: BookOpen, 
                  title: "Semipresencial", 
                  badge: "Flexível",
                  desc: "Para quem quer flexibilidade de horário, mas não abre mão da experiência presencial do campus e do contato periódico com a nossa equipe." 
                },
                { 
                  icon: Monitor, 
                  title: "Ensino Digital (EAD)", 
                  badge: "Online",
                  desc: "A flexibilidade do ensino digital, com atividades práticas presenciais e/ou em laboratórios virtuais. Estude de qualquer lugar do Brasil." 
                }
              ].map((mod, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="p-10 bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] border border-white/5 shadow-2xl group hover:bg-white/[0.05] hover:border-esteadeb-blue/20 transition-all duration-500"
                >
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-16 h-16 bg-esteadeb-blue/10 rounded-2xl flex items-center justify-center text-esteadeb-blue border border-esteadeb-blue/10 group-hover:scale-110 transition-transform duration-500">
                      <mod.icon size={32} />
                    </div>
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-white/40 tracking-widest">{mod.badge}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4 group-hover:text-esteadeb-yellow transition-colors">{mod.title}</h3>
                  <p className="text-white/40 text-sm font-medium leading-relaxed group-hover:text-white/60 transition-colors uppercase italic tracking-wide">{mod.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Cursos / Níveis Section */}
        <section className="py-24 bg-esteadeb-blue/5 overflow-hidden border-t border-white/5 relative flex flex-col items-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-0 pointer-events-none" />
          
          <div className="text-center relative z-10 mb-16 px-6">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic mb-4">Níveis de Formação</h2>
            <p className="text-white/50 text-lg font-medium max-w-xl mx-auto">
              Estruturas curriculares robustas alinhadas com as exigências do ministério contemporâneo.
            </p>
          </div>

          <div className="w-full flex justify-center pb-12 px-6 relative z-10 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {[
                {
                  title: 'Médio em Teologia',
                  hours: '1.080h',
                  desc: 'Aprofundamento teológico e histórico. Preparação sólida para o ensino e atuação nas lideranças das igrejas.'
                },
                {
                  title: 'Bacharelado Livre',
                  hours: '1.980h',
                  desc: 'Nossa formação máxima. Análise crítica estrutural, linguística e sistemática para a excelência pastoral e acadêmica.'
                }
              ].map((course, idx) => (
                <div key={idx} className="p-8 bg-black/60 backdrop-blur-md rounded-[2.5rem] border border-white/5 hover:border-esteadeb-yellow/30 transition-all group w-full">
                  <div className="text-esteadeb-yellow text-[10px] font-black tracking-widest uppercase mb-4 px-3 py-1 bg-esteadeb-yellow/10 rounded-full inline-block">
                    {course.hours}
                  </div>
                  <h3 className="text-2xl font-black tracking-tighter uppercase italic mb-4 group-hover:text-esteadeb-blue transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-white/40 text-sm font-medium leading-relaxed group-hover:text-white/70 transition-colors">
                    {course.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Polos/Locals + Stats */}
        <section className="py-32 relative">
          <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row gap-20 items-center">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center px-4 py-2 bg-white/5 text-esteadeb-blue rounded-full text-[10px] font-black tracking-widest uppercase border border-esteadeb-blue/20 mb-8">
                <MapPin size={14} className="mr-2" />
                Estrutura & Polos
              </div>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic mb-6 leading-tight">
                Estamos presentes em <span className="text-esteadeb-blue">5 unidades</span> no RN e alunos pelo Brasil
              </h2>
              <p className="text-white/50 text-lg mb-10 italic border-l-2 border-esteadeb-yellow/50 pl-4 py-2 font-medium">"Feliz aquele que transfere o que sabe e aprende o que ensina." <br/> — Nossos Professores</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: "Sede - Lagoa Seca", addr: "Rua Dr. Celso Ramalho, 70" },
                  { name: "Templo Central", addr: "R. Dr. Manoel Miranda, 251 - Alecrim" },
                  { name: "Zona Norte", addr: "R. Angra dos Réis, 284 - Potengi" },
                  { name: "Extremoz", addr: "R. Alm. Ernesto de Melo Júnior, 89" },
                  { name: "Parque dos Eucaliptos", addr: "R. Abel Cabral, 05 - N. Parnamirim" },
                  { name: "EAD Nacional", addr: "Plataforma 100% Digital" }
                ].map((polo, i) => (
                  <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-esteadeb-blue/30 transition-colors">
                    <h4 className="text-white font-black uppercase text-sm tracking-tight mb-1">{polo.name}</h4>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">{polo.addr}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="lg:w-1/2 relative">
              <div className="aspect-square rounded-full border border-dashed border-white/10 animate-[spin_60s_linear_infinite] absolute inset-0 -m-10" />
              <div className="aspect-square rounded-full border border-dashed border-esteadeb-blue/20 animate-[spin_40s_linear_infinite_reverse] absolute inset-10 -m-10" />
              
              <div className="bg-black/80 backdrop-blur-2xl border border-white/10 p-12 rounded-[3rem] relative z-10 shadow-2xl">
                <Shield size={48} className="text-esteadeb-yellow mb-8" />
                <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-4">Pessoas Reais,<br/> Resultados Reais.</h3>
                <p className="text-white/50 font-medium mb-8 leading-relaxed">
                  Ingressar na ESTEADEB é fazer parte de um seleto grupo de formadores de opinião e líderes espirituais que baseiam seu conhecimento numa teologia pentecostal segura e transformadora.
                </p>
                <div className="flex gap-4 items-center pt-8 border-t border-white/10">
                  <div className="flex -space-x-4">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="w-12 h-12 rounded-full border-2 border-black bg-slate-800 flex items-center justify-center text-xs font-black text-white/50">
                        <User size={16} />
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    + Milhares de<br/><span className="text-white">Alunos Formados</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-40 relative flex items-center justify-center text-center px-6 overflow-hidden">
          <div className="absolute inset-0 bg-esteadeb-blue/5 animate-pulse pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-esteadeb-blue/10 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter italic mb-8">
              Sua Chamada <br/>
              <span className="text-esteadeb-blue text-glow">Não Pode Esperar</span>
            </h2>
            <p className="text-xl text-white/50 mb-12 font-medium max-w-2xl mx-auto">
              Junte-se à principal escola de formação teológica. Cresça na graça, no conhecimento e na excelência do serviço ao Reino de Deus.
            </p>
            <button 
              onClick={() => navigate('/aluno/login')} 
              className="bg-esteadeb-yellow text-black px-12 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-esteadeb-yellow/20 hover:shadow-esteadeb-yellow/40 hover:bg-[#ffb000]"
            >
              Comece Sua Jornada
            </button>
          </div>
        </section>

      </main>

      <footer className="relative z-10 border-t border-white/5 py-12 md:py-24 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
              <GraduationCap className="text-esteadeb-blue w-8 h-8" />
              <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter">ESTEADEB</h2>
            </div>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.4em] max-w-sm">Escola Teológica das Assembleias de Deus no Brasil</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-12 text-center md:text-right">
            <div className="flex gap-10">
              <span className="text-[10px] text-white/40 font-black uppercase tracking-widest hover:text-esteadeb-yellow transition-colors cursor-default underline decoration-esteadeb-yellow/30 underline-offset-8">Dúvidas?</span>
              <span className="text-[10px] text-white/40 font-black uppercase tracking-widest hover:text-esteadeb-yellow transition-colors cursor-default underline decoration-esteadeb-yellow/30 underline-offset-8">Contato</span>
            </div>
            <div className="flex flex-col md:items-end">
              <span className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">© 2026 ESTEADEB</span>
              <span className="text-[10px] text-esteadeb-blue font-black uppercase tracking-[0.2em] mt-2 bg-esteadeb-blue/10 px-3 py-1 rounded-full border border-esteadeb-blue/20">Institutional Hub</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

