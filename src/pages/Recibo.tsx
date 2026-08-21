import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import logoTratoFeito from "@/assets/logo-trato-feito.png";
import { formatBRL, formatDateBR } from "@/lib/format";
import { saveElementAsPdf } from "@/lib/pdf";
import type { VeiculoComCentro, Transacao, Cliente } from "@/lib/db-types";

/**
 * Categorias que representam uma venda no financeiro. O recibo soma as três
 * porque uma mesma venda pode gerar mais de uma linha: parte à vista, parte
 * troca, parte saldo/financiado.
 */
const CATEGORIAS_VENDA = ["Venda de Veículo", "Venda de Veículo (Saldo)", "Troca de Veículo"] as const;

export default function Recibo() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [veiculo, setVeiculo] = useState<VeiculoComCentro | null>(null);
  const [vendaTxs, setVendaTxs] = useState<Transacao[]>([]);
  const [compradorCliente, setCompradorCliente] = useState<Cliente | null>(null);
  const [vendedorCliente, setVendedorCliente] = useState<Cliente | null>(null);
  const [salvando, setSalvando] = useState(false);
  const conteudoRef = useRef<HTMLDivElement>(null);

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
    // Query defensiva: busca todas transações de venda (Venda, Saldo, Troca)
    // e soma. Sem `.single()` — se houvesse mais de uma o Postgrest devolvia
    // erro e o valor não aparecia.
    supabase
      .from("transacoes")
      .select("*")
      .eq("veiculo_id", id)
      .eq("tipo", "Receita")
      .in("categoria", CATEGORIAS_VENDA as unknown as string[])
      .then(({ data }) => setVendaTxs(data ?? []));
  }, [id]);

  async function handleSalvarPdf() {
    if (!conteudoRef.current || !veiculo) return;
    setSalvando(true);
    try {
      const nomeArquivo = `Recibo_${veiculo.placa}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      await saveElementAsPdf(conteudoRef.current, nomeArquivo);
      toast.success("PDF salvo!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Não foi possível gerar o PDF");
    } finally {
      setSalvando(false);
    }
  }

  if (!veiculo) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  // Valor da venda: soma das transações. Se não há transação (venda ainda
  // não lançada ou lançada em categoria não padrão), cai pra veiculo.valor_venda.
  // Se nem isso existe, mostra R$ 0,00 mas o campo sempre aparece.
  const valorVenda = vendaTxs.length > 0
    ? vendaTxs.reduce((s, t) => s + Number(t.valor), 0)
    : Number(veiculo.valor_venda ?? 0);
  // Data da venda: prioriza data_pagamento da transação; se não houver
  // transação, cai no campo data_venda do cadastro do veículo.
  const dataVenda =
    vendaTxs[0]?.data_pagamento ??
    vendaTxs[0]?.data_vencimento ??
    veiculo.data_venda ??
    null;

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white min-h-screen">
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={() => navigate(`/veiculos/${id}/detalhe`)} variant="outline" className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
        <Button onClick={handleSalvarPdf} disabled={salvando} variant="secondary" className="gap-1">
          <Download className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar PDF"}
        </Button>
      </div>

      <div ref={conteudoRef} className="border border-gray-300 rounded-lg p-8 space-y-6 text-black bg-white">
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

        {/* Valor da venda — sempre visível. Mesmo sem transação lançada, mostra
            veiculo.valor_venda (que pode ter sido preenchido no cadastro). */}
        <div>
          <h2 className="text-sm font-semibold border-b border-gray-200 pb-1 mb-3 text-gray-700 uppercase">Informações da Venda</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="font-semibold">Valor da Venda:</span> {formatBRL(valorVenda)}</div>
            <div><span className="font-semibold">Data:</span> {formatDateBR(dataVenda)}</div>
          </div>
          {vendaTxs.length > 1 && (
            <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-1 text-xs text-gray-700">
              {vendaTxs.map((t) => (
                <div key={t.id} className="flex justify-between">
                  <span>{t.categoria}</span>
                  <span className="font-mono">{formatBRL(Number(t.valor))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

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

        {/* Assinaturas — protegidas contra quebra de página. */}
        <div className="pt-8 mt-8 assinaturas-bloco">
          <div className="grid grid-cols-2 gap-16 text-center text-sm">
            <div className="assinatura-item">
              <div className="border-t border-black pt-2 font-semibold">Vendedor</div>
              <p className="text-xs text-gray-500 mt-1">MEU CARRO ON-LINE LIMITADA</p>
            </div>
            <div className="assinatura-item">
              <div className="border-t border-black pt-2 font-semibold">Comprador</div>
              {compradorCliente && <p className="text-xs text-gray-500 mt-1">{compradorCliente.nome}</p>}
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-400 mt-6">
          Data de emissão: {formatDateBR(dataVenda) || new Date().toLocaleDateString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
