import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  collection, 
  writeBatch, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { cn } from '@/lib/utils';

interface DataActionsProps {
  collectionName: string;
  data: any[];
  headers: { key: string; label: string; type?: 'string' | 'number' | 'date' }[];
  templateHeaders?: { key: string; label: string; type?: 'string' | 'number' | 'date' }[];
  title: string;
  onImportSuccess?: (count: number) => void;
  transformRow?: (row: any) => any;
  getRowId?: (row: any) => string;
}

export const DataActions: React.FC<DataActionsProps> = ({ 
  collectionName, 
  data, 
  headers, 
  templateHeaders,
  title,
  onImportSuccess,
  transformRow,
  getRowId
}) => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{ success: number; errors: number } | null>(null);

  const exportToExcel = () => {
    try {
      const exportData = data.map(item => {
        const row: any = {};
        headers.forEach(h => {
          row[h.label] = item[h.key] ?? '';
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31)); // Sheet name limit is 31 chars
      XLSX.writeFile(wb, `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Erro ao exportar arquivo. Verifique os dados e tente novamente.');
    }
  };

  const downloadTemplate = () => {
    try {
      const activeHeaders = templateHeaders || headers;
      const templateData = [{}];
      activeHeaders.forEach(h => {
        (templateData[0] as any)[h.label] = '';
      });

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, `Template_${title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
    } catch (error) {
      console.error('Template download error:', error);
      alert('Erro ao baixar template.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setSummary(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          setImporting(false);
          return;
        }

        const activeHeaders = templateHeaders || headers;
        const batchSize = 100; // Smaller batch size for better stability
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < rawData.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = rawData.slice(i, i + batchSize);

          chunk.forEach((row: any) => {
            let mappedData: any = {
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            activeHeaders.forEach(h => {
              let value = row[h.label];
              if (h.type === 'number') value = Number(value) || 0;
              if (h.type === 'date' && value) {
                // Handle Excel serial dates or DD/MM/YYYY strings
                if (typeof value === 'number') {
                  // Excel serial date
                  const date = new Date((value - 25569) * 86400 * 1000);
                  value = date.toISOString().split('T')[0];
                } else if (typeof value === 'string' && value.includes('/')) {
                  // DD/MM/YYYY
                  const [d, m, y] = value.split('/');
                  if (d && m && y) {
                    value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                  }
                }
              }
              mappedData[h.key] = value ?? '';
            });

            // Apply custom transformation if provided
            if (transformRow) {
              mappedData = transformRow(mappedData);
            }

            // Determine document reference
            let docRef;
            if (getRowId) {
              const customId = getRowId(mappedData);
              if (customId) {
                docRef = doc(db, collectionName, customId);
              }
            }
            
            if (!docRef) {
              docRef = doc(collection(db, collectionName));
            }

            batch.set(docRef, mappedData, { merge: true });
          });

          await batch.commit();
          successCount += chunk.length;
          setProgress(Math.round(((i + chunk.length) / rawData.length) * 100));
        }

        setSummary({ success: successCount, errors: errorCount });
        if (onImportSuccess) onImportSuccess(successCount);
      } catch (error) {
        console.error('Import error:', error);
        setSummary({ success: 0, errors: 1 });
        handleFirestoreError(error, OperationType.WRITE, collectionName);
      } finally {
        setImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button 
          variant="outline" 
          onClick={exportToExcel}
          className="bg-white border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-50 gap-2 font-bold uppercase text-[10px] tracking-widest h-10 px-4 rounded-xl"
        >
          <Download size={16} />
          Exportar Excel
        </Button>
        
        <Button 
          variant="outline" 
          onClick={downloadTemplate}
          className="bg-white border-slate-200 text-slate-600 hover:text-navy hover:bg-slate-50 gap-2 font-bold uppercase text-[10px] tracking-widest h-10 px-4 rounded-xl"
        >
          <FileSpreadsheet size={16} />
          Baixar Template
        </Button>

        <div className="relative">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleImport}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={importing}
          />
          <Button 
            variant="outline"
            disabled={importing}
            className="bg-petrol/5 border-petrol/20 text-petrol hover:bg-petrol/10 gap-2 font-bold uppercase text-[10px] tracking-widest h-10 px-4 rounded-xl"
          >
            {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Importar Bulk
          </Button>
        </div>
      </div>

      {importing && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Processando Importação...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-slate-100" />
        </div>
      )}

      {summary && (
        <div className={cn(
          "p-4 rounded-2xl border flex items-center gap-4 animate-in zoom-in-95",
          summary.errors > 0 ? "bg-red-50 border-red-100 text-red-600" : "bg-green-50 border-green-100 text-green-600"
        )}>
          {summary.errors > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-tight">
              {summary.success} registros importados com sucesso
            </p>
            {summary.errors > 0 && (
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                {summary.errors} erros encontrados
              </p>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSummary(null)}
            className="h-8 px-2 hover:bg-black/5"
          >
            <X size={16} />
          </Button>
        </div>
      )}
    </div>
  );
};
