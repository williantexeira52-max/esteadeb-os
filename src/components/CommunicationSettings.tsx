import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MessageSquare, Save, Settings as SettingsIcon, AlertCircle, CheckCircle2, Clock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';

export const CommunicationSettings: React.FC = () => {
  const { user, nucleo } = useAuth();
  const [toasts, setToasts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    whatsappApi: {
      mode: 'web', // 'web', 'api'
      apiUrl: '',
      apiToken: '',
    },
    messageTemplates: {
      late: 'Olá, [NOME_DO_ALUNO]! Notamos que sua mensalidade com vencimento em [VENCIMENTO] encontra-se em aberto. O valor é de [VALOR]. Por favor, entre em contato para regularizar.',
      dueSoon: 'Olá, [NOME_DO_ALUNO]! Gostaríamos de lembrar que o vencimento da sua mensalidade será no dia [VENCIMENTO]. O valor é de [VALOR].'
    },
    enabledCronAlerts: false, // D-5 e D+1 automáticos
  });
  const [loading, setLoading] = useState(false);

  // ... (keeping addToast)
  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!user || !nucleo) return;
    const docId = `financial_hub_${nucleo || 'default'}`;
    const unsub = onSnapshot(doc(db, 'settings', docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({
          whatsappApi: { ...prev.whatsappApi, ...data.whatsappApi },
          messageTemplates: { ...prev.messageTemplates, ...data.messageTemplates },
          enabledCronAlerts: data.enabledCronAlerts ?? prev.enabledCronAlerts
        }));
      }
    });
    return () => unsub();
  }, [nucleo, user]);

  const handleSave = async () => {
    if (!nucleo) return;
    setLoading(true);
    try {
      const docId = `financial_hub_${nucleo || 'default'}`;
      await setDoc(doc(db, 'settings', docId), {
        whatsappApi: settings.whatsappApi,
        messageTemplates: settings.messageTemplates,
        enabledCronAlerts: settings.enabledCronAlerts,
        updatedAt: serverTimestamp()
      }, { merge: true });
      addToast('Configurações salvas com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings');
      addToast('Erro ao salvar as configurações.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[300] space-y-2">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={cn(
              "flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-full duration-300",
              toast.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm">{toast.title}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Comunicação e Cobrança</h1>
          <p className="text-slate-500 font-medium mt-1">Configure disparos via WhatsApp e réguas de cobrança automáticas.</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest flex items-center gap-2 h-12 px-8">
          <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* API de WhatsApp */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-navy uppercase tracking-tight">Provedor de WhatsApp</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Conexão para Disparo em Massa</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Método de Envio</label>
              <select 
                className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                value={settings.whatsappApi?.mode || 'web'}
                onChange={(e) => setSettings({...settings, whatsappApi: {...settings.whatsappApi, mode: e.target.value}})}
              >
                <option value="web">WhatsApp Web (Padrão/Abre abas manualmente)</option>
                <option value="api">Integração Externa API (Automático em background)</option>
              </select>
            </div>

            {settings.whatsappApi?.mode !== 'web' && (
              <div className="p-6 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
                <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 mb-2">Requer credenciais ativas do provedor Ex: Evolution API</Badge>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">URL da API (Webhook/Endpoint)</label>
                  <Input 
                    placeholder="https://api.../message/sendText/SUA_INSTANCIA"
                    className="h-12 bg-white rounded-xl focus:border-indigo-500 font-mono text-sm"
                    value={settings.whatsappApi?.apiUrl || ''}
                    onChange={(e) => setSettings({...settings, whatsappApi: {...settings.whatsappApi, apiUrl: e.target.value}})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Token de Autenticação (Global ApiKey)</label>
                  <Input 
                    type="password"
                    placeholder="*****************"
                    className="h-12 bg-white rounded-xl focus:border-indigo-500 font-mono text-sm"
                    value={settings.whatsappApi?.apiToken || ''}
                    onChange={(e) => setSettings({...settings, whatsappApi: {...settings.whatsappApi, apiToken: e.target.value}})}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Régua Automática */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Clock size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-navy uppercase tracking-tight">Régua de Cobrança (CRON)</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Disparos automáticos diários (D-5 e D+1)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-6 border-2 border-slate-100 rounded-2xl flex items-start gap-4">
              <input 
                type="checkbox" 
                id="cronToggle"
                className="w-6 h-6 rounded-md accent-emerald-600 mt-1"
                checked={settings.enabledCronAlerts}
                onChange={(e) => setSettings({...settings, enabledCronAlerts: e.target.checked})}
              />
              <div>
                <label htmlFor="cronToggle" className="text-sm font-black text-navy uppercase tracking-tight block cursor-pointer">
                  Ativar Automação de WhatsApp (D-5 / D+1)
                </label>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Quando ativo e em conjunto com a API externa, o sistema fará varreduras às 08:00 para enviar alertas aos alunos que vencem em 5 dias e cobranças de matrículas atrasadas há 1 dia.
                </p>
                {settings.whatsappApi?.mode === 'web' && settings.enabledCronAlerts && (
                  <p className="text-xs text-red-500 font-bold mt-2">Atenção: A automação só funcionará ao conectar a uma API Externa de Automação.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modelos de Mensagem */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <MessageSquare size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-navy uppercase tracking-tight">Modelos de Mensagem</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Variáveis disponíveis: [NOME_DO_ALUNO], [VALOR], [VENCIMENTO], [LINK_PAGAMENTO]</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 text-emerald-600 flex items-center gap-2">
                <CheckCircle2 size={14} /> Pré-Vencimento (Aviso D-5)
              </label>
              <textarea 
                className="w-full h-32 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-orange-400 outline-none transition-all resize-none text-sm leading-relaxed text-slate-700"
                value={settings.messageTemplates?.dueSoon || ''}
                onChange={(e) => setSettings({...settings, messageTemplates: {...settings.messageTemplates, dueSoon: e.target.value}})}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 text-red-500 flex items-center gap-2">
                <AlertCircle size={14} /> Em Atraso (Cobrança D+1)
              </label>
              <textarea 
                className="w-full h-32 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-orange-400 outline-none transition-all resize-none text-sm leading-relaxed text-slate-700"
                value={settings.messageTemplates?.late || ''}
                onChange={(e) => setSettings({...settings, messageTemplates: {...settings.messageTemplates, late: e.target.value}})}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
