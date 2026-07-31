import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ClienteSelector from "@/components/ClienteSelector";
import NovoVeiculoDialog from "@/components/NovoVeiculoDialog";
import { Plus, Trash2 } from "lucide-react";

interface Props { veiculo: any; onClose: () => void; }

interface PagamentoLinha {
  id: string;
  valor: string;
  forma: string;
  contaId: string;
  dataRecebimento: string;
}

const formasPagamento = ["PIX", "Dinheiro", "Cartão Débito", "Cartão Crédito", "Transferência", "Financiamento Banco", "Cheque", "Veículo na Troca"];

function novaLinha(): PagamentoLinha {
  return { id: crypto.randomUUID(), valor: "", forma: "PIX", contaId: "", dataRecebimento: new Date().toISOString().split("T")[0] };
}

export default function VendaDialog({ veiculo, onClose }: Props) {
  const { user } = useAuth();
  const [contas, setContas] = useState<any[]>([]);
  const [valorVenda, setValorVenda] = useState("");
  const [pagamentos, setPagamentos] = useState<PagamentoLinha[]>([novaLinha()]);
  const [loading, setLoading] = useState(false);
  const [clienteVendaId, setClienteVendaId] = useState<string | null>(null);

  // Trade-in vehicle modal state
  const [showNovoVeiculo, setShowNovoVeiculo] = useState(false);
  const [tradeInPagamentos, setTradeInPagamentos] = useState<PagamentoLinha[]>([]);
  const [currentTradeInIdx, setCurrentTradeInIdx] = useState(0);
  const [vendaConfirmada, setVendaConfirmada] = useState(false);
  const [transacoesCriadas, setTransacoesCriadas] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("contas_bancarias").select("*").then(({ data }) => setContas(data ?? []));
  }, []);

  const totalPagamentos = pagamentos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
  const vendaNum = parseFloat(valorVenda) || 0;
  const restante = vendaNum - totalPagamentos;

  function addLinha() { setPagamentos([...pagamentos, novaLinha()]); }
  function removeLinha(id: string) { setPagamentos(pagamentos.filter(p => p.id !== id)); }
  function updateLinha(id: string, field: keyof PagamentoLinha, value: string) {
    setPagamentos(pagamentos.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  const tradeInLinhas = pagamentos.filter(p => p.forma === "Veículo na Troca");
  const hasTradeIn = tradeInLinhas.length > 0;

  async function handleVenda(e: React.FormEvent) {
    e.preventDefault();
    if (restante < -0.01) {
      toast.error(`A soma dos pagamentos (${totalPagamentos.toFixed(2)}) é maior que o valor de venda (${vendaNum.toFixed(2)}).`);
      return;
    }
    setLoading(true);
    try {
      // 1. Mark car as sold
      await supabase.from("veiculos").update({ status: "Vendido", cliente_venda_id: clienteVendaId }).eq("id", veiculo.id);

      // 2. Create transactions for each payment line
      const transacoes = pagamentos.map((p, i) => ({
        descricao: pagamentos.length === 1
          ? `Venda ${veiculo.placa}${p.forma === "Veículo na Troca" ? " (troca)" : ""}`
          : `Venda ${veiculo.placa} — ${p.forma} (${i + 1}/${pagamentos.length})`,
        valor: parseFloat(p.valor) || 0,
        tipo: "Receita" as const,
        status: p.forma === "Financiamento Banco" ? "Pendente" : p.forma === "Veículo na Troca" ? "Pago" : "Pago",
        data_vencimento: p.dataRecebimento,
        data_pagamento: p.forma === "Financiamento Banco" ? null : p.dataRecebimento,
        conta_bancaria_id: p.forma === "Veículo na Troca" ? null : (p.contaId || null),
        centro_custo_id: veiculo.centro_custo_id,
        veiculo_id: veiculo.id,
        categoria: p.forma === "Veículo na Troca" ? "Troca de Veículo" : "Venda de Veículo",
        user_id: user?.id,
      }));

      // 2.5 Add pending transaction for the remaining balance if partial payment
      if (restante > 0.01) {
        transacoes.push({
          descricao: `Saldo Restante Venda - ${veiculo.placa}`,
          valor: restante,
          tipo: "Receita" as const,
          status: "Pendente",
          data_vencimento: new Date().toISOString().split("T")[0],
          data_pagamento: null,
          conta_bancaria_id: null,
          centro_custo_id: veiculo.centro_custo_id,
          veiculo_id: veiculo.id,
          categoria: "Venda de Veículo (Saldo)",
          user_id: user?.id,
        });
      }

      const { data: insertedTx, error } = await supabase.from("transacoes").insert(transacoes).select("id");
      if (error) throw error;

      // 3. If there are trade-in payments, open vehicle registration modals
      if (hasTradeIn) {
        setTransacoesCriadas(insertedTx?.map(t => t.id) ?? []);
        setTradeInPagamentos(tradeInLinhas);
        setCurrentTradeInIdx(0);
        setVendaConfirmada(true);
        setShowNovoVeiculo(true);
        toast.success("Venda registrada! Agora cadastre o(s) veículo(s) recebido(s) na troca.");
      } else {
        toast.success("Venda registrada com sucesso!");
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleVeiculoCadastrado(veiculoId?: string) {
    if (veiculoId && transacoesCriadas.length > 0) {
      // Find the transaction index for this trade-in line
      const tradeInIndices = pagamentos.map((p, i) => p.forma === "Veículo na Troca" ? i : -1).filter(i => i >= 0);
      const txIdx = tradeInIndices[currentTradeInIdx];
      if (txIdx !== undefined && transacoesCriadas[txIdx]) {
        supabase.from("transacoes").update({ veiculo_id: veiculoId }).eq("id", transacoesCriadas[txIdx]);
      }
    }

    const nextIdx = currentTradeInIdx + 1;
    if (nextIdx < tradeInPagamentos.length) {
      setCurrentTradeInIdx(nextIdx);
      setShowNovoVeiculo(true);
    } else {
      setShowNovoVeiculo(false);
      onClose();
    }
  }

  const currentTradeIn = tradeInPagamentos[currentTradeInIdx];

  return (
    <>
      <Dialog open={!vendaConfirmada} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vender — {veiculo.placa}</DialogTitle></DialogHeader>
          <form onSubmit={handleVenda} className="space-y-4">
            <ClienteSelector label="Comprador (Cliente)" value={clienteVendaId} onChange={setClienteVendaId} />
            <div><Label>Valor Total de Venda (R$)</Label><Input type="number" step="0.01" value={valorVenda} onChange={(e) => setValorVenda(e.target.value)} required /></div>

            {/* Pagamento Múltiplo */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Formas de Pagamento</h4>
                <Button type="button" size="sm" variant="outline" onClick={addLinha} className="gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>

              {pagamentos.map((p) => (
                <div key={p.id} className="grid grid-cols-12 gap-2 items-end border-b pb-2 last:border-0 last:pb-0">
                  <div className="col-span-3">
                    <Label className="text-xs">Forma</Label>
                    <Select value={p.forma} onValueChange={(v) => updateLinha(p.id, "forma", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{formasPagamento.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input type="number" step="0.01" className="h-9" value={p.valor} onChange={(e) => updateLinha(p.id, "valor", e.target.value)} required />
                  </div>
                  {p.forma !== "Veículo na Troca" ? (
                    <div className="col-span-3">
                      <Label className="text-xs">Conta Destino</Label>
                      <Select value={p.contaId} onValueChange={(v) => updateLinha(p.id, "contaId", v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Conta" /></SelectTrigger>
                        <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="col-span-3">
                      <Label className="text-xs text-purple-600">🚗 Veículo será cadastrado após confirmar</Label>
                    </div>
                  )}
                  <div className="col-span-2">
                    <Label className="text-xs">Data</Label>
                    <Input type="date" className="h-9" value={p.dataRecebimento} onChange={(e) => updateLinha(p.id, "dataRecebimento", e.target.value)} required />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {pagamentos.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeLinha(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {vendaNum > 0 && (
                <div className="flex justify-between items-center text-sm pt-2 border-t">
                  <span className="text-muted-foreground">
                    Total Venda: <strong>{vendaNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                  </span>
                  <div className="text-right">
                    {restante < -0.01 ? (
                      <span className="text-destructive font-bold">Valor excedente inválido</span>
                    ) : restante > 0.01 ? (
                      <span className="text-amber-600 font-bold">A Receber: {restante.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    ) : (
                      <span className="text-emerald-500 font-bold">✓ Fechado</span>
                    )}
                    {restante > 0.01 && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Um lançamento pendente será criado para o saldo</p>}
                  </div>
                </div>
              )}

              {hasTradeIn && (
                <p className="text-xs text-purple-600 bg-purple-500/10 rounded px-2 py-1">
                  ⓘ Após confirmar a venda, será aberto o cadastro do(s) veículo(s) recebido(s) na troca com o valor já preenchido.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {hasTradeIn ? "Confirmar Venda e Cadastrar Troca" : "Confirmar Venda"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {showNovoVeiculo && currentTradeIn && (
        <NovoVeiculoDialog
          open={showNovoVeiculo}
          onClose={handleVeiculoCadastrado}
          title={`Cadastrar Veículo da Troca${tradeInPagamentos.length > 1 ? ` (${currentTradeInIdx + 1}/${tradeInPagamentos.length})` : ""}`}
          defaultValues={{
            valor_aquisicao: currentTradeIn.valor,
            centro_custo_id: veiculo.centro_custo_id ?? "",
          }}
        />
      )}
    </>
  );
}
