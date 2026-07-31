import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, CalendarClock, RefreshCw, Pencil } from "lucide-react";
import { format } from "date-fns";
import { formatBRL } from "@/lib/format";
import type { ContaFixa, CentroCusto, ContaBancaria } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

type ContaFixaComRelacoes = ContaFixa & {
  centros_custo: { nome: string } | null;
  contas_bancarias: { nome: string } | null;
};

export default function ContasFixas() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [contasFixas, setContasFixas] = useState<ContaFixaComRelacoes[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ContaFixaComRelacoes | null>(null);
  const [form, setForm] = useState({ descricao: "", valor: "", dia_vencimento: "10", centro_custo_id: "", conta_bancaria_id: "", categoria: "" });
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [cf, cc, ct] = await Promise.all([
      supabase.from("contas_fixas").select("*, centros_custo(nome), contas_bancarias(nome)").order("descricao"),
      supabase.from("centros_custo").select("*"),
      supabase.from("contas_bancarias").select("*"),
    ]);
    if (cf.error) { console.error("contas_fixas:", cf.error); toast.error("Falha ao carregar contas fixas"); }
    if (cc.error) console.error("centros:", cc.error);
    if (ct.error) console.error("contas:", ct.error);
    setContasFixas(cf.data ?? []);
    setCentros(cc.data ?? []);
    setContas(ct.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ descricao: "", valor: "", dia_vencimento: "10", centro_custo_id: "", conta_bancaria_id: "", categoria: "" });
    setEditing(null);
    setShowAdd(true);
  }

  function openEdit(cf: ContaFixaComRelacoes) {
    setForm({
      descricao: cf.descricao,
      valor: String(cf.valor),
      dia_vencimento: String(cf.dia_vencimento),
      centro_custo_id: cf.centro_custo_id ?? "",
      conta_bancaria_id: cf.conta_bancaria_id ?? "",
      categoria: cf.categoria ?? "",
    });
    setEditing(cf);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const valor = parseFloat(form.valor);
    const diaVenc = parseInt(form.dia_vencimento);
    if (!form.descricao.trim()) { toast.error("Informe a descrição."); return; }
    if (!(valor > 0)) { toast.error("Valor deve ser maior que zero."); return; }
    if (!(diaVenc >= 1 && diaVenc <= 31)) { toast.error("Dia de vencimento deve estar entre 1 e 31."); return; }

    const payload = {
      descricao: form.descricao.trim(),
      valor,
      dia_vencimento: diaVenc,
      centro_custo_id: form.centro_custo_id || null,
      conta_bancaria_id: form.conta_bancaria_id || null,
      categoria: form.categoria || null,
    };
    if (editing) {
      const { error } = await supabase.from("contas_fixas").update(payload).eq("id", editing.id);
      if (error) { toast.error(translateError(error)); return; }
      toast.success("Conta fixa atualizada!");
      setEditing(null);
    } else {
      const { error } = await supabase.from("contas_fixas").insert(payload);
      if (error) { toast.error(translateError(error)); return; }
      toast.success("Conta fixa cadastrada!");
      setShowAdd(false);
    }
    load();
  }

  async function toggleAtivo(cf: ContaFixaComRelacoes) {
    const { error } = await supabase.from("contas_fixas").update({ ativo: !cf.ativo }).eq("id", cf.id);
    if (error) { toast.error(translateError(error)); return; }
    load();
  }

  async function gerarMensais() {
    if (generating) return;
    setGenerating(true);
    try {
      const now = new Date();
      const mesAno = format(now, "yyyy-MM");
      const ativas = contasFixas.filter(cf => cf.ativo);

      // Check which already exist this month
      const { data: existing, error: exErr } = await supabase
        .from("transacoes")
        .select("descricao, data_vencimento")
        .like("data_vencimento", `${mesAno}%`)
        .eq("categoria", "Conta Fixa");
      if (exErr) { toast.error(translateError(exErr)); return; }

      const existingKeys = new Set((existing ?? []).map(e => `${e.descricao}|${e.data_vencimento}`));

      const inserts = [];
      for (const cf of ativas) {
        const dia = String(cf.dia_vencimento).padStart(2, "0");
        const vencimento = `${mesAno}-${dia}`;
        const key = `${cf.descricao}|${vencimento}`;
        if (existingKeys.has(key)) continue;

        inserts.push({
          descricao: cf.descricao,
          valor: Number(cf.valor),
          tipo: "Despesa",
          status: "Pendente",
          data_vencimento: vencimento,
          centro_custo_id: cf.centro_custo_id,
          conta_bancaria_id: cf.conta_bancaria_id,
          categoria: "Conta Fixa",
          user_id: user?.id,
        });
      }

      if (inserts.length === 0) {
        toast.info("Todas as contas fixas deste mês já foram geradas.");
      } else {
        const { error } = await supabase.from("transacoes").insert(inserts);
        if (error) { toast.error(translateError(error)); return; }
        toast.success(`${inserts.length} despesa(s) mensal(is) gerada(s) para ${format(now, "MM/yyyy")}!`);
      }
    } finally {
      setGenerating(false);
    }
  }

  const formFields = (
    <form onSubmit={handleSave} className="space-y-3">
      <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></div>
        <div><Label>Dia Vencimento</Label><Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} required /></div>
      </div>
      <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Água, Luz, Aluguel" /></div>
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
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contas Fixas</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={gerarMensais} disabled={generating}>
              <RefreshCw className={`h-4 w-4 mr-1 ${generating ? "animate-spin" : ""}`} /> Gerar Mês Atual
            </Button>
          )}
          {isAdmin && (
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild><Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Nova Conta Fixa</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Nova Conta Fixa</DialogTitle></DialogHeader>{formFields}</DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Dia Venc.</TableHead>
                <TableHead>Centro Custo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contasFixas.map(cf => (
                <TableRow key={cf.id}>
                  <TableCell className="font-medium">{cf.descricao}</TableCell>
                  <TableCell>{formatBRL(Number(cf.valor))}</TableCell>
                  <TableCell>Dia {cf.dia_vencimento}</TableCell>
                  <TableCell>{cf.centros_custo?.nome ?? "—"}</TableCell>
                  <TableCell>{cf.contas_bancarias?.nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={cf.ativo ? "default" : "outline"}>{cf.ativo ? "Ativa" : "Inativa"}</Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(cf)}><Pencil className="h-3 w-3" /></Button>
                        <Switch checked={cf.ativo} onCheckedChange={() => toggleAtivo(cf)} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {contasFixas.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground">Nenhuma conta fixa cadastrada.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent><DialogHeader><DialogTitle>Editar Conta Fixa</DialogTitle></DialogHeader>{formFields}</DialogContent>
        </Dialog>
      )}
    </div>
  );
}
