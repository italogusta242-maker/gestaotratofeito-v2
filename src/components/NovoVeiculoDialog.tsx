import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ClienteSelector from "@/components/ClienteSelector";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onClose: (veiculoId?: string) => void;
  defaultValues?: {
    valor_aquisicao?: string;
    centro_custo_id?: string;
    cliente_compra_id?: string;
  };
  title?: string;
}

export default function NovoVeiculoDialog({ open, onClose, defaultValues, title }: Props) {
  const { user } = useAuth();
  const [centros, setCentros] = useState<any[]>([]);
  const [form, setForm] = useState({
    placa: "", marca_modelo: "", ano: "", ano_modelo: "", cor: "", renavam: "", chassi: "", combustivel: "",
    valor_aquisicao: defaultValues?.valor_aquisicao ?? "",
    debitos_veiculo: "",
    centro_custo_id: defaultValues?.centro_custo_id ?? "",
    data_entrada_patio: new Date().toISOString().split("T")[0],
  });
  const [clienteCompraId, setClienteCompraId] = useState<string | null>(defaultValues?.cliente_compra_id ?? null);
  const [isConsignment, setIsConsignment] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("centros_custo").select("*").then(({ data }) => setCentros(data ?? []));
  }, []);

  useEffect(() => {
    if (open && defaultValues) {
      setForm(f => ({
        ...f,
        valor_aquisicao: defaultValues.valor_aquisicao ?? f.valor_aquisicao,
        centro_custo_id: defaultValues.centro_custo_id ?? f.centro_custo_id,
      }));
      setClienteCompraId(defaultValues.cliente_compra_id ?? null);
    }
  }, [open, defaultValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.from("veiculos").insert({
      placa: form.placa.toUpperCase(),
      marca_modelo: form.marca_modelo.toUpperCase(),
      ano: form.ano,
      ano_modelo: form.ano_modelo || form.ano,
      cor: form.cor.toUpperCase(),
      renavam: form.renavam,
      chassi: form.chassi.toUpperCase() || null,
      combustivel: form.combustivel || null,
      valor_aquisicao: parseFloat(form.valor_aquisicao) || 0,
      centro_custo_id: form.centro_custo_id || null,
      cliente_compra_id: clienteCompraId,
      is_consignment: isConsignment,
      data_entrada_patio: form.data_entrada_patio || new Date().toISOString().split("T")[0],
    }).select("id").single();
    
    if (error) { toast.error(error.message); setLoading(false); return; }

    const valorNum = parseFloat(form.valor_aquisicao) || 0;
    const debitosNum = parseFloat(form.debitos_veiculo) || 0;
    const txsToInsert = [];

    if (valorNum > 0) {
      txsToInsert.push({
        descricao: `Compra de Veículo - ${form.placa.toUpperCase()}`,
        valor: valorNum,
        tipo: "Despesa",
        status: "Pendente",
        data_vencimento: form.data_entrada_patio || new Date().toISOString().split("T")[0],
        centro_custo_id: form.centro_custo_id || null,
        veiculo_id: data?.id,
        categoria: "Custo de Veículo",
        user_id: user?.id,
      });
    }

    if (debitosNum > 0) {
      txsToInsert.push({
        descricao: `Débitos de Veículo - ${form.placa.toUpperCase()}`,
        valor: debitosNum,
        tipo: "Despesa",
        status: "Pendente",
        data_vencimento: form.data_entrada_patio || new Date().toISOString().split("T")[0],
        centro_custo_id: form.centro_custo_id || null,
        veiculo_id: data?.id,
        categoria: "Despesa de Veículo",
        user_id: user?.id,
      });
    }

    if (txsToInsert.length > 0) {
      await supabase.from("transacoes").insert(txsToInsert);
    }

    setLoading(false);
    toast.success("Veículo e pendências cadastradas com sucesso!");
    onClose(data?.id);
  }

  const upper = (v: string) => v.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title ?? "Novo Veículo"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Placa</Label>
              <Input value={form.placa} onChange={e => setForm({ ...form, placa: upper(e.target.value) })} required className="uppercase" />
            </div>
            <div><Label>Marca/Modelo</Label><Input value={form.marca_modelo} onChange={e => setForm({ ...form, marca_modelo: upper(e.target.value) })} required className="uppercase" /></div>
            <div><Label>Ano Fabricação</Label><Input value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value })} required /></div>
            <div><Label>Ano Modelo</Label><Input value={form.ano_modelo} onChange={e => setForm({ ...form, ano_modelo: e.target.value })} /></div>
            <div><Label>Cor</Label><Input value={form.cor} onChange={e => setForm({ ...form, cor: upper(e.target.value) })} className="uppercase" /></div>
            <div><Label>Renavam</Label><Input value={form.renavam} onChange={e => setForm({ ...form, renavam: e.target.value })} /></div>
            <div><Label>Chassi</Label><Input value={form.chassi} onChange={e => setForm({ ...form, chassi: upper(e.target.value) })} className="uppercase" /></div>
            <div>
              <Label>Combustível</Label>
              <Select value={form.combustivel} onValueChange={v => setForm({ ...form, combustivel: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLEX">Flex</SelectItem>
                  <SelectItem value="GASOLINA">Gasolina</SelectItem>
                  <SelectItem value="ETANOL">Etanol</SelectItem>
                  <SelectItem value="DIESEL">Diesel</SelectItem>
                  <SelectItem value="GNV">GNV</SelectItem>
                  <SelectItem value="ELÉTRICO">Elétrico</SelectItem>
                  <SelectItem value="HÍBRIDO">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor Aquisição (R$)</Label><Input type="number" step="0.01" value={form.valor_aquisicao} onChange={e => setForm({ ...form, valor_aquisicao: e.target.value })} required /></div>
            <div><Label>Débitos do Veículo (R$)</Label><Input type="number" step="0.01" value={form.debitos_veiculo} onChange={e => setForm({ ...form, debitos_veiculo: e.target.value })} placeholder="Opcional" /></div>
            <div><Label>Data Entrada Pátio</Label><Input type="date" value={form.data_entrada_patio} onChange={e => setForm({ ...form, data_entrada_patio: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isConsignment} onCheckedChange={setIsConsignment} />
            <Label>Veículo Consignado</Label>
          </div>
          <ClienteSelector label={isConsignment ? "Dono do Veículo (obrigatório)" : "Comprado de (Cliente)"} value={clienteCompraId} onChange={setClienteCompraId} />
          <div>
            <Label>Centro de Custo</Label>
            <Select value={form.centro_custo_id} onValueChange={v => setForm({ ...form, centro_custo_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Cadastrar Veículo"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
