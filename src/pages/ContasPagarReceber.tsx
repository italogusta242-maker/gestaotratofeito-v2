import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Clock, DollarSign, Undo2, Printer, X, Receipt } from "lucide-react";
import { format, isToday, isBefore, startOfDay, differenceInDays, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GenericReceipt from "@/components/GenericReceipt";
import { formatBRL } from "@/lib/format";
import type { Transacao, ContaBancaria, CentroCusto } from "@/lib/db-types";

type TransacaoComRelacoes = Transacao & {
  centros_custo: { nome: string } | null;
  contas_bancarias: { nome: string } | null;
  veiculos: { placa: string; marca_modelo: string; ano: number | null; cor: string | null } | null;
};

export default function ContasPagarReceber() {
  const [transacoes, setTransacoes] = useState<TransacaoComRelacoes[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [filterConta, setFilterConta] = useState("all");
  const [filterCentro, setFilterCentro] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [tab, setTab] = useState("pendentes");
  const [innerTab, setInnerTab] = useState("pagar");
  const [receiptTx, setReceiptTx] = useState<TransacaoComRelacoes | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [tx, c, cc] = await Promise.all([
      supabase.from("transacoes").select("*, centros_custo(nome), contas_bancarias(nome), veiculos(placa, marca_modelo, ano, cor)").order("data_vencimento"),
      supabase.from("contas_bancarias").select("*"),
      supabase.from("centros_custo").select("*"),
    ]);
    setTransacoes(tx.data ?? []);
    setContas(c.data ?? []);
    setCentros(cc.data ?? []);
  }

  async function marcarPago(id: string) {
    await supabase.from("transacoes").update({ status: "Pago", data_pagamento: new Date().toISOString().split("T")[0] }).eq("id", id);
    toast.success("Marcado como pago!");
    load();
  }

  async function estornar(id: string) {
    await supabase.from("transacoes").update({ status: "Pendente", data_pagamento: null }).eq("id", id);
    toast.success("Pagamento estornado!");
    load();
  }

  function calculateLateCharges(valor: number, vencimento: string) {
    const dVenc = startOfDay(parseISO(vencimento));
    const dHoje = startOfDay(new Date());
    if (!isBefore(dVenc, dHoje)) return { multa: 0, juros: 0, total: valor };

    const diasAtraso = differenceInDays(dHoje, dVenc);
    const multa = valor * 0.02; // 2% fixo
    const jurosMensal = 0.01; // 1% ao mês
    const jurosDiario = jurosMensal / 30;
    const juros = valor * jurosDiario * diasAtraso;

    return { multa, juros, total: valor + multa + juros, diasAtraso };
  }

  function getStatusLabel(vencimento: string, status: string) {
    if (status === "Pago") return "Pago";
    const d = new Date(vencimento + "T12:00:00");
    if (isToday(d)) return "Vence Hoje";
    if (isBefore(d, startOfDay(new Date()))) return "Atrasado";
    return "Pendente";
  }

  function getStatusVariant(label: string): "destructive" | "default" | "outline" {
    if (label === "Atrasado") return "destructive";
    if (label === "Vence Hoje") return "default";
    return "outline";
  }

  const filtered = transacoes
    .filter(tx => tab === "pendentes" ? tx.status === "Pendente" : tx.status === "Pago")
    .filter(tx => innerTab === "pagar" ? tx.tipo === "Despesa" : tx.tipo === "Receita")
    .filter(tx => filterConta === "all" || tx.conta_bancaria_id === filterConta)
    .filter(tx => filterCentro === "all" || tx.centro_custo_id === filterCentro)
    .filter(tx => {
      if (filterStatus === "all") return true;
      const s = getStatusLabel(tx.data_vencimento, tx.status);
      return s === filterStatus;
    });

  const totalPagar = transacoes.filter(t => t.tipo === "Despesa" && t.status === "Pendente").reduce((s, t) => s + Number(t.valor), 0);
  const totalReceber = transacoes.filter(t => t.tipo === "Receita" && t.status === "Pendente").reduce((s, t) => s + Number(t.valor), 0);
  const totalAtrasado = transacoes.filter(t => t.status === "Pendente" && getStatusLabel(t.data_vencimento, t.status) === "Atrasado").reduce((s, t) => s + Number(t.valor), 0);
  const totalHoje = transacoes.filter(t => t.status === "Pendente" && getStatusLabel(t.data_vencimento, t.status) === "Vence Hoje").reduce((s, t) => s + Number(t.valor), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Contas a Pagar / Receber</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><AlertCircle className="h-6 w-6 text-destructive" /><div><p className="text-xs text-muted-foreground">A Pagar</p><p className="text-lg font-bold text-destructive">{formatBRL(totalPagar)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><DollarSign className="h-6 w-6 text-emerald-500" /><div><p className="text-xs text-muted-foreground">A Receber</p><p className="text-lg font-bold text-emerald-500">{formatBRL(totalReceber)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Clock className="h-6 w-6 text-amber-500" /><div><p className="text-xs text-muted-foreground">Vence Hoje</p><p className="text-lg font-bold text-amber-500">{formatBRL(totalHoje)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><AlertCircle className="h-6 w-6 text-destructive" /><div><p className="text-xs text-muted-foreground">Atrasado</p><p className="text-lg font-bold text-destructive">{formatBRL(totalAtrasado)}</p></div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterConta} onValueChange={setFilterConta}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Conta Bancária" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Contas</SelectItem>
            {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCentro} onValueChange={setFilterCentro}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Centro de Custo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Centros</SelectItem>
            {centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Atrasado">Atrasado</SelectItem>
            <SelectItem value="Vence Hoje">Vence Hoje</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="grid w-64 grid-cols-2">
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <Tabs value={innerTab} onValueChange={setInnerTab}>
            <TabsList>
              <TabsTrigger value="pagar">Contas a Pagar</TabsTrigger>
              <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
            </TabsList>

            <TabsContent value={innerTab} className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Vencimento</TableHead>
                        {tab === "historico" && <TableHead>Pagamento</TableHead>}
                        <TableHead>Valor</TableHead>
                        {tab === "pendentes" && <TableHead>Encargos</TableHead>}
                        <TableHead>Centro Custo</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(tx => {
                        const statusLabel = getStatusLabel(tx.data_vencimento, tx.status);
                        const charges = calculateLateCharges(Number(tx.valor), tx.data_vencimento);

                        return (
                          <TableRow key={tx.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{tx.descricao}</span>
                                {tx.veiculos && <span className="text-[10px] text-muted-foreground uppercase">{tx.veiculos.placa} — {tx.veiculos.marca_modelo}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{format(new Date(tx.data_vencimento + "T12:00:00"), "dd/MM/yy")}</TableCell>
                            {tab === "historico" && <TableCell className="text-sm">{tx.data_pagamento ? format(new Date(tx.data_pagamento + "T12:00:00"), "dd/MM/yy") : "—"}</TableCell>}
                            <TableCell className="text-sm font-semibold">{formatBRL(Number(tx.valor))}</TableCell>
                            {tab === "pendentes" && (
                              <TableCell className="text-xs">
                                {charges.multa > 0 ? (
                                  <div className="flex flex-col text-destructive font-medium">
                                    <span>+{formatBRL(charges.multa)} (2%)</span>
                                    <span>+{formatBRL(charges.juros)} (juros)</span>
                                  </div>
                                ) : "—"}
                              </TableCell>
                            )}
                            <TableCell className="text-sm">{tx.centros_custo?.nome ?? "—"}</TableCell>
                            <TableCell className="text-sm">{tx.contas_bancarias?.nome ?? "—"}</TableCell>
                            <TableCell><Badge variant={getStatusVariant(statusLabel)}>{statusLabel}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {tx.status === "Pendente" ? (
                                  <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" onClick={() => marcarPago(tx.id)}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Baixar
                                  </Button>
                                ) : (
                                  <>
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setReceiptTx(tx)} title="Imprimir Recibo">
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" onClick={() => estornar(tx.id)} title="Estornar (Voltar para Pendentes)">
                                      <Undo2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filtered.length === 0 && <TableRow><TableCell colSpan={tab === "historico" ? 9 : 8} className="text-center py-8 text-muted-foreground italic">Nenhuma conta encontrada com esses filtros.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Tabs>

      <Dialog open={!!receiptTx} onOpenChange={(o) => !o && setReceiptTx(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <div className="no-print p-4 border-b flex justify-between bg-muted/50 sticky top-0 z-10">
            <h3 className="font-bold flex items-center gap-2"><Receipt className="h-4 w-4" /> Pré-visualização do Recibo</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setReceiptTx(null)}>Fechar</Button>
              <Button size="sm" onClick={() => window.print()} className="gap-1"><Printer className="h-4 w-4" /> Imprimir</Button>
            </div>
          </div>
          <div className="bg-white">
            {receiptTx && <GenericReceipt transacao={receiptTx} veiculo={receiptTx.veiculos} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
