import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { translateError } from "@/lib/supabase-errors";

interface Props { veiculo: any; onClose: () => void; }

export default function DespesaDialog({ veiculo, onClose }: Props) {
  const { user } = useAuth();
  const [contas, setContas] = useState<any[]>([]);
  const [form, setForm] = useState({
    descricao: "", // Fornecedor / Localizador
    peca_servico: "",
    data_ocorrencia: new Date().toISOString().split("T")[0],
    valor: "",
    categoria: "",
    conta_bancaria_id: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("contas_bancarias").select("*").then(({ data }) => setContas(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const descricaoFinal = form.peca_servico
      ? `${form.descricao} - ${form.peca_servico}`
      : form.descricao;

    const { error } = await supabase.from("transacoes").insert({
      descricao: descricaoFinal,
      valor: parseFloat(form.valor),
      tipo: "Despesa",
      status: "Pago",
      data_vencimento: form.data_ocorrencia,
      data_pagamento: form.data_ocorrencia,
      conta_bancaria_id: form.conta_bancaria_id || null,
      centro_custo_id: veiculo.centro_custo_id,
      veiculo_id: veiculo.id,
      categoria: form.categoria || "Despesa Veicular",
      user_id: user?.id,
    });
    if (error) { toast.error(translateError(error)); } else { toast.success("Despesa registrada!"); onClose(); }
    setLoading(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Despesa — {veiculo.placa}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><Label>Fornecedor / Local</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required placeholder="Ex: Oficina do João" /></div>
          <div><Label>Peça / Serviço (Opcional)</Label><Input value={form.peca_servico} onChange={(e) => setForm({ ...form, peca_servico: e.target.value })} placeholder="Ex: Pintura ou Calota" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data</Label><Input type="date" value={form.data_ocorrencia} onChange={(e) => setForm({ ...form, data_ocorrencia: e.target.value })} required /></div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></div>
          </div>
          <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Oficina, Taxa, Documentação" /></div>
          <div><Label>Conta</Label>
            <Select value={form.conta_bancaria_id} onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>Salvar Despesa</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
