import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Building2, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/format";
import type { ContaBancaria, Transacao } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

export default function ContasBancarias() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showTrans, setShowTrans] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo: "Corrente", saldo_inicial: "" });
  const [transForm, setTransForm] = useState({ origemId: "", destinoId: "", valor: "", data: new Date().toISOString().split("T")[0], descricao: "Transferência" });
  const [selectedConta, setSelectedConta] = useState<ContaBancaria | null>(null);
  const [txs, setTxs] = useState<Transacao[]>([]);
  const [allTxs, setAllTxs] = useState<Pick<Transacao, "valor" | "tipo" | "conta_bancaria_id">[]>([]);
  const { user } = useAuth();

  useEffect(() => { load(); }, []);

  async function load() {
    const [contasRes, txRes] = await Promise.all([
      supabase.from("contas_bancarias").select("*").order("nome"),
      supabase.from("transacoes").select("valor, tipo, conta_bancaria_id").eq("status", "Pago").not("conta_bancaria_id", "is", null)
    ]);
    setContas(contasRes.data ?? []);
    setAllTxs(txRes.data ?? []);
  }

  async function loadTxs(contaId: string) {
    const { data } = await supabase.from("transacoes").select("*").eq("conta_bancaria_id", contaId).order("created_at", { ascending: false }).limit(50);
    setTxs(data ?? []);
  }

  async function addConta(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("contas_bancarias").insert({ nome: form.nome, tipo: form.tipo, saldo_inicial: parseFloat(form.saldo_inicial) || 0 });
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Conta criada!");
    setShowAdd(false);
    setForm({ nome: "", tipo: "Corrente", saldo_inicial: "" });
    load();
  }

  function calcSaldo(conta: ContaBancaria) {
    const movements = allTxs.filter(t => t.conta_bancaria_id === conta.id);
    const totalIn = movements.filter(t => t.tipo === "Receita" || (t.tipo === "Transferencia_Interna" && Number(t.valor) > 0)).reduce((s, t) => s + Number(t.valor), 0);
    const totalOut = movements.filter(t => t.tipo === "Despesa" || (t.tipo === "Transferencia_Interna" && Number(t.valor) < 0)).reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
    return Number(conta.saldo_inicial) + totalIn - totalOut;
  }

  async function processTransferencia(e: React.FormEvent) {
    e.preventDefault();
    if (transForm.origemId === transForm.destinoId) { toast.error("Conta origem e destino devem ser diferentes."); return; }
    const txValor = parseFloat(transForm.valor);
    if (!txValor || txValor <= 0) { toast.error("Valor inválido."); return; }

    const txsInsert = [
      {
        descricao: transForm.descricao,
        valor: -txValor,
        tipo: "Transferencia_Interna",
        status: "Pago",
        data_vencimento: transForm.data,
        data_pagamento: transForm.data,
        conta_bancaria_id: transForm.origemId,
        user_id: user?.id,
        categoria: "Transferência",
      },
      {
        descricao: transForm.descricao,
        valor: txValor,
        tipo: "Transferencia_Interna",
        status: "Pago",
        data_vencimento: transForm.data,
        data_pagamento: transForm.data,
        conta_bancaria_id: transForm.destinoId,
        user_id: user?.id,
        categoria: "Transferência",
      }
    ];

    const { error } = await supabase.from("transacoes").insert(txsInsert);
    if (error) { toast.error(translateError(error)); return; }

    toast.success("Transferência realizada com sucesso!");
    setShowTrans(false);
    setTransForm({ origemId: "", destinoId: "", valor: "", data: new Date().toISOString().split("T")[0], descricao: "Transferência" });
    if (selectedConta) loadTxs(selectedConta.id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contas Bancárias</h1>
        <div className="flex gap-2">
          <Dialog open={showTrans} onOpenChange={setShowTrans}>
            <DialogTrigger asChild><Button variant="secondary"><ArrowRightLeft className="h-4 w-4 mr-1" /> Nova Transferência</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Transferência entre Contas</DialogTitle></DialogHeader>
              <form onSubmit={processTransferencia} className="space-y-3">
                <div><Label>Conta Origem (Saída)</Label>
                  <Select value={transForm.origemId} onValueChange={(v) => setTransForm({ ...transForm, origemId: v })} required>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Conta Destino (Entrada)</Label>
                  <Select value={transForm.destinoId} onValueChange={(v) => setTransForm({ ...transForm, destinoId: v })} required>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={transForm.valor} onChange={(e) => setTransForm({ ...transForm, valor: e.target.value })} required /></div>
                <div><Label>Data</Label><Input type="date" value={transForm.data} onChange={(e) => setTransForm({ ...transForm, data: e.target.value })} required /></div>
                <div><Label>Descrição</Label><Input value={transForm.descricao} onChange={(e) => setTransForm({ ...transForm, descricao: e.target.value })} required /></div>
                <Button type="submit" className="w-full">Confirmar Transferência</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
              <form onSubmit={addConta} className="space-y-3">
                <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required placeholder="Ex: Itaú, Nubank" /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Corrente">Corrente</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                      <SelectItem value="Espécie">Espécie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Saldo Inicial (R$)</Label><Input type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} /></div>
                <Button type="submit" className="w-full">Salvar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contas.map(c => (
          <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setSelectedConta(c); loadTxs(c.id); }}>
            <CardContent className="flex items-center gap-3 p-4">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.tipo}</p>
                <p className="text-lg font-bold">{formatBRL(calcSaldo(c))}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {contas.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Nenhuma conta cadastrada.</p>}
      </div>

      {selectedConta && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Histórico — {selectedConta.nome}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {txs.map(tx => (
                <div key={tx.id} className="flex justify-between items-center py-1.5 border-b text-sm">
                  <span>{tx.descricao}</span>
                  <span className={tx.tipo === "Receita" || Number(tx.valor) > 0 ? "text-emerald-500 font-medium" : "text-destructive font-medium"}>
                    {Number(tx.valor) > 0 ? "+" : ""}{formatBRL(Number(tx.valor))}
                  </span>
                </div>
              ))}
              {txs.length === 0 && <p className="text-sm text-muted-foreground text-center">Nenhuma transação.</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
