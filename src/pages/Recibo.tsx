import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import logoTratoFeito from "@/assets/logo-trato-feito.png";
import { formatBRL } from "@/lib/format";
import type { VeiculoComCentro, Transacao, Cliente } from "@/lib/db-types";

export default function Recibo() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [veiculo, setVeiculo] = useState<VeiculoComCentro | null>(null);
  const [vendaTx, setVendaTx] = useState<Transacao | null>(null);
  const [compradorCliente, setCompradorCliente] = useState<Cliente | null>(null);
  const [vendedorCliente, setVendedorCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("veiculos").select("*, centros_custo(nome)").eq("id", id).single().then(({ data }) => {
      setVeiculo(data);
      if (data?.cliente_venda_id) {
        supabase.from("clientes").select("*").eq("id", data.cliente_venda_id).single().then(({ data: c }) => setCompradorCliente(c));
      }
      if (data?.cliente_compra_id) {
        supabase.from("clientes").select("*").eq("id", data.cliente_compra_id).single().then(({ data: c }) => setVendedorCliente(c));
      }
    });
    supabase.from("transacoes").select("*").eq("veiculo_id", id).eq("tipo", "Receita").eq("categoria", "Venda de Veículo").limit(1).single().then(({ data }) => setVendaTx(data));
  }, [id]);

  if (!veiculo) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white min-h-screen">
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={() => navigate(`/veiculos/${id}/detalhe`)} variant="outline" className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
      </div>

      <div className="border border-gray-300 rounded-lg p-8 space-y-6 text-black">
        {/* Header com logo */}
        <div className="text-center border-b border-gray-300 pb-4">
          <img src={logoTratoFeito} alt="Trato Feito Seminovos" className="mx-auto h-24 mb-3" />
          <h1 className="text-xl font-bold tracking-wide uppercase text-black">Recibo de Compra e Venda</h1>
          <p className="text-xs text-gray-500 mt-1">Veículo Automotor</p>
          <p className="text-xs text-gray-500">MEU CARRO ON-LINE LIMITADA</p>
        </div>

        {/* Dados do veículo */}
        <div>
          <h2 className="text-sm font-semibold border-b border-gray-200 pb-1 mb-3 text-gray-700 uppercase">Dados do Veículo</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="font-semibold">Placa:</span> {veiculo.placa}</div>
            <div><span className="font-semibold">Marca/Modelo:</span> {veiculo.marca_modelo}</div>
            <div><span className="font-semibold">Ano Fab/Modelo:</span> {veiculo.ano}{veiculo.ano_modelo && veiculo.ano_modelo !== veiculo.ano ? `/${veiculo.ano_modelo}` : ""}</div>
            <div><span className="font-semibold">Cor:</span> {veiculo.cor ?? "—"}</div>
            <div><span className="font-semibold">Renavam:</span> {veiculo.renavam ?? "—"}</div>
            <div><span className="font-semibold">Centro de Custo:</span> {veiculo.centros_custo?.nome ?? "—"}</div>
          </div>
        </div>

        {/* Valor da venda */}
        {vendaTx && (
          <div>
            <h2 className="text-sm font-semibold border-b border-gray-200 pb-1 mb-3 text-gray-700 uppercase">Informações da Venda</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold">Valor da Venda:</span> {formatBRL(Number(vendaTx.valor))}</div>
              <div><span className="font-semibold">Data:</span> {vendaTx.data_pagamento ?? vendaTx.data_vencimento}</div>
            </div>
          </div>
        )}

        {/* Comprador */}
        <div>
          <h2 className="text-sm font-semibold border-b border-gray-200 pb-1 mb-3 text-gray-700 uppercase">Comprador</h2>
          {compradorCliente ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold">Nome:</span> {compradorCliente.nome}</div>
              <div><span className="font-semibold">CPF/CNPJ:</span> {compradorCliente.cpf_cnpj}</div>
              {compradorCliente.telefone && <div><span className="font-semibold">Telefone:</span> {compradorCliente.telefone}</div>}
              {compradorCliente.endereco && <div className="col-span-2"><span className="font-semibold">Endereço:</span> {compradorCliente.endereco}</div>}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Não informado</p>
          )}
        </div>

        {/* Assinaturas */}
        <div className="pt-8 mt-8">
          <div className="grid grid-cols-2 gap-16 text-center text-sm">
            <div>
              <div className="border-t border-black pt-2 font-semibold">Vendedor</div>
              <p className="text-xs text-gray-500 mt-1">MEU CARRO ON-LINE LIMITADA</p>
            </div>
            <div>
              <div className="border-t border-black pt-2 font-semibold">Comprador</div>
              {compradorCliente && <p className="text-xs text-gray-500 mt-1">{compradorCliente.nome}</p>}
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-400 mt-6">
          Data de emissão: {(() => {
            const dateStr = vendaTx?.data_pagamento ?? vendaTx?.data_vencimento;
            if (!dateStr) return new Date().toLocaleDateString("pt-BR");
            const [y, m, d] = dateStr.split("-");
            return `${d}/${m}/${y}`;
          })()}
        </p>
      </div>
    </div>
  );
}
