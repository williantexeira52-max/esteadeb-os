import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const ImportSmart: React.FC = () => {
  const { nucleo } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSimulateImport = async () => {
    setIsImporting(true);
    setStatus('idle');
    setProgress(0);

    // Simulating batch processing
    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setProgress(i * 10);
    }

    try {
      // Create a log entry for the import
      await addDoc(collection(db, 'auditLogs'), {
        action: 'IMPORTAÇÃO MASSIVA',
        details: 'Simulação de importação de 50 alunos via CSV concluída.',
        user: 'Administrador',
        timestamp: serverTimestamp(),
        nucleoId: nucleo
      });
      setStatus('success');
    } catch (error) {
      setStatus('error');
      handleFirestoreError(error, OperationType.WRITE, 'auditLogs');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-navy tracking-tight">Importação Smart (Batch)</h1>
        <p className="text-gray-500">Carga massiva de alunos, notas e matrículas via Excel/CSV.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-dashed border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="text-petrol" size={32} />
            </div>
            <h3 className="font-bold text-navy text-lg">Arraste seu arquivo CSV/XLSX</h3>
            <p className="text-gray-400 text-sm mt-1">Ou clique para selecionar no computador</p>
            <input type="file" className="hidden" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-navy text-lg flex items-center gap-2">
              <FileSpreadsheet className="text-petrol" /> Status do Processamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-navy/5 p-6 rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold text-navy uppercase tracking-widest">Progresso da Carga</span>
                <span className="text-sm font-bold text-petrol">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-petrol h-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {status === 'success' && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl text-green-700">
                <CheckCircle2 size={20} />
                <div className="text-sm">
                  <p className="font-bold">Importação Concluída!</p>
                  <p className="opacity-80">50 registros processados com sucesso no núcleo {nucleo}.</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
                <AlertCircle size={20} />
                <div className="text-sm">
                  <p className="font-bold">Erro na Importação</p>
                  <p className="opacity-80">Verifique a formatação das colunas do seu arquivo.</p>
                </div>
              </div>
            )}

            <Button 
              className="w-full bg-navy py-6 text-lg font-bold" 
              disabled={isImporting}
              onClick={handleSimulateImport}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 animate-spin" /> Processando...
                </>
              ) : (
                'Iniciar Processamento em Lote'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-navy mb-4 uppercase tracking-tight">Instruções de Formatação (Template 4 Colunas Blindadas)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <p className="text-xs font-bold text-petrol uppercase tracking-widest">Coluna A</p>
            <p className="text-sm text-gray-600 font-medium">Nome</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-petrol uppercase tracking-widest">Coluna B</p>
            <p className="text-sm text-gray-600 font-medium">CPF (Chave Única)</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-petrol uppercase tracking-widest">Coluna C</p>
            <p className="text-sm text-gray-600 font-medium">Matrícula</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-petrol uppercase tracking-widest">Coluna D</p>
            <p className="text-sm text-gray-600 font-medium">Data_Matricula</p>
          </div>
        </div>
        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0" size={20} />
          <p className="text-xs text-amber-800 font-medium">
            <strong>IMPORTANTE:</strong> O sistema utiliza o CPF para evitar duplicidades. Alunos importados serão automaticamente vinculados à modalidade <strong>PRESENCIAL</strong> e ao núcleo logado.
          </p>
        </div>
      </div>
    </div>
  );
};
