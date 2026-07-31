import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Landmark } from "lucide-react";
import { addMonths, format } from "date-fns";
import { formatBRL } from "@/lib/format";
import type { Financiamento, CentroCusto, Veiculo, ContaBancaria, Transacao } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

type FinanciamentoComRelacoes = Financiamento & {
  veiculos: { placa: string; marca_modelo: string } | null;
  centros_custo: { nome: string } | null;
  contas_bancarias: { nome: string } | null;
};

export default function Financiamentos() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [financiamentos, setFinanciamentos] = useState<FinanciamentoComRelacoes[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [veiculos, setVeiculos] = useState<Pick<Veiculo, "id" | "placa" | "marca_modelo">[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [form, setForm] = useState({ descricao: "", valor_total: "", valor_parcela: "", total_parcelas: "", taxa_juros: "", data_inicio: "", veiculo_id: "", centro_custo_id: "", conta_bancaria_id: "" });

  // Detail view
  const [selected, setSelected] = useState<FinanciamentoComRelacoes | null>(null);
  const [parcelas, setParcelas] = useState<Transacao[]>([]);
  const [showAntecipar, setShowAntecipar] = useState(false);
  const [qtdAntecipar, setQtdAntecipar] = useState("1");

  useEffect(() => { load(); }, []);

  async function load() {
    const [f, cc, v, ct] = await Promise.all([
      supabase.from("financiamentos").select("*, veiculos(placa, marca_modelo), centros_custo(nome), contas_bancarias(nome)").order("created_at", { ascending: false }),
      supabase.from("centros_custo").select("*"),
      supabase.from("veiculos").select("id, placa, marca_modelo"),
      supabase.from("contas_bancarias").select("*"),
    ]);
    setFinanciamentos(f.data ?? []);
    setCentros(cc.data ?? []);
    setVeiculos(v.data ?? []);
    setContas(ct.data ?? []);
  }

  async function addFinanciamento(e: React.FormEvent) {
    e.preventDefault();
    const totalParcelas = parseInt(form.total_parcelas);
    const valorParcela = parseFloat(form.valor_parcela);
    const dataInicio = new Date(form.data_inicio + "T12:00:00");

    // Create financiamento
    const { data: fin, error } = await supabase.from("financiamentos").insert({
      descricao: form.descricao,
      valor_total: parseFloat(form.valor_total),
      valor_parcela: valorParcela,
      total_parcelas: totalParcelas,
      taxa_juros: parseFloat(form.taxa_juros) || 0,
      data_inicio: form.data_inicio,
      veiculo_id: form.veiculo_id || null,
      centro_custo_id: form.centro_custo_id || null,
      conta_bancaria_id: form.conta_bancaria_id || null,
    }).select().single();
    if (error) { toast.error(translateError(error)); return; }

    // Generate all parcels as transacoes
    const inserts = [];
    for (let i = 0; i < totalParcelas; i++) {
      const vencimento = addMonths(dataInicio, i);
      inserts.push({
        descricao: `${form.descricao} (${i + 1}/${totalParcelas})`,
        valor: valorParcela,
        tipo: "Despesa",
        status: "Pendente",
        data_vencimento: format(vencimento, "yyyy-MM-dd"),
        financiamento_id: fin.id,
        centro_custo_id: form.centro_custo_id || null,
        veiculo_id: form.veiculo_id || null,
        conta_bancaria_id: form.conta_bancaria_id || null,
        categoria: "Financiamento",
        parcela_atual: i + 1,
        total_parcelas: totalParcelas,
        user_id: user?.id,
      });
    }
    await supabase.from("transacoes").insert(inserts);
    toast.success(`Financiamento criado com ${totalParcelas} parcelas!`);
    setShowAdd(false);
    setForm({ descricao: "", valor_total: "", valor_parcela: "", total_parcelas: "", taxa_juros: "", data_inicio: "", veiculo_id: "", centro_custo_id: "", conta_bancaria_id: "" });
    load();
  }

  async function selectFin(fin: FinanciamentoComRelacoes) {
    setSelected(fin);
    const { data } = await supabase.from("transacoes").select("*").eq("financiamento_id", fin.id).order("data_vencimento");
    setParcelas(data ?? []);
  }

  async function pagarParcela(id: string) {
    await supabase.from("transacoes").update({ status: "Pago", data_pagamento: new Date().toISOString().split("T")[0] }).eq("id", id);
    toast.success("Parcela paga!");
    if (selected) selectFin(selected);
  }

  async function anteciparParcelas() {
    const pendentes = parcelas.filter(p => p.status === "Pendente").sort((a, b) => a.parcela_atual - b.parcela_atual);
    const qtd = Math.min(parseInt(qtdAntecipar), pendentes.length);
    const ids = pendentes.slice(0, qtd).map(p => p.id);
    const hoje = new Date().toISOString().split("T")[0];

    for (const id of ids) {
      await supabase.from("transacoes").update({ status: "Pago", data_pagamento: hoje }).eq("id", id);
    }

    // Check if all paid → mark as Quitado
    const totalPagas = parcelas.filter(p => p.status === "Pago").length + qtd;
    if (totalPagas >= (selected?.total_parcelas ?? 0)) {
      await supabase.from("financiamentos").update({ status: "Quitado" }).eq("id", selected.id);
    }

    toast.success(`${qtd} parcela(s) antecipada(s)!`);
    setShowAntecipar(false);
    load();
    if (selected) selectFin(selected);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financiamentos / Empréstimos</h1>
        {isAdmin && (
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo Financiamento</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo Financiamento</DialogTitle></DialogHeader>
              <form onSubmit={addFinanciamento} className="space-y-3">
                <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor Total</Label><Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} required /></div>
                  <div><Label>Valor Parcela</Label><Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => setForm({ ...form, valor_parcela: e.target.value })} required /></div>
                  <div><Label>Total Parcelas</Label><Input type="number" min="1" value={form.total_parcelas} onChange={(e) => setForm({ ...form, total_parcelas: e.target.value })} required /></div>
                  <div><Label>Taxa Juros (%)</Label><Input type="number" step="0.01" value={form.taxa_juros} onChange={(e) => setForm({ ...form, taxa_juros: e.target.value })} /></div>
                </div>
                <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} required /></div>
                <div><Label>Veículo (opcional)</Label>
                  <Select value={form.veiculo_id} onValueChange={(v) => setForm({ ...form, veiculo_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>{veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.marca_modelo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Centro de Custo</Label>
                  <Select value={form.centro_custo_id} onValueChange={(v) => setForm({ ...form, centro_custo_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Conta Bancária</Label>
                  <Select value={form.conta_bancaria_id} onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Criar Financiamento</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {financiamentos.map(f => {
          const pagas = parcelas.length > 0 && selected?.id === f.id ? parcelas.filter(p => p.status === "Pago").length : 0;
          const saldoDevedor = Number(f.valor_parcela) * (f.total_parcelas - pagas);
          const pct = selected?.id === f.id ? (pagas / f.total_parcelas) * 100 : 0;

          return (
            <Card key={f.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => selectFin(f)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Landmark className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold">{f.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.veiculos ? `${f.veiculos.placa} — ${f.veiculos.marca_modelo}` : f.centros_custo?.nome ?? ""}
                        {f.contas_bancarias ? ` • ${f.contas_bancarias.nome}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={f.status === "Quitado" ? "default" : "outline"}>{f.status}</Badge>
                    <p className="text-sm font-medium mt-1">{formatBRL(Number(f.valor_parcela))} × {f.total_parcelas}x</p>
                  </div>
                </div>
                {selected?.id === f.id && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{pagas}/{f.total_parcelas} pagas</span>
                      <span>Saldo: {formatBRL(saldoDevedor)}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {financiamentos.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum financiamento cadastrado.</p>}
      </div>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Parcelas — {selected.descricao}</CardTitle>
            {isAdmin && parcelas.some(p => p.status === "Pendente") && (
              <Dialog open={showAntecipar} onOpenChange={setShowAntecipar}>
                <DialogTrigger asChild><Button size="sm" variant="outline">Antecipar Parcelas</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Antecipar Parcelas</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Quantas parcelas antecipar?</Label><Input type="number" min="1" max={parcelas.filter(p => p.status === "Pendente").length} value={qtdAntecipar} onChange={(e) => setQtdAntecipar(e.target.value)} /></div>
                    <p className="text-sm text-muted-foreground">Valor total: {formatBRL(Number(selected.valor_parcela) * parseInt(qtdAntecipar || "0"))}</p>
                    <Button onClick={anteciparParcelas} className="w-full">Confirmar Antecipação</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead>Ação</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{p.parcela_atual}/{p.total_parcelas}</TableCell>
                    <TableCell className="text-sm">{format(new Date(p.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-sm font-medium">{formatBRL(Number(p.valor))}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "Pago" ? "default" : new Date(p.data_vencimento) < new Date() ? "destructive" : "outline"}>
                        {p.status === "Pendente" && new Date(p.data_vencimento) < new Date() ? "Atrasado" : p.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {p.status === "Pendente" && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); pagarParcela(p.id); }}>Pagar</Button>}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
