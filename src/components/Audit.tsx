import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  serverTimestamp,
  orderBy,
  where,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  User, 
  Activity,
  Calendar,
  Filter
} from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';

export const Audit: React.FC = () => {
  const { user, nucleo } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user || !nucleo) return;
    const q = query(
      collection(db, 'auditLogs'),
      where('nucleoId', '==', nucleo),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditLogs');
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy tracking-tight">Auditoria Master (Logs)</h1>
          <p className="text-gray-500">Registro indelével de todas as ações no sistema.</p>
        </div>
        <Badge className="bg-navy text-white px-4 py-1 font-bold">
          <ShieldCheck size={14} className="mr-2" /> Sistema Blindado
        </Badge>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar por ação, usuário ou detalhes..." 
              className="pl-10 bg-gray-50 border-none focus-visible:ring-petrol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400">
            <Filter size={20} />
          </Button>
        </div>

        <ScrollArea className="h-[650px]">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="font-bold text-navy w-[200px]">Data/Hora</TableHead>
                <TableHead className="font-bold text-navy w-[150px]">Usuário</TableHead>
                <TableHead className="font-bold text-navy">Ação</TableHead>
                <TableHead className="font-bold text-navy">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20 text-gray-400">
                    Nenhum registro de auditoria encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="text-xs font-mono text-gray-500">
                      <div className="flex items-center gap-2">
                        <Clock size={12} />
                        {log.timestamp?.toDate().toLocaleString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-bold text-navy">
                        <User size={14} className="text-petrol" />
                        {log.userId?.slice(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-navy text-navy font-bold text-[10px] uppercase">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 italic">
                      <div className="space-y-1">
                        {log.details}
                        {log.changes && (
                          <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] grid grid-cols-2 gap-4">
                            {log.changes.before && (
                              <div className="space-y-1">
                                <p className="font-bold text-red-500 uppercase tracking-tighter">Antes:</p>
                                <pre className="bg-red-50/50 p-1 rounded max-w-[200px] overflow-hidden text-ellipsis">
                                  {JSON.stringify(log.changes.before, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.changes.after && (
                              <div className="space-y-1">
                                <p className="font-bold text-green-600 uppercase tracking-tighter">Depois:</p>
                                <pre className="bg-green-50/50 p-1 rounded max-w-[200px] overflow-hidden text-ellipsis">
                                  {JSON.stringify(log.changes.after, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                        {log.path && <p className="text-[9px] text-slate-300 font-mono mt-1">{log.path}</p>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
};
