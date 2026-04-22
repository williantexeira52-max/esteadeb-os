import React, { useState } from 'react';
import { QrCode, Printer, Download, Receipt, CreditCard, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';

export const Carnets: React.FC = () => {
  const { nucleo } = useAuth();
  const [studentName, setStudentName] = useState('JOÃO DA SILVA OLIVEIRA');
  const [installments, setInstallments] = useState(12);
  const [value, setValue] = useState(250);

  const generateCarnetData = () => {
    return Array.from({ length: installments }, (_, i) => ({
      parcel: i + 1,
      dueDate: new Date(2026, i + 1, 10).toLocaleDateString('pt-BR'),
      value: value.toFixed(2),
      student: studentName,
      registration: '2026-04-001',
      pixCode: `00020126360014BR.GOV.BCB.PIX0114esteadeb2026pix5204000053039865405${value.toFixed(2)}5802BR5915ESTEADEB_2026_6009SAO_PAULO62070503***6304`
    }));
  };

  const carnetList = generateCarnetData();

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy tracking-tight">Gerador de Carnês Institucionais</h1>
          <p className="text-gray-500">Impressão física (3 lâminas por página) com QR Code PIX (Aba 7).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-navy text-navy gap-2">
            <Printer size={18} /> Imprimir Todos
          </Button>
          <Button className="bg-petrol hover:bg-petrol-dark gap-2">
            <Download size={18} /> Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-bold text-navy border-b border-gray-100 pb-2">Configurações do Carnê</h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Nome do Aluno</label>
                <input 
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm" 
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value.toUpperCase())}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Parcelas</label>
                  <input 
                    type="number"
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm" 
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Valor (R$)</label>
                  <input 
                    type="number"
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm" 
                    value={value}
                    onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="p-4 bg-navy/5 rounded-xl">
                <p className="text-[10px] font-bold text-navy uppercase tracking-widest mb-2">Visualização PIX</p>
                <div className="flex justify-center bg-white p-2 rounded-lg border border-navy/10">
                  <QRCodeSVG value={carnetList[0].pixCode} size={120} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-navy flex items-center gap-2">
            <Receipt className="text-petrol" /> Pré-visualização das Lâminas
          </h3>
          <div className="space-y-6 bg-gray-100 p-8 rounded-2xl border-2 border-dashed border-gray-300">
            {carnetList.slice(0, 3).map((c, i) => (
              <div key={i} className="bg-white border border-gray-300 flex overflow-hidden shadow-sm relative">
                {/* Canhoto */}
                <div className="w-48 p-4 border-r border-dashed border-gray-300 bg-gray-50">
                  <div className="text-[8px] font-bold text-gray-400 uppercase mb-2">Canhoto Institucional</div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[8px] text-gray-400 uppercase">Parcela</p>
                      <p className="text-xs font-bold text-navy">{c.parcel}/{installments}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-gray-400 uppercase">Vencimento</p>
                      <p className="text-xs font-bold text-navy">{c.dueDate}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-gray-400 uppercase">Valor</p>
                      <p className="text-xs font-bold text-navy">R$ {c.value}</p>
                    </div>
                  </div>
                </div>
                
                {/* Lâmina Principal */}
                <div className="flex-1 p-4 flex justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-black text-navy tracking-tighter">ESTEADEB 2026</h4>
                        <p className="text-[8px] text-gray-500 uppercase tracking-widest">Educação Teológica de Excelência</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-gray-400 uppercase">Vencimento</p>
                        <p className="text-sm font-black text-petrol">{c.dueDate}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[8px] text-gray-400 uppercase">Aluno</p>
                        <p className="text-[10px] font-bold text-navy truncate">{c.student}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-gray-400 uppercase">Matrícula</p>
                        <p className="text-[10px] font-bold text-navy">{c.registration}</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-2 flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-[8px] text-gray-400 uppercase italic">Instruções: Pagamento exclusivo via PIX ou na Secretaria.</p>
                        <p className="text-[8px] text-gray-400 italic">Desconto de pontualidade mantido após vencimento (+ multa/juros).</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-gray-400 uppercase">Valor a Pagar</p>
                        <p className="text-xl font-black text-navy">R$ {c.value}</p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-6 flex flex-col items-center justify-center border-l border-gray-100 pl-6">
                    <QRCodeSVG value={c.pixCode} size={64} />
                    <p className="text-[8px] font-bold text-navy mt-1 uppercase tracking-tighter">Pague com PIX</p>
                  </div>
                </div>

                {/* Marca d'água de segurança */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none rotate-12">
                  <GraduationCap size={120} />
                </div>
              </div>
            ))}
            <p className="text-center text-xs text-gray-400 font-medium">... e mais {installments - 3} lâminas geradas no arquivo final.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
