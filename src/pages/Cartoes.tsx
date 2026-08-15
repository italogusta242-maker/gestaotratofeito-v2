import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/masked-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, CreditCard } from "lucide-react";
import { addMonths, format } from "date-fns";
import { formatBRL } from "@/lib/format";
import type { Cartao, CentroCusto, Veiculo, ContaBancaria, Transacao } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

export default function Cartoes() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [showAddCartao, setShowAddCartao] = useState(false);
  const [cartaoForm, setCartaoForm] = useState({ nome: "", bandeira: "", limite: "", dia_fechamento: "1", dia_vencimento: "10" });

  // Parcela form
  const [showParcela, setShowParcela] = useState(false);
  const [parcelaCartaoId, setParcelaCartaoId] = useState("");
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [veiculos, setVeiculos] = useState<Pick<Veiculo, "id" | "placa" | "marca_modelo">[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [parcelaForm, setParcelaForm] = useState({ descricao: "", valor_total: "", numero_parcelas: "", data_primeiro_vencimento: "", centro_custo_id: "", veiculo_id: "", conta_bancaria_id: "" });

  // Transactions per card
  const [selectedCartao, setSelectedCartao] = useState<Cartao | null>(null);
  const [parcelas, setParcelas] = useState<Transacao[]>([]);

  const load = useCallback(async () => {
    const [c, cc, v, ct] = await Promise.all([
      supabase.from("cartoes").select("*").order("nome"),
      supabase.from("centros_custo").select("*"),
      supabase.from("veiculos").select("id, placa, marca_modelo").eq("status", "Em Estoque"),
      supabase.from("contas_bancarias").select("*"),
    ]);
    if (c.error) { console.error("cartoes:", c.error); toast.error("Falha ao carregar cartões"); }
    if (cc.error) console.error("centros:", cc.error);
    if (v.error) console.error("veiculos:", v.error);
    if (ct.error) console.error("contas:", ct.error);
    setCartoes(c.data ?? []);
    setCentros(cc.data ?? []);
    setVeiculos(v.data ?? []);
    setContas(ct.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addCartao(e: React.FormEvent) {
    e.preventDefault();
    const diaFech = parseInt(cartaoForm.dia_fechamento);
    const diaVenc = parseInt(cartaoForm.dia_vencimento);
    if (!cartaoForm.nome.trim()) { toast.error("Informe o nome do cartão."); return; }
    if (!(diaFech >= 1 && diaFech <= 31)) { toast.error("Dia de fechamento deve estar entre 1 e 31."); return; }
    if (!(diaVenc >= 1 && diaVenc <= 31)) { toast.error("Dia de vencimento deve estar entre 1 e 31."); return; }

    const { error } = await supabase.from("cartoes").insert({
      nome: cartaoForm.nome.trim(),
      bandeira: cartaoForm.bandeira || null,
      limite: parseFloat(cartaoForm.limite) || 0,
      dia_fechamento: diaFech,
      dia_vencimento: diaVenc,
    });
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Cartão cadastrado!");
    setShowAddCartao(false);
    setCartaoForm({ nome: "", bandeira: "", limite: "", dia_fechamento: "1", dia_vencimento: "10" });
    load();
  }

  const loadParcelas = useCallback(async (cartaoId: string) => {
    const cartao = cartoes.find((c) => c.id === cartaoId);
    setSelectedCartao(cartao ?? null);
    const { data, error } = await supabase.from("transacoes").select("*").eq("cartao_id", cartaoId).order("data_vencimento");
    if (error) { toast.error(translateError(error)); return; }
    setParcelas(data ?? []);
  }, [cartoes]);

  async function criarParcelas(e: React.FormEvent) {
    e.preventDefault();
    const valorTotal = parseFloat(parcelaForm.valor_total);
    const numParcelas = parseInt(parcelaForm.numero_parcelas);
    if (!parcelaForm.descricao.trim()) { toast.error("Informe a descrição."); return; }
    if (!(valorTotal > 0)) { toast.error("Valor total deve ser maior que zero."); return; }
    if (!(numParcelas >= 1 && numParcelas <= 60)) { toast.error("Número de parcelas deve ser entre 1 e 60."); return; }
    if (!parcelaForm.data_primeiro_vencimento) { toast.error("Informe a data do primeiro vencimento."); return; }

    const valorParcela = Math.round((valorTotal / numParcelas) * 100) / 100;
    const dataBase = new Date(parcelaForm.data_primeiro_vencimento + "T12:00:00");
    if (Number.isNaN(dataBase.getTime())) { toast.error("Data inválida."); return; }

    const inserts = [];
    for (let i = 0; i < numParcelas; i++) {
      const vencimento = addMonths(dataBase, i);
      inserts.push({
        descricao: `${parcelaForm.descricao.trim()} (${i + 1}/${numParcelas})`,
        valor: i === numParcelas - 1 ? Math.round((valorTotal - valorParcela * (numParcelas - 1)) * 100) / 100 : valorParcela,
        tipo: "Despesa",
        status: "Pendente",
        data_vencimento: format(vencimento, "yyyy-MM-dd"),
        cartao_id: parcelaCartaoId,
        centro_custo_id: parcelaForm.centro_custo_id || null,
        veiculo_id: parcelaForm.veiculo_id || null,
        conta_bancaria_id: parcelaForm.conta_bancaria_id || null,
        categoria: "Cartão de Crédito",
        parcela_atual: i + 1,
        total_parcelas: numParcelas,
        user_id: user?.id,
      });
    }

    const { error } = await supabase.from("transacoes").insert(inserts);
    if (error) { toast.error(translateError(error)); return; }
    toast.success(`${numParcelas} parcelas geradas com sucesso!`);
    setShowParcela(false);
    setParcelaForm({ descricao: "", valor_total: "", numero_parcelas: "", data_primeiro_vencimento: "", centro_custo_id: "", veiculo_id: "", conta_bancaria_id: "" });
    if (selectedCartao?.id === parcelaCartaoId) loadParcelas(parcelaCartaoId);
  }

  async function pagarParcela(id: string) {
    const { error } = await supabase
      .from("transacoes")
      .update({ status: "Pago", data_pagamento: new Date().toISOString().split("T")[0] })
      .eq("id", id);
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Parcela paga!");
    if (selectedCartao) loadParcelas(selectedCartao.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cartões de Crédito</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={showAddCartao} onOpenChange={setShowAddCartao}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" /> Novo Cartão</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Cartão</DialogTitle></DialogHeader>
                <form onSubmit={addCartao} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome</Label><Input value={cartaoForm.nome} onChange={(e) => setCartaoForm({ ...cartaoForm, nome: e.target.value })} required /></div>
                    <div><Label>Bandeira</Label><Input value={cartaoForm.bandeira} onChange={(e) => setCartaoForm({ ...cartaoForm, bandeira: e.target.value })} placeholder="Visa, Master..." /></div>
                    <div><Label>Limite</Label><CurrencyInput value={parseFloat(cartaoForm.limite) || 0} onChange={(v) => setCartaoForm({ ...cartaoForm, limite: String(v) })} /></div>
                    <div><Label>Dia Fechamento</Label><Input type="number" min="1" max="31" value={cartaoForm.dia_fechamento} onChange={(e) => setCartaoForm({ ...cartaoForm, dia_fechamento: e.target.value })} /></div>
                    <div><Label>Dia Vencimento</Label><Input type="number" min="1" max="31" value={cartaoForm.dia_vencimento} onChange={(e) => setCartaoForm({ ...cartaoForm, dia_vencimento: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="w-full">Salvar</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {isAdmin && (
            <Dialog open={showParcela} onOpenChange={setShowParcela}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Compra Parcelada</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nova Compra Parcelada</DialogTitle></DialogHeader>
                <form onSubmit={criarParcelas} className="space-y-3">
                  <div><Label>Cartão</Label>
                    <Select value={parcelaCartaoId} onValueChange={setParcelaCartaoId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                      <SelectContent>{cartoes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Descrição</Label><Input value={parcelaForm.descricao} onChange={(e) => setParcelaForm({ ...parcelaForm, descricao: e.target.value })} required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Valor Total</Label><CurrencyInput value={parseFloat(parcelaForm.valor_total) || 0} onChange={(v) => setParcelaForm({ ...parcelaForm, valor_total: String(v) })} /></div>
                    <div><Label>Nº de Parcelas</Label><Input type="number" min="1" value={parcelaForm.numero_parcelas} onChange={(e) => setParcelaForm({ ...parcelaForm, numero_parcelas: e.target.value })} required /></div>
                  </div>
                  <div><Label>Data 1º Vencimento</Label><Input type="date" value={parcelaForm.data_primeiro_vencimento} onChange={(e) => setParcelaForm({ ...parcelaForm, data_primeiro_vencimento: e.target.value })} required /></div>
                  <div><Label>Centro de Custo</Label>
                    <Select value={parcelaForm.centro_custo_id} onValueChange={(v) => setParcelaForm({ ...parcelaForm, centro_custo_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>{centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Veículo (opcional)</Label>
                    <Select value={parcelaForm.veiculo_id} onValueChange={(v) => setParcelaForm({ ...parcelaForm, veiculo_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>{veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.marca_modelo}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Conta Bancária</Label>
                    <Select value={parcelaForm.conta_bancaria_id} onValueChange={(v) => setParcelaForm({ ...parcelaForm, conta_bancaria_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={!parcelaCartaoId}>Gerar Parcelas</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cartoes.map(c => (
          <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => loadParcelas(c.id)}>
            <CardContent className="flex items-center gap-3 p-4">
              <CreditCard className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.bandeira ?? ""} • Fech. dia {c.dia_fechamento} • Venc. dia {c.dia_vencimento}</p>
                {c.limite > 0 && <p className="text-xs text-muted-foreground">Limite: {formatBRL(Number(c.limite))}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
        {cartoes.length === 0 && <p className="text-sm text-muted-foreground col-span-3 text-center py-8">Nenhum cartão cadastrado.</p>}
      </div>

      {selectedCartao && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Parcelas — {selectedCartao.nome}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
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
                    <TableCell className="text-sm">{p.descricao}</TableCell>
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
                        {p.status === "Pendente" && (
                          <Button size="sm" variant="ghost" onClick={() => pagarParcela(p.id)}>Pagar</Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {parcelas.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma parcela.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
