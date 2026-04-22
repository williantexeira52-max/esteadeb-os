import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  where
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  MessageSquare, 
  X, 
  Paperclip, 
  Send,
  ExternalLink,
  User,
  Calendar,
  Filter,
  Loader2,
  UploadCloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface StudentRequest {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  description: string;
  status: 'Pendente' | 'Respondido';
  createdAt: any;
  response?: string;
  responseAt?: any;
  attachments?: string[];
}

export const Requests: React.FC = () => {
  const { user, nucleo } = useAuth();
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<StudentRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const addToast = (title: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!user || !nucleo) return;
    const q = query(
      collection(db, 'requests'), 
      where('nucleoId', '==', nucleo),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentRequest[];
      setRequests(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    return () => unsubscribe();
  }, [nucleo, user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const urls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `requests/${selectedRequest?.id}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        urls.push(url);
      }
      setUploadedFiles(prev => [...prev, ...urls]);
      addToast('Arquivos enviados com sucesso!', 'success');
    } catch (error) {
      console.error("Upload error:", error);
      addToast('Erro ao enviar arquivos.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendResponse = async () => {
    if (!selectedRequest || !responseMessage.trim()) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'requests', selectedRequest.id), {
        response: responseMessage,
        responseAt: serverTimestamp(),
        status: 'Respondido',
        responseAttachments: uploadedFiles
      });
      addToast('Resposta enviada com sucesso!', 'success');
      setSelectedRequest(null);
      setResponseMessage('');
      setUploadedFiles([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'requests');
      addToast('Erro ao enviar resposta.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRequests = requests.filter(r => 
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen relative">
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

      {/* Response Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-navy p-8 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-petrol rounded-2xl">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Atendimento ao Aluno</h2>
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">Protocolo: {selectedRequest.id.slice(0, 8)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={28} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Request Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Assunto do Requerimento</label>
                    <p className="text-lg font-black text-navy uppercase tracking-tight">{selectedRequest.subject}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Descrição do Aluno</label>
                    <p className="text-slate-600 font-medium leading-relaxed">{selectedRequest.description}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="w-12 h-12 bg-navy text-white rounded-xl flex items-center justify-center font-black">
                      {selectedRequest.studentName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Solicitante</p>
                      <p className="font-bold text-navy">{selectedRequest.studentName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Data da Solicitação</p>
                      <p className="font-bold text-navy">
                        {selectedRequest.createdAt?.toDate().toLocaleDateString('pt-BR')} às {selectedRequest.createdAt?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Anexos do Aluno</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedRequest.attachments.map((url, i) => (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
                          >
                            <Paperclip size={14} /> Anexo {i + 1} <ExternalLink size={12} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Response Section */}
              <div className="pt-8 border-t border-slate-100 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sua Resposta / Feedback</label>
                  <textarea 
                    className="w-full h-40 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-petrol outline-none transition-all font-medium text-slate-700 resize-none"
                    placeholder="Escreva aqui a resposta oficial para o aluno..."
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Anexar Documentos de Resposta</label>
                    {isUploading && <div className="flex items-center gap-2 text-petrol text-xs font-bold animate-pulse"><Loader2 size={14} className="animate-spin" /> Enviando arquivos...</div>}
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-200 rounded-[2rem] hover:border-petrol hover:bg-petrol/5 transition-all cursor-pointer group">
                      <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-petrol">
                        <UploadCloud size={32} />
                        <span className="text-xs font-bold uppercase tracking-widest">Clique para anexar arquivos</span>
                      </div>
                      <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles.map((url, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-100">
                          <Paperclip size={14} /> Arquivo {i + 1}
                          <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
              <Button 
                variant="outline" 
                className="flex-1 h-14 rounded-2xl font-bold text-slate-500" 
                onClick={() => setSelectedRequest(null)}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 h-14 bg-petrol hover:bg-petrol-dark text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-petrol/20 flex items-center justify-center gap-3"
                onClick={handleSendResponse}
                disabled={isSaving || !responseMessage.trim()}
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                Enviar Resposta Oficial
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-navy tracking-tighter uppercase">Atendimento e Requerimentos</h1>
          <p className="text-slate-500 font-medium mt-1">Gestão centralizada de solicitações e protocolos de alunos.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendentes</p>
              <p className="text-xl font-black text-amber-500">{requests.filter(r => r.status === 'Pendente').length}</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
              <Clock size={24} />
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolvidos</p>
              <p className="text-xl font-black text-emerald-500">{requests.filter(r => r.status === 'Respondido').length}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Buscar por aluno ou assunto..." 
            className="pl-12 h-14 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-petrol font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-14 w-14 rounded-2xl border-slate-100 text-slate-400">
          <Filter size={20} />
        </Button>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Aluno / Protocolo</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Assunto</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Data</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-center">Status</TableHead>
              <TableHead className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <td colSpan={5} className="p-20 text-center">
                  <div className="flex flex-col items-center gap-4 text-slate-300">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                      <FileText size={40} className="opacity-20" />
                    </div>
                    <p className="font-bold uppercase tracking-widest text-xs">Nenhum requerimento encontrado.</p>
                  </div>
                </td>
              </TableRow>
            ) : (
              filteredRequests.map((req) => (
                <TableRow key={req.id} className="hover:bg-slate-50/50 transition-all group cursor-pointer" onClick={() => setSelectedRequest(req)}>
                  <td className="p-6">
                    <p className="font-black text-slate-900 uppercase text-sm tracking-tight">{req.studentName}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {req.id.slice(0, 8)}</p>
                  </td>
                  <td className="p-6">
                    <p className="font-bold text-navy uppercase text-xs tracking-wide">{req.subject}</p>
                  </td>
                  <td className="p-6">
                    <p className="text-xs font-bold text-slate-600">
                      {req.createdAt?.toDate().toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {req.createdAt?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="p-6 text-center">
                    <Badge className={cn(
                      "font-black text-[10px] uppercase px-4 py-1.5 rounded-full border-none",
                      req.status === 'Respondido' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {req.status}
                    </Badge>
                  </td>
                  <td className="p-6 text-right">
                    <Button 
                      variant="ghost" 
                      className="p-3 text-petrol hover:bg-petrol/10 rounded-2xl transition-all"
                    >
                      <MessageSquare size={20} />
                    </Button>
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
