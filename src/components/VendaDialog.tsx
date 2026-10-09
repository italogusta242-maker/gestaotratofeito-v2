import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/masked-input";
import { toast } from "sonner";
import ClienteSelector from "@/components/ClienteSelector";
import NovoVeiculoDialog from "@/components/NovoVeiculoDialog";
import { Plus, Trash2, AlertCircle, Lock } from "lucide-react";
import { translateError } from "@/lib/supabase-errors";
import { validateVenda } from "@/lib/venda-validation";
import { CATEGORIAS_VENDA, gerarParcelasSaldo, rotuloPagamento } from "@/lib/venda-saldo";
import { addDays, format } from "date-fns";
import { formatBRL, parseDateLocal } from "@/lib/format";
import type { Veiculo, ContaBancaria, Transacao } from "@/lib/db-types";

interface Props {
  veiculo: Veiculo;
  onClose: () => void;
  /** "editar": reabre uma venda já registrada pra corrigir os pagamentos. */
  modo?: "nova" | "editar";
}

interface PagamentoLinha {
  id: string;
  valor: string;
  forma: string;
  contaId: string;
  dataRecebimento: string;
  // Só em modo edição: transação já gravada que essa linha representa.
  txId?: string;
  descricaoOriginal?: string;
  statusOriginal?: string;
  dataOriginal?: string;
  /** Troca que já existia: o veículo recebido foi cadastrado na época. */
  trocaOriginal?: boolean;
}

const formasPagamento = ["PIX", "Dinheiro", "Cartão Débito", "Cartão Crédito", "Transferência", "Financiamento Banco", "Cheque", "Veículo na Troca"];

const hojeISO = () => format(new Date(), "yyyy-MM-dd");

function novaLinha(): PagamentoLinha {
  return { id: crypto.randomUUID(), valor: "", forma: "PIX", contaId: "", dataRecebimento: hojeISO() };
}

const ehSaldo = (t: Transacao) => t.categoria === "Venda de Veículo (Saldo)" || /^Saldo Restante Venda/i.test(t.descricao);

export default function VendaDialog({ veiculo, onClose, modo = "nova" }: Props) {
  const editando = modo === "editar";
  const { user } = useAuth();
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contasLoaded, setContasLoaded] = useState(false);
  const [valorVenda, setValorVenda] = useState("");
  const [pagamentos, setPagamentos] = useState<PagamentoLinha[]>([novaLinha()]);
  const [loading, setLoading] = useState(false);
  const [carregandoVenda, setCarregandoVenda] = useState(editando);
  const [clienteVendaId, setClienteVendaId] = useState<string | null>(null);
  // Saldo que o cliente fica devendo (venda "picada"): em quantas parcelas e
  // a partir de quando. Vira lançamentos pendentes e aparece no contrato.
  const [saldoParcelas, setSaldoParcelas] = useState("1");
  const [saldoVencimento, setSaldoVencimento] = useState(() => format(addDays(new Date(), 30), "yyyy-MM-dd"));

  // Modo edição: transações da venda como estavam ao abrir. Parcelas do saldo
  // que já receberam baixa ficam travadas (não somem nem mudam de valor).
  const [txOriginais, setTxOriginais] = useState<Transacao[]>([]);
  const parcelasPagas = txOriginais.filter(t => ehSaldo(t) && t.status === "Pago");
  const saldoPendenteOriginal = txOriginais.filter(t => ehSaldo(t) && t.status !== "Pago");

  // Trade-in vehicle modal state
  const [showNovoVeiculo, setShowNovoVeiculo] = useState(false);
  const [tradeInPagamentos, setTradeInPagamentos] = useState<PagamentoLinha[]>([]);
  const [tradeInTxIds, setTradeInTxIds] = useState<string[]>([]);
  const [currentTradeInIdx, setCurrentTradeInIdx] = useState(0);
  const [vendaConfirmada, setVendaConfirmada] = useState(false);

  useEffect(() => {
    supabase.from("contas_bancarias").select("*").then(({ data }) => {
      setContas(data ?? []);
      setContasLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!editando) return;
    (async () => {
      const { data, error } = await supabase
        .from("transacoes")
        .select("*")
        .eq("veiculo_id", veiculo.id)
        .eq("tipo", "Receita")
        .order("data_vencimento");
      if (error) toast.error(translateError(error));
      const txs = (data ?? []).filter(t => CATEGORIAS_VENDA.includes(t.categoria ?? "") || ehSaldo(t));
      setTxOriginais(txs);
      setClienteVendaId(veiculo.cliente_venda_id);

      const linhas: PagamentoLinha[] = txs.filter(t => !ehSaldo(t)).map(t => {
        const data = t.data_pagamento ?? t.data_vencimento;
        const forma = t.forma_pagamento && formasPagamento.includes(t.forma_pagamento)
          ? t.forma_pagamento
          : t.categoria === "Troca de Veículo" ? "Veículo na Troca" : "PIX";
        return {
          id: crypto.randomUUID(),
          valor: String(Number(t.valor)),
          forma,
          contaId: t.conta_bancaria_id ?? "",
          dataRecebimento: data,
          txId: t.id,
          descricaoOriginal: t.descricao,
          statusOriginal: t.status,
          dataOriginal: data,
          trocaOriginal: forma === "Veículo na Troca",
        };
      });

      const pendentes = txs.filter(t => ehSaldo(t) && t.status !== "Pago");
      if (pendentes.length > 0) {
        setSaldoParcelas(String(pendentes.length));
        setSaldoVencimento(pendentes[0].data_vencimento);
      }

      const totalTx = txs.reduce((s, t) => s + Number(t.valor), 0);
      const valor = Number(veiculo.valor_venda) > 0 ? Number(veiculo.valor_venda) : totalTx;
      setValorVenda(valor > 0 ? String(valor) : "");

      if (linhas.length > 0) {
        setPagamentos(linhas);
      } else if (txs.length === 0 && valor > 0) {
        // Venda marcada como "Vendido" sem passar pelo diálogo: não tem
        // lançamento nenhum. Parte do que está no cadastro do veículo.
        const forma = veiculo.forma_pagamento && formasPagamento.includes(veiculo.forma_pagamento) ? veiculo.forma_pagamento : "PIX";
        setPagamentos([{ ...novaLinha(), valor: String(valor), forma, dataRecebimento: veiculo.data_venda ?? hojeISO() }]);
      }
      setCarregandoVenda(false);
    })();
  }, [editando, veiculo]);

  const precisaConta = pagamentos.some(p => p.forma !== "Veículo na Troca");
  const semContas = contasLoaded && contas.length === 0 && precisaConta;

  const totalParcelasPagas = parcelasPagas.reduce((s, t) => s + Number(t.valor), 0);
  const totalPagamentos = pagamentos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0) + totalParcelasPagas;
  const vendaNum = parseFloat(valorVenda) || 0;
  const restante = vendaNum - totalPagamentos;
  const parcelasSaldo = restante > 0.01 ? gerarParcelasSaldo(restante, parseInt(saldoParcelas) || 1, saldoVencimento) : [];

  function addLinha() { setPagamentos([...pagamentos, novaLinha()]); }
  function removeLinha(id: string) { setPagamentos(pagamentos.filter(p => p.id !== id)); }
  function updateLinha(id: string, field: keyof PagamentoLinha, value: string) {
    setPagamentos(pagamentos.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  // Troca que ainda precisa cadastrar o veículo recebido. Na edição, a troca
  // que já existia mantém o veículo que foi cadastrado na época.
  const trocaJaCadastrada = (p: PagamentoLinha) => p.forma === "Veículo na Troca" && !!p.trocaOriginal;
  const tradeInLinhas = pagamentos.filter(p => p.forma === "Veículo na Troca" && !p.trocaOriginal);
  const hasTradeIn = tradeInLinhas.length > 0;

  async function handleVenda(e: React.FormEvent) {
    e.preventDefault();
    if (loading || carregandoVenda) return; // proteção extra contra double-submit
    const validation = validateVenda(valorVenda, pagamentos, totalParcelasPagas);
    if (!validation.ok) {
      toast.error(validation.error!);
      return;
    }
    setLoading(true);

    // 1. Monta as transações. Pagamento com data futura (ex.: PIX combinado
    // pra semana que vem) entra como Pendente — só o que já caiu conta como
    // pago no contrato. Na edição, o que já tinha recebido baixa e não mudou
    // de data continua Pago.
    const hoje = hojeISO();
    const temSaldo = parcelasSaldo.length > 0 || parcelasPagas.length > 0;
    const linhaSimples = pagamentos.length === 1 && !temSaldo;
    const transacoes = pagamentos.map((p, i) => {
      const manterPago = p.statusOriginal === "Pago" && p.dataRecebimento === p.dataOriginal;
      const aReceber = !manterPago && (p.forma === "Financiamento Banco" || (p.forma !== "Veículo na Troca" && p.dataRecebimento > hoje));
      return {
        id: p.txId,
        descricao: trocaJaCadastrada(p)
          ? p.descricaoOriginal!
          : linhaSimples
            ? `Venda ${veiculo.placa}${p.forma === "Veículo na Troca" ? " (troca)" : ""}`
            : `Venda ${veiculo.placa} — ${p.forma} (${i + 1}/${pagamentos.length})`,
        valor: parseFloat(p.valor) || 0,
        tipo: "Receita" as const,
        status: aReceber ? "Pendente" : "Pago",
        data_vencimento: p.dataRecebimento,
        data_pagamento: aReceber ? null : p.dataRecebimento,
        conta_bancaria_id: p.forma === "Veículo na Troca" ? null : (p.contaId || null),
        centro_custo_id: veiculo.centro_custo_id,
        veiculo_id: veiculo.id,
        categoria: p.forma === "Veículo na Troca" ? "Troca de Veículo" : "Venda de Veículo",
        forma_pagamento: p.forma,
        parcela_atual: null as number | null,
        total_parcelas: null as number | null,
        user_id: user?.id,
      };
    });

    // Parcelas do saldo reaproveitam as linhas pendentes que já existiam.
    parcelasSaldo.forEach((parc, i) => {
      transacoes.push({
        id: saldoPendenteOriginal[i]?.id,
        descricao: `Venda ${veiculo.placa} — Saldo devedor${parc.total > 1 ? ` (parcela ${parc.numero}/${parc.total})` : ""}`,
        valor: parc.valor,
        tipo: "Receita" as const,
        status: "Pendente",
        data_vencimento: parc.data_vencimento,
        data_pagamento: null,
        conta_bancaria_id: null,
        centro_custo_id: veiculo.centro_custo_id,
        veiculo_id: veiculo.id,
        categoria: "Venda de Veículo (Saldo)",
        forma_pagamento: "Saldo devedor",
        parcela_atual: parc.numero,
        total_parcelas: parc.total,
        user_id: user?.id,
      });
    });

    const novas = transacoes.filter(t => !t.id).map(({ id: _id, ...t }) => t);
    const alteradas = transacoes.filter(t => t.id).map(({ user_id: _u, ...t }) => t);
    const idsUsados = new Set(transacoes.map(t => t.id).filter(Boolean));
    const removidas = txOriginais.filter(t => !idsUsados.has(t.id) && !parcelasPagas.includes(t)).map(t => t.id);

    try {
      // 2. Insere o que é novo primeiro: se falhar, nada mudou.
      let insertedIds: string[] = [];
      if (novas.length > 0) {
        const { data: insertedTx, error: txError } = await supabase.from("transacoes").insert(novas).select("id");
        if (txError) {
          toast.error(translateError(txError));
          return;
        }
        insertedIds = insertedTx?.map((t) => t.id) ?? [];
      }

      // 3. Marca veículo como Vendido. Se falhar, faz rollback das transações novas.
      const { error: veicError } = await supabase
        .from("veiculos")
        .update({
          status: "Vendido",
          cliente_venda_id: clienteVendaId,
          valor_venda: vendaNum,
          data_venda: editando ? (veiculo.data_venda ?? hoje) : hoje,
        })
        .eq("id", veiculo.id);

      if (veicError) {
        if (insertedIds.length > 0) await supabase.from("transacoes").delete().in("id", insertedIds);
        toast.error("Não foi possível marcar o veículo como vendido: " + translateError(veicError));
        return;
      }

      // 4. Edição: atualiza as linhas mantidas e apaga as que saíram.
      if (alteradas.length > 0) {
        const results = await Promise.all(alteradas.map(({ id, ...t }) => supabase.from("transacoes").update(t).eq("id", id!)));
        const err = results.find(r => r.error)?.error;
        if (err) {
          toast.error("Alguns pagamentos não foram atualizados: " + translateError(err));
          return;
        }
      }
      if (removidas.length > 0) {
        const { data: apagadas, error: delError } = await supabase.from("transacoes").delete().in("id", removidas).select("id");
        // RLS sem permissão não dá erro: só não apaga. Confere a contagem.
        if (delError || (apagadas?.length ?? 0) < removidas.length) {
          toast.error("Pagamentos removidos continuam lançados — sem permissão para apagar. Peça a um administrador.");
          return;
        }
      }

      // 5. Trade-in flow: ids das transações novas de troca, na mesma ordem.
      if (hasTradeIn) {
        const novasLinhas = pagamentos.filter(p => !p.txId);
        const idsTroca = tradeInLinhas.map(l => {
          if (l.txId) return l.txId;
          return insertedIds[novasLinhas.indexOf(l)];
        });
        setTradeInTxIds(idsTroca);
        setTradeInPagamentos(tradeInLinhas);
        setCurrentTradeInIdx(0);
        setVendaConfirmada(true);
        setShowNovoVeiculo(true);
        toast.success(`${editando ? "Venda atualizada" : "Venda registrada"}! Agora cadastre o(s) veículo(s) recebido(s) na troca.`);
      } else {
        toast.success(editando ? "Pagamentos da venda atualizados!" : "Venda registrada com sucesso!");
        onClose();
      }
    } catch (err) {
      // Erro de rede/fetch (offline, timeout, extensão bloqueou). Não passa pelo error do supabase-js.
      const msg = err instanceof TypeError
        ? "Sem conexão com o servidor. Verifique sua internet ou extensões do navegador (adblock/VPN) e tente novamente."
        : `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVeiculoCadastrado(veiculoId?: string) {
    // Identifica no contrato qual veículo entrou na troca. A transação continua
    // vinculada ao veículo vendido — é ela que compõe o quadro de pagamento.
    const txId = tradeInTxIds[currentTradeInIdx];
    if (veiculoId && txId) {
      const { data: troca } = await supabase.from("veiculos").select("placa, marca_modelo").eq("id", veiculoId).single();
      if (troca) {
        const { error } = await supabase
          .from("transacoes")
          .update({ descricao: `Venda ${veiculo.placa} — Veículo na Troca: ${troca.marca_modelo} (${troca.placa})` })
          .eq("id", txId);
        if (error) console.error("Erro ao identificar veículo da troca:", error);
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
          <DialogHeader><DialogTitle>{editando ? "Editar Pagamento da Venda" : "Vender"} — {veiculo.placa}</DialogTitle></DialogHeader>
          {carregandoVenda ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando pagamentos...</p>
          ) : (
          <form onSubmit={handleVenda} className="space-y-4">
            {semContas && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-destructive">Nenhuma conta bancária cadastrada</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Toda forma de pagamento (exceto "Veículo na Troca") precisa de uma conta destino.{" "}
                    <Link to="/contas" className="underline font-medium text-destructive" onClick={onClose}>
                      Cadastrar conta agora
                    </Link>
                  </p>
                </div>
              </div>
            )}
            <ClienteSelector label="Comprador (Cliente)" value={clienteVendaId} onChange={setClienteVendaId} />
            <div><Label>Valor Total de Venda</Label><CurrencyInput value={parseFloat(valorVenda) || 0} onChange={(v) => setValorVenda(String(v))} /></div>

            {/* Pagamento Múltiplo */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Formas de Pagamento</h4>
                <Button type="button" size="sm" variant="outline" onClick={addLinha} className="gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>

              {pagamentos.map((p) => {
                return (
                <div key={p.id} className="grid grid-cols-12 gap-2 items-end border-b pb-2 last:border-0 last:pb-0">
                  <div className="col-span-3">
                    <Label className="text-xs">Forma</Label>
                    <Select value={p.forma} onValueChange={(v) => updateLinha(p.id, "forma", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{formasPagamento.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Valor</Label>
                    <CurrencyInput className="h-9" value={parseFloat(p.valor) || 0} onChange={(v) => updateLinha(p.id, "valor", String(v))} />
                  </div>
                  {p.forma !== "Veículo na Troca" ? (
                    <div className="col-span-3">
                      <Label className="text-xs">Conta Destino {contas.length > 0 && <span className="text-destructive">*</span>}</Label>
                      <Select value={p.contaId} onValueChange={(v) => updateLinha(p.id, "contaId", v)} disabled={contas.length === 0}>
                        <SelectTrigger className={`h-9 ${!p.contaId && contas.length > 0 ? "border-destructive/40" : ""}`}>
                          <SelectValue placeholder={contas.length === 0 ? "Sem contas" : "Selecione"} />
                        </SelectTrigger>
                        <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="col-span-3">
                      <Label className="text-xs text-purple-600 leading-tight block">
                        {trocaJaCadastrada(p) ? `🚗 ${rotuloPagamento(p.descricaoOriginal!).replace(/^Veículo na Troca:\s*/, "")}` : "🚗 Veículo será cadastrado após confirmar"}
                      </Label>
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
                );
              })}

              {parcelasPagas.length > 0 && (
                <div className="space-y-1">
                  {parcelasPagas.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <Lock className="h-3 w-3" /> {rotuloPagamento(t.descricao)} — recebida em {format(parseDateLocal(t.data_pagamento ?? t.data_vencimento) ?? new Date(), "dd/MM/yyyy")}
                      </span>
                      <span className="font-medium">{formatBRL(Number(t.valor))}</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">Parcelas do saldo que já receberam baixa não são alteradas aqui.</p>
                </div>
              )}

              {vendaNum > 0 && (
                <div className="flex justify-between items-center text-sm pt-2 border-t">
                  <span className="text-muted-foreground">
                    Total Venda: <strong>{formatBRL(vendaNum)}</strong>
                  </span>
                  <div className="text-right">
                    {restante < -0.01 ? (
                      <span className="text-destructive font-bold">Valor excedente inválido</span>
                    ) : restante > 0.01 ? (
                      <span className="text-amber-600 font-bold">A Receber: {formatBRL(restante)}</span>
                    ) : (
                      <span className="text-emerald-500 font-bold">✓ Fechado</span>
                    )}
                  </div>
                </div>
              )}

              {vendaNum > 0 && restante > 0.01 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                  <p className="text-sm font-semibold text-amber-700">
                    Saldo devedor do cliente: {formatBRL(restante)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Parcelas</Label>
                      <Input type="number" min={1} max={60} className="h-9" value={saldoParcelas} onChange={(e) => setSaldoParcelas(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">1º vencimento</Label>
                      <Input type="date" className="h-9" value={saldoVencimento} onChange={(e) => setSaldoVencimento(e.target.value)} required />
                    </div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {parcelasSaldo.map((parc) => (
                      <li key={parc.numero}>
                        {parc.total > 1 ? `Parcela ${parc.numero}/${parc.total}` : "Parcela única"} — {format(new Date(`${parc.data_vencimento}T12:00:00`), "dd/MM/yyyy")} — {formatBRL(parc.valor)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Vira contas a receber pendentes e sai no contrato como "A pagar", junto com o que já foi pago.
                  </p>
                </div>
              )}

              {hasTradeIn && (
                <p className="text-xs text-purple-600 bg-purple-500/10 rounded px-2 py-1">
                  ⓘ Após confirmar, será aberto o cadastro do(s) veículo(s) recebido(s) na troca com o valor já preenchido.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {editando
                ? (hasTradeIn ? "Salvar e Cadastrar Troca" : "Salvar Pagamentos")
                : (hasTradeIn ? "Confirmar Venda e Cadastrar Troca" : "Confirmar Venda")}
            </Button>
          </form>
          )}
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
