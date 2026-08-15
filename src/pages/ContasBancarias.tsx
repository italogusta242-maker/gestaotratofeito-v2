import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/masked-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Building2, ArrowRightLeft, Key, Pencil, Trash2, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/format";
import type { ContaBancaria, ChavePix, Transacao } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

const TIPOS_CHAVE_PIX = ["CPF", "CNPJ", "Email", "Telefone", "Aleatória"] as const;

export default function ContasBancarias() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [chavesPix, setChavesPix] = useState<ChavePix[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showTrans, setShowTrans] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [editingPix, setEditingPix] = useState<ChavePix | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "Corrente", saldo_inicial: "" });
  const [pixForm, setPixForm] = useState({ tipo: "CPF", chave: "", titular: "", conta_bancaria_id: "", ativa: true });
  const [transForm, setTransForm] = useState({ origemId: "", destinoId: "", valor: "", data: new Date().toISOString().split("T")[0], descricao: "Transferência" });
  const [selectedConta, setSelectedConta] = useState<ContaBancaria | null>(null);
  const [txs, setTxs] = useState<Transacao[]>([]);
  const [allTxs, setAllTxs] = useState<Pick<Transacao, "valor" | "tipo" | "conta_bancaria_id">[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { user, role } = useAuth();
  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    const [contasRes, txRes, pixRes] = await Promise.all([
      supabase.from("contas_bancarias").select("*").order("nome"),
      supabase.from("transacoes").select("valor, tipo, conta_bancaria_id").eq("status", "Pago").not("conta_bancaria_id", "is", null),
      supabase.from("chaves_pix").select("*").order("created_at"),
    ]);
    if (contasRes.error) { console.error("contas_bancarias:", contasRes.error); toast.error("Falha ao carregar contas bancárias"); }
    if (txRes.error) console.error("transacoes:", txRes.error);
    if (pixRes.error) console.error("chaves_pix:", pixRes.error);
    setContas(contasRes.data ?? []);
    setAllTxs(txRes.data ?? []);
    setChavesPix(pixRes.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadTxs(contaId: string) {
    const { data, error } = await supabase.from("transacoes").select("*").eq("conta_bancaria_id", contaId).order("created_at", { ascending: false }).limit(50);
    if (error) { console.error("transacoes histórico:", error); toast.error(translateError(error)); return; }
    setTxs(data ?? []);
  }

  async function addConta(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const nome = form.nome.trim();
    if (!nome) { toast.error("Informe o nome da conta."); return; }
    const saldoInicial = form.saldo_inicial === "" ? 0 : parseFloat(form.saldo_inicial);
    if (Number.isNaN(saldoInicial)) { toast.error("Saldo inicial inválido."); return; }
    setSubmitting(true);
    const { error } = await supabase.from("contas_bancarias").insert({ nome, tipo: form.tipo, saldo_inicial: saldoInicial });
    setSubmitting(false);
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
    if (submitting) return;
    if (!transForm.origemId || !transForm.destinoId) { toast.error("Selecione as contas de origem e destino."); return; }
    if (transForm.origemId === transForm.destinoId) { toast.error("Conta origem e destino devem ser diferentes."); return; }
    const txValor = parseFloat(transForm.valor);
    if (Number.isNaN(txValor) || txValor <= 0) { toast.error("Valor inválido."); return; }
    if (!transForm.data || !/^\d{4}-\d{2}-\d{2}$/.test(transForm.data)) { toast.error("Data inválida."); return; }
    const descricao = transForm.descricao.trim();
    if (!descricao) { toast.error("Informe a descrição."); return; }

    const txsInsert = [
      {
        descricao,
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
        descricao,
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

    setSubmitting(true);
    const { error } = await supabase.from("transacoes").insert(txsInsert);
    setSubmitting(false);
    if (error) { toast.error(translateError(error)); return; }

    toast.success("Transferência realizada com sucesso!");
    setShowTrans(false);
    setTransForm({ origemId: "", destinoId: "", valor: "", data: new Date().toISOString().split("T")[0], descricao: "Transferência" });
    if (selectedConta) loadTxs(selectedConta.id);
    load();
  }

  function openAddPix() {
    setEditingPix(null);
    setPixForm({ tipo: "CPF", chave: "", titular: "", conta_bancaria_id: "", ativa: true });
    setShowPix(true);
  }

  function openEditPix(p: ChavePix) {
    setEditingPix(p);
    setPixForm({
      tipo: p.tipo,
      chave: p.chave,
      titular: p.titular ?? "",
      conta_bancaria_id: p.conta_bancaria_id ?? "",
      ativa: p.ativa,
    });
    setShowPix(true);
  }

  async function submitPix(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const chave = pixForm.chave.trim();
    if (!chave) { toast.error("Informe a chave PIX."); return; }
    const payload = {
      tipo: pixForm.tipo,
      chave,
      titular: pixForm.titular.trim() || null,
      conta_bancaria_id: pixForm.conta_bancaria_id || null,
      ativa: pixForm.ativa,
    };
    setSubmitting(true);
    const req = editingPix
      ? supabase.from("chaves_pix").update(payload).eq("id", editingPix.id)
      : supabase.from("chaves_pix").insert(payload);
    const { error } = await req;
    setSubmitting(false);
    if (error) { toast.error(translateError(error)); return; }
    toast.success(editingPix ? "Chave PIX atualizada!" : "Chave PIX criada!");
    setShowPix(false);
    load();
  }

  async function deletePix(p: ChavePix) {
    if (!window.confirm(`Excluir a chave PIX "${p.chave}"?`)) return;
    const { error } = await supabase.from("chaves_pix").delete().eq("id", p.id);
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Chave PIX excluída.");
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
                <div><Label>Valor</Label><CurrencyInput value={parseFloat(transForm.valor) || 0} onChange={(v) => setTransForm({ ...transForm, valor: String(v) })} /></div>
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
                      <SelectItem value="Poupança">Poupança</SelectItem>
                      <SelectItem value="Espécie">Espécie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Saldo Inicial</Label><CurrencyInput value={parseFloat(form.saldo_inicial) || 0} onChange={(v) => setForm({ ...form, saldo_inicial: String(v) })} /></div>
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

      {/* Seção Chaves PIX */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" /> Chaves PIX
          </CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={openAddPix}>
              <Plus className="h-4 w-4 mr-1" /> Nova Chave PIX
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {chavesPix.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma chave PIX cadastrada. As chaves aparecerão nos contratos e recibos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Conta Vinculada</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {chavesPix.map(p => {
                  const contaLigada = contas.find(c => c.id === p.conta_bancaria_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.tipo}</TableCell>
                      <TableCell className="font-mono text-xs">{p.chave}</TableCell>
                      <TableCell>{p.titular ?? "—"}</TableCell>
                      <TableCell>
                        {contaLigada ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <LinkIcon className="h-3 w-3 text-muted-foreground" />
                            {contaLigada.nome}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem vínculo</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.ativa
                          ? <span className="text-xs text-emerald-600 font-medium">Ativa</span>
                          : <span className="text-xs text-muted-foreground">Inativa</span>}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openEditPix(p)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deletePix(p)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Chave PIX */}
      <Dialog open={showPix} onOpenChange={setShowPix}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPix ? "Editar Chave PIX" : "Nova Chave PIX"}</DialogTitle></DialogHeader>
          <form onSubmit={submitPix} className="space-y-3">
            <div>
              <Label>Tipo da Chave</Label>
              <Select value={pixForm.tipo} onValueChange={(v) => setPixForm({ ...pixForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CHAVE_PIX.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave</Label>
              <Input value={pixForm.chave} onChange={(e) => setPixForm({ ...pixForm, chave: e.target.value })} required placeholder={
                pixForm.tipo === "CPF" ? "000.000.000-00" :
                pixForm.tipo === "CNPJ" ? "00.000.000/0000-00" :
                pixForm.tipo === "Email" ? "email@exemplo.com" :
                pixForm.tipo === "Telefone" ? "+55 61 90000-0000" :
                "chave aleatória UUID"
              } />
            </div>
            <div>
              <Label>Titular da Chave</Label>
              <Input value={pixForm.titular} onChange={(e) => setPixForm({ ...pixForm, titular: e.target.value })} placeholder="Ex: Meu Carro Online LTDA" />
            </div>
            <div>
              <Label>Conta Bancária Vinculada</Label>
              <Select value={pixForm.conta_bancaria_id || "__none__"} onValueChange={(v) => setPixForm({ ...pixForm, conta_bancaria_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem vínculo</SelectItem>
                  {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Você pode mudar o vínculo depois — útil quando trocar a chave PIX de banco.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pix-ativa"
                checked={pixForm.ativa}
                onChange={(e) => setPixForm({ ...pixForm, ativa: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="pix-ativa" className="cursor-pointer">Chave ativa</Label>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Salvando..." : (editingPix ? "Atualizar" : "Criar Chave")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
