import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoTratoFeito from "@/assets/logo-trato-feito.png";
import { formatBRL } from "@/lib/format";

interface GenericReceiptProps {
    transacao: any;
    veiculo?: any;
}

export default function GenericReceipt({ transacao, veiculo }: GenericReceiptProps) {
    if (!transacao) return null;

    const dataExtenso = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const isReceita = transacao.tipo === "Receita";
    const titulo = isReceita ? "Recibo de Recebimento" : "Recibo de Pagamento";
    const acaoOriginal = isReceita ? "Recebemos de" : "Pagamos para";

    return (
        <div className="p-8 bg-white text-black font-serif printable-receipt" style={{ minHeight: "297mm" }}>
            {/* Header */}
            <div className="flex flex-col items-center border-b pb-6 mb-8 text-center">
                <img src={logoTratoFeito} alt="Trato Feito" className="h-24 mb-4 object-contain" />
                <h1 className="text-2xl font-bold uppercase tracking-widest">{titulo}</h1>
                <p className="text-sm text-gray-600 mt-1 italic">MEU CARRO ON-LINE LIMITADA - CNPJ: 12.345.678/0001-90</p>
            </div>

            {/* Body */}
            <div className="space-y-8 text-lg leading-relaxed">
                <div className="flex justify-between items-center bg-gray-50 p-4 border rounded">
                    <span className="font-bold text-xl uppercase">Valor:</span>
                    <span className="font-bold text-2xl">{formatBRL(Number(transacao.valor))}</span>
                </div>

                <p className="text-justify">
                    {acaoOriginal} <strong>{transacao.favorecido_pagador?.toUpperCase() || "_________________________________"}</strong>,
                    a quantia supra de <strong>{formatBRL(Number(transacao.valor))}</strong>,
                    referente a: <strong>{transacao.descricao}</strong>.
                </p>

                {veiculo && (
                    <div className="border p-4 rounded bg-gray-50/50">
                        <h2 className="text-sm font-bold uppercase border-b mb-3 text-gray-700">Dados do Veículo Vinculado</h2>
                        <div className="grid grid-cols-2 gap-y-2 text-sm italic">
                            <div><span className="font-semibold">Placa:</span> {veiculo.placa}</div>
                            <div><span className="font-semibold">Marca/Modelo:</span> {veiculo.marca_modelo}</div>
                            <div><span className="font-semibold">Ano:</span> {veiculo.ano}</div>
                            <div><span className="font-semibold">Cor:</span> {veiculo.cor || "—"}</div>
                        </div>
                    </div>
                )}

                <div className="mt-12 text-center space-y-20">
                    <p>Brasília-DF, {dataExtenso}.</p>

                    <div className="grid grid-cols-2 gap-16 pt-12">
                        <div className="border-t border-black pt-2 flex flex-col items-center">
                            <span className="font-bold uppercase text-xs">Assinatura do Emitente</span>
                            <span className="text-[10px] text-gray-500 mt-1 uppercase">Meu Carro On-Line Ltda</span>
                        </div>
                        <div className="border-t border-black pt-2 flex flex-col items-center">
                            <span className="font-bold uppercase text-xs">Assinatura do Favorecido</span>
                            <span className="text-[10px] text-gray-500 mt-1 uppercase">{transacao.favorecido_pagador || "Favorecido"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Media Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          body * { visibility: hidden; }
          .printable-receipt, .printable-receipt * { visibility: visible; }
          .printable-receipt {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            margin: 0;
            padding: 30mm 20mm;
          }
          .no-print { display: none !important; }
        }
      `}} />
        </div>
    );
}
