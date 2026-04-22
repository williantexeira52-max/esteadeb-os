import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Image as ImageIcon, 
  Signature, 
  Save, 
  Globe, 
  MapPin, 
  Phone, 
  Mail,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '@/lib/utils';

export const Settings: React.FC = () => {
  const { profile, nucleo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    type: 'danger' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    action: async () => {},
    type: 'info'
  });
  const [config, setConfig] = useState({
    schoolName: 'ESTEADEB - Escola de Teologia das Assembleias de Deus',
    cnpj: '00.000.000/0001-00',
    address: 'Rua das Oliveiras, 123 - São Paulo/SP',
    phone: '(11) 99999-9999',
    email: 'contato@esteadeb.edu.br',
    website: 'www.esteadeb.edu.br',
    directorName: 'Sérgio Lins Pessoa',
    pedagogicalName: 'Arlete Duarte de Almeida Costa',
    secretaryName: 'Secretaria Acadêmica',
    legalText: 'Autorizado pela Portaria Ministerial nº 1.234 de 12/04/2026. Reconhecido pelo Conselho Federal de Teologia.',
    logoUrl: '',
    directorSignatureUrl: '',
    pedagogicalSignatureUrl: '',
    secretarySignatureUrl: '',
    sealUrl: '',
    templates: {
      contract: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS\n\nEu, {{NOME}}, portador do CPF {{CPF}}, matriculado sob o número {{MATRICULA}}, firmo este contrato...',
      enrollment_request: 'REQUERIMENTO DE MATRÍCULA\n\nSolicito a matrícula do aluno {{NOME}} na turma {{TURMA}}...',
      enrollment_form: 'FICHA DE MATRÍCULA\n\nNome: {{NOME}}\nMatrícula: {{MATRICULA}}\nTurma: {{TURMA}}'
    },
    polos: ['MATRIZ', 'POLO NATAL', 'POLO MOSSORÓ'],
    modalidades: ['PRESENCIAL', 'EAD', 'SEMIPRESENCIAL']
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'system_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        console.error("Error fetching config:", error);
      }
    };
    fetchConfig();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'system_config'), {
        ...config,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.uid || profile?.id || 'system'
      });
      showToast("Configurações salvas com sucesso!", 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings');
      showToast("Erro ao salvar configurações.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    setConfirmModal({
      show: true,
      title: 'Resetar Banco de Dados',
      message: 'ATENÇÃO: Esta ação irá apagar PERMANENTEMENTE todos os alunos, parcelas financeiras, transações e logs deste núcleo. Esta ação não pode ser desfeita. Deseja continuar?',
      type: 'danger',
      action: async () => {
        setResetLoading(true);
        try {
          const collectionsToClear = [
            'students', 
            'financial_installments', 
            'transactions', 
            'auditLogs', 
            'requests', 
            'schedules', 
            'occurrences',
            'classes',
            'courses',
            'grades',
            'modules_history',
            'school_announcements',
            'inventory',
            'school_events',
            'school_cash',
            'snack_cash',
            'school_reconciliations',
            'snack_reconciliations',
            'financial_sales',
            'financial_extras',
            'parcels',
            'academic_records',
            'financial_plans',
            'financial_discounts'
          ];
          
          for (const collName of collectionsToClear) {
            // Purge all documents in the collection to start from absolute zero
            const snap = await getDocs(collection(db, collName));
            
            // Delete in chunks of 500 to respect Firestore limits
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 500) {
              const batch = writeBatch(db);
              const chunk = docs.slice(i, i + 500);
              chunk.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
          }

          setConfirmModal(prev => ({ ...prev, show: false }));
          showToast("Sistema resetado com sucesso! Iniciando do zero.", 'success');
        } catch (error) {
          console.error("Error resetting database:", error);
          showToast("Erro ao limpar base de dados.", 'error');
        } finally {
          setResetLoading(false);
        }
      }
    });
  };

  const handleClearTrash = async () => {
    setConfirmModal({
      show: true,
      title: 'Esvaziar Lixeira',
      message: 'Deseja apagar permanentemente todos os itens que estão na lixeira?',
      type: 'danger',
      action: async () => {
        setResetLoading(true);
        try {
          const collectionsWithTrash = ['students', 'school_employees', 'school_units', 'classes', 'courses'];
          
          for (const collName of collectionsWithTrash) {
            const q = query(collection(db, collName), where('deleted', '==', true), where('nucleoId', '==', nucleo));
            const snap = await getDocs(q);
            
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 500) {
              const batch = writeBatch(db);
              const chunk = docs.slice(i, i + 500);
              chunk.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
          }

          setConfirmModal(prev => ({ ...prev, show: false }));
          showToast("Lixeira esvaziada com sucesso!", 'success');
        } catch (error) {
          console.error("Error clearing trash:", error);
          showToast("Erro ao esvaziar lixeira.", 'error');
        } finally {
          setResetLoading(false);
        }
      }
    });
  };

  const handleFileUpload = (field: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const content = readerEvent.target?.result as string;
          setConfig(prev => ({ ...prev, [field]: content }));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy tracking-tight">Configurações do Sistema</h1>
          <p className="text-gray-500">Gestão institucional e manutenção da base de dados.</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-petrol hover:bg-petrol-dark gap-2 px-8 py-6 text-lg font-bold shadow-lg"
        >
          <Save size={20} /> {loading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Dados Legais */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Building2 className="text-petrol" /> Identificação & Dados Legais
            </CardTitle>
            <CardDescription>Informações que aparecerão em cabeçalhos e rodapés oficiais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Nome da Instituição</label>
              <Input 
                value={config.schoolName} 
                onChange={(e) => setConfig({...config, schoolName: e.target.value})}
                className="font-bold text-navy"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">CNPJ</label>
                <Input value={config.cnpj} onChange={(e) => setConfig({...config, cnpj: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Site</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <Input className="pl-10" value={config.website} onChange={(e) => setConfig({...config, website: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Endereço Completo</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input className="pl-10" value={config.address} onChange={(e) => setConfig({...config, address: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <Input className="pl-10" value={config.phone} onChange={(e) => setConfig({...config, phone: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <Input className="pl-10" value={config.email} onChange={(e) => setConfig({...config, email: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                <ShieldCheck size={14} className="text-petrol" /> Portarias & Atos Regulamentares
              </label>
              <textarea 
                className="w-full min-h-[100px] p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-petrol outline-none"
                value={config.legalText}
                onChange={(e) => setConfig({...config, legalText: e.target.value})}
                placeholder="Insira os números das portarias e decretos..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Polos & Modalidades */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <MapPin className="text-petrol" /> Polos & Modalidades
            </CardTitle>
            <CardDescription>Defina os locais de atendimento e formas de ensino.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-400 uppercase">Polos Ativos</label>
              <div className="flex flex-wrap gap-2">
                {config.polos?.map((polo, idx) => (
                  <Badge key={idx} className="bg-navy text-white px-3 py-1 flex items-center gap-2">
                    {polo}
                    <X size={12} className="cursor-pointer" onClick={() => setConfig({...config, polos: config.polos.filter((_, i) => i !== idx)})} />
                  </Badge>
                ))}
                <Button 
                  variant="outline" size="sm" className="h-7 border-dashed"
                  onClick={() => {
                    const name = prompt('Nome do Polo:');
                    if (name) setConfig({...config, polos: [...(config.polos || []), name.toUpperCase()]});
                  }}
                >
                  + Adicionar
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-400 uppercase">Modalidades de Ensino</label>
              <div className="flex flex-wrap gap-2">
                {config.modalidades?.map((mod, idx) => (
                  <Badge key={idx} className="bg-petrol text-white px-3 py-1 flex items-center gap-2">
                    {mod}
                    <X size={12} className="cursor-pointer" onClick={() => setConfig({...config, modalidades: config.modalidades.filter((_, i) => i !== idx)})} />
                  </Badge>
                ))}
                <Button 
                  variant="outline" size="sm" className="h-7 border-dashed"
                  onClick={() => {
                    const name = prompt('Nome da Modalidade:');
                    if (name) setConfig({...config, modalidades: [...(config.modalidades || []), name.toUpperCase()]});
                  }}
                >
                  + Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identidade Visual & Assinaturas */}
        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy flex items-center gap-2">
                <Globe className="text-petrol" /> Links de Acesso
              </CardTitle>
              <CardDescription>Links rápidos para compartilhar com alunos e funcionários.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Portal do Aluno</label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/aluno`}
                    className="bg-slate-50 font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    className="border-petrol text-petrol hover:bg-petrol/5 font-bold"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/aluno`);
                      showToast("Link copiado!", 'success');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Portal Administrativo</label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/admin`}
                    className="bg-slate-50 font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    className="border-petrol text-petrol hover:bg-petrol/5 font-bold"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/admin`);
                      showToast("Link copiado!", 'success');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy flex items-center gap-2">
                <FileText className="text-petrol" /> Modelos de Documentos
              </CardTitle>
              <CardDescription>Edite os textos base para geração de documentos. Use variáveis como {"{{NOME}}"}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Contrato de Prestação de Serviços</label>
                <textarea 
                  className="w-full min-h-[150px] p-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-petrol outline-none"
                  value={config.templates?.contract}
                  onChange={(e) => setConfig({...config, templates: { ...config.templates, contract: e.target.value }})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Requerimento de Matrícula</label>
                <textarea 
                  className="w-full min-h-[100px] p-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-petrol outline-none"
                  value={config.templates?.enrollment_request}
                  onChange={(e) => setConfig({...config, templates: { ...config.templates, enrollment_request: e.target.value }})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Ficha de Matrícula</label>
                <textarea 
                  className="w-full min-h-[100px] p-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-petrol outline-none"
                  value={config.templates?.enrollment_form}
                  onChange={(e) => setConfig({...config, templates: { ...config.templates, enrollment_form: e.target.value }})}
                />
              </div>
              <div className="p-4 bg-navy/5 rounded-xl">
                <p className="text-[10px] font-black text-navy uppercase tracking-widest mb-2">Variáveis Disponíveis</p>
                <div className="flex flex-wrap gap-2">
                  {['{{NOME}}', '{{MATRICULA}}', '{{TURMA}}', '{{CPF}}', '{{RG}}', '{{DATA_MATRICULA}}'].map(v => (
                    <Badge key={v} variant="outline" className="bg-white text-navy border-navy/20">{v}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy flex items-center gap-2">
                <ImageIcon className="text-petrol" /> Identidade e Direção
              </CardTitle>
              <CardDescription>Personalização da marca e responsáveis institucionais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Identidade Visual (Logo)</label>
                <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-32 h-32 bg-white border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner">
                    {config.logoUrl ? (
                      <img src={config.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="text-gray-300" size={40} />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-sm text-gray-500 font-medium">Upload da logo master em alta resolução (PNG/JPG).</p>
                    <Button 
                      variant="outline" 
                      className="w-full border-navy text-navy font-bold"
                      onClick={() => handleFileUpload('logoUrl')}
                    >
                      Alterar Logo
                    </Button>
                  </div>
                </div>
              </div>

            <div className="grid grid-cols-1 gap-4 pt-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Nome do Diretor Geral</label>
                <Input value={config.directorName} onChange={(e) => setConfig({...config, directorName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Nome da Coord. Pedagógica</label>
                <Input value={config.pedagogicalName} onChange={(e) => setConfig({...config, pedagogicalName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Nome da Secretaria</label>
                <Input value={config.secretaryName} onChange={(e) => setConfig({...config, secretaryName: e.target.value})} />
              </div>
            </div>
          </CardContent>
        </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy flex items-center gap-2">
                <Signature className="text-petrol" /> Assinaturas Digitais
              </CardTitle>
              <CardDescription>Assinaturas que serão aplicadas em contratos e requerimentos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: 'Assinatura Diretor', field: 'directorSignatureUrl' },
                { label: 'Assinatura Coordenador Pedagógico', field: 'pedagogicalSignatureUrl' },
                { label: 'Assinatura Secretário', field: 'secretarySignatureUrl' }
              ].map((sig) => (
                <div key={sig.field} className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-24 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {(config as any)[sig.field] ? (
                      <img src={(config as any)[sig.field]} alt={sig.label} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Signature className="text-slate-200" size={24} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-navy uppercase tracking-widest mb-2">{sig.label}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full border-petrol text-petrol hover:bg-petrol/5 font-bold"
                      onClick={() => handleFileUpload(sig.field)}
                    >
                      Alterar Assinatura
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm border-red-100 bg-red-50/30">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="text-red-600" /> Zona de Perigo
              </CardTitle>
              <CardDescription>Ações irreversíveis de manutenção do banco de dados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-red-100">
                <div>
                  <p className="text-sm font-bold text-navy">Limpar Lixeira</p>
                  <p className="text-xs text-gray-500">Apagar permanentemente alunos excluídos.</p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleClearTrash}
                  disabled={resetLoading}
                  className="gap-2"
                >
                  <Trash2 size={14} /> Esvaziar
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-red-100">
                <div>
                  <p className="text-sm font-bold text-navy">Resetar Banco de Dados</p>
                  <p className="text-xs text-gray-500">Apagar TODOS os alunos e parcelas deste núcleo.</p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleResetDatabase}
                  disabled={resetLoading}
                  className="gap-2"
                >
                  <RefreshCw size={14} className={resetLoading ? "animate-spin" : ""} /> Resetar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-4">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
                confirmModal.type === 'danger' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
              )}>
                {confirmModal.type === 'danger' ? <AlertTriangle size={32} /> : <RefreshCw size={32} />}
              </div>
              <div>
                <h3 className="text-xl font-black text-navy uppercase tracking-tight">{confirmModal.title}</h3>
                <p className="text-gray-500 text-sm mt-2">{confirmModal.message}</p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 py-6 rounded-xl font-bold"
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  disabled={resetLoading}
                >
                  Cancelar
                </Button>
                <Button 
                  className={cn(
                    "flex-1 py-6 rounded-xl font-black uppercase tracking-widest shadow-lg",
                    confirmModal.type === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-petrol hover:bg-petrol-dark shadow-petrol/20"
                  )}
                  onClick={confirmModal.action}
                  disabled={resetLoading}
                >
                  {resetLoading ? <RefreshCw className="animate-spin" size={18} /> : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-bold text-sm uppercase tracking-wider">{toast.message}</p>
        </div>
      )}
    </div>
  );
};
