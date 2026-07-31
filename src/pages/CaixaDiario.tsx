import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { formatBRL } from "@/lib/format";

export default function CaixaDiario() {
  const { user, role } = useAuth();
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [periodo, setPeriodo] = useState<"Dia" | "Mês">("Dia");
  const [showForm, setShowForm] = useState(false);
  const [tipoForm, setTipoForm] = useState<"Receita" | "Despesa" | "Transferência">("Receita");
  const [destinoCusto, setDestinoCusto] = useState<"Loja" | "Veículo" | "">("");
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "", conta_bancaria_id: "", centro_custo_id: "", veiculo_id: "", parcela_atual: "", total_parcelas: "", status: "Pago" });

  useEffect(() => { loadAll(); }, [date, periodo]);

  async function loadAll() {
    let query = supabase.from("transacoes")
      .select("*, centros_custo(nome), contas_bancarias(nome)")
      .order("created_at", { ascending: false });

    if (periodo === "Dia") {
      query = query.eq("data_vencimento", date);
    } else {
      const year = date.substring(0, 4);
      const month = date.substring(5, 7);
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const monthStart = `${year}-${month}-01`;
      const monthEnd = `${year}-${month}-${lastDay}`;
      query = query.gte("data_vencimento", monthStart).lte("data_vencimento", monthEnd);
    }

    const [tx, c, cc, v] = await Promise.all([
      query,
      supabase.from("contas_bancarias").select("*"),
      supabase.from("centros_custo").select("*"),
      supabase.from("veiculos").select("id, placa, marca_modelo").not("status", "eq", "Vendido"),
    ]);
    setTransacoes(tx.data ?? []);
    setContas(c.data ?? []);
    setCentros(cc.data ?? []);
    setVeiculos(v.data ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tipoForm === "Despesa" || tipoForm === "Receita") {
      if (!destinoCusto) {
        toast.error("Por favor, selecione se a despesa/receita é da Loja ou de um Veículo.");
        return;
      }
      if (destinoCusto === "Veículo" && !form.veiculo_id) {
        toast.error("Por favor, selecione o veículo.");
        return;
      }
      if (destinoCusto === "Loja" && !form.centro_custo_id) {
        toast.error("Por favor, selecione o centro de custo da loja.");
        return;
      }
    }

    const { error } = await supabase.from("transacoes").insert({
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      tipo: tipoForm,
      status: form.status,
      data_vencimento: date,
      data_pagamento: form.status === "Pago" ? date : null,
      conta_bancaria_id: form.conta_bancaria_id || null,
      centro_custo_id: form.centro_custo_id || null,
      veiculo_id: form.veiculo_id || null,
      categoria: form.categoria || null,
      parcela_atual: form.parcela_atual ? parseInt(form.parcela_atual) : null,
      total_parcelas: form.total_parcelas ? parseInt(form.total_parcelas) : null,
      user_id: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento registrado!");
    setShowForm(false);
    setForm({ descricao: "", valor: "", categoria: "", conta_bancaria_id: "", centro_custo_id: "", veiculo_id: "", parcela_atual: "", total_parcelas: "", status: "Pago" });
    setDestinoCusto("");
    loadAll();
  }

  const pagos = transacoes.filter(t => t.status === "Pago");
  const pendentes = transacoes.filter(t => t.status !== "Pago");

  const totalReceitasPago = pagos.filter(t => t.tipo === "Receita").reduce((s, t) => s + Number(t.valor), 0);
  const totalDespesasPago = pagos.filter(t => t.tipo === "Despesa").reduce((s, t) => s + Number(t.valor), 0);
  const saldoRealizado = totalReceitasPago - totalDespesasPago;

  const totalReceitasPendente = pendentes.filter(t => t.tipo === "Receita").reduce((s, t) => s + Number(t.valor), 0);
  const totalDespesasPendente = pendentes.filter(t => t.tipo === "Despesa").reduce((s, t) => s + Number(t.valor), 0);

  const openForm = (tipo: "Receita" | "Despesa" | "Transferência") => {
    setTipoForm(tipo);
    setShowForm(true);
  };

  const filteredCentros = role === "admin" ? centros : centros.filter(c => c.nome !== "Casa/Sócios");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
        <div className="flex items-center gap-3">
          <Select value={periodo} onValueChange={(v: "Dia" | "Mês") => setPeriodo(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Dia">Por Dia</SelectItem>
              <SelectItem value="Mês">Por Mês</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type={periodo === "Dia" ? "date" : "month"}
            value={periodo === "Dia" ? date : date.substring(0, 7)}
            onChange={(e) => {
              if (periodo === "Dia") setDate(e.target.value);
              else setDate(e.target.value + "-01");
            }}
            className="w-auto"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="cursor-pointer hover:border-emerald-500/50 transition-colors" onClick={() => openForm("Receita")}>
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowUpCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-sm text-muted-foreground">Entradas (Realizado)</p>
              <p className="text-xl font-bold text-emerald-500">{formatBRL(totalReceitasPago)}</p>
              {totalReceitasPendente > 0 && <p className="text-xs text-muted-foreground mt-1">+{formatBRL(totalReceitasPendente)} a receber</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => openForm("Despesa")}>
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowDownCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Saídas (Realizado)</p>
              <p className="text-xl font-bold text-destructive">{formatBRL(totalDespesasPago)}</p>
              {totalDespesasPendente > 0 && <p className="text-xs text-muted-foreground mt-1">+{formatBRL(totalDespesasPendente)} a pagar</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors">
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowRightLeft className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Saldo do Período</p>
              <p className="text-xl font-bold">{formatBRL(saldoRealizado)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-lg flex justify-between items-center text-emerald-600">
              Pago / Recebido
              <Badge variant="outline">{pagos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[500px] overflow-auto">
              {pagos.map(tx => (
                <div key={tx.id} className="p-3 hover:bg-muted/50 transition-colors flex justify-between items-start">
                  <div>
                    <span className="font-medium text-sm">{tx.descricao}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {tx.centros_custo?.nome && <Badge variant="outline" className="text-[10px]">{tx.centros_custo.nome}</Badge>}
                      {tx.contas_bancarias?.nome && <Badge variant="secondary" className="text-[10px]">{tx.contas_bancarias.nome}</Badge>}
                      {tx.parcela_atual && <span className="text-[10px] text-muted-foreground">{tx.parcela_atual}/{tx.total_parcelas}</span>}
                      {periodo === "Mês" && <span className="text-[10px] text-muted-foreground">{format(new Date(tx.data_vencimento), "dd/MM")}</span>}
                    </div>
                  </div>
                  <span className={`font-semibold text-sm whitespace-nowrap ${tx.tipo === "Receita" ? "text-emerald-500" : tx.tipo === "Despesa" ? "text-destructive" : "text-primary"}`}>
                    {tx.tipo === "Receita" ? "+" : tx.tipo === "Despesa" ? "-" : "↔"}{formatBRL(Number(tx.valor))}
                  </span>
                </div>
              ))}
              {pagos.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento pago neste período.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-lg flex justify-between items-center text-amber-600">
              Pendentes
              <Badge variant="outline">{pendentes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[500px] overflow-auto">
              {pendentes.map(tx => (
                <div key={tx.id} className="p-3 hover:bg-muted/50 transition-colors flex justify-between items-start">
                  <div>
                    <span className="font-medium text-sm">{tx.descricao}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {tx.centros_custo?.nome && <Badge variant="outline" className="text-[10px]">{tx.centros_custo.nome}</Badge>}
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5">{tx.status}</Badge>
                      {tx.parcela_atual && <span className="text-[10px] text-muted-foreground">{tx.parcela_atual}/{tx.total_parcelas}</span>}
                      {periodo === "Mês" && <span className="text-[10px] text-muted-foreground">{format(new Date(tx.data_vencimento), "dd/MM")}</span>}
                    </div>
                  </div>
                  <span className={`font-semibold text-sm whitespace-nowrap ${tx.tipo === "Receita" ? "text-emerald-500" : tx.tipo === "Despesa" ? "text-destructive" : "text-primary"}`}>
                    {tx.tipo === "Receita" ? "+" : tx.tipo === "Despesa" ? "-" : "↔"}{formatBRL(Number(tx.valor))}
                  </span>
                </div>
              ))}
              {pendentes.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pendência neste período.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova {tipoForm}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required /></div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></div>
            <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
            <div><Label>Conta Bancária</Label>
              <Select value={form.conta_bancaria_id} onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {tipoForm !== "Transferência" && (
              <div>
                <Label>Destino do Custo/Receita</Label>
                <Select value={destinoCusto} onValueChange={(v: "Loja" | "Veículo") => {
                  setDestinoCusto(v);
                  if (v === "Veículo") setForm({ ...form, centro_custo_id: "" });
                  if (v === "Loja") setForm({ ...form, veiculo_id: "" });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o Destino" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Loja">Despesa/Receita da Loja/Escritório</SelectItem>
                    <SelectItem value="Veículo">Despesa/Receita de Veículo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {destinoCusto === "Loja" && tipoForm !== "Transferência" && (
              <div><Label>Centro de Custo</Label>
                <Select value={form.centro_custo_id} onValueChange={(v) => setForm({ ...form, centro_custo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{filteredCentros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {destinoCusto === "Veículo" && tipoForm !== "Transferência" && (
              <div><Label>Veículo</Label>
                <Select value={form.veiculo_id} onValueChange={(v) => {
                  const vhc = veiculos.find(ve => ve.id === v);
                  setForm({ ...form, veiculo_id: v, centro_custo_id: vhc?.centro_custo_id || "" });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                  <SelectContent>{veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.marca_modelo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div><Label>Parcela Atual</Label><Input type="number" value={form.parcela_atual} onChange={(e) => setForm({ ...form, parcela_atual: e.target.value })} /></div>
              <div><Label>Total Parcelas</Label><Input type="number" value={form.total_parcelas} onChange={(e) => setForm({ ...form, total_parcelas: e.target.value })} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
