import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CurrencyInput } from "@/components/ui/masked-input";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import ClienteSelector from "@/components/ClienteSelector";
import { useAuth } from "@/hooks/useAuth";
import { translateError } from "@/lib/supabase-errors";
import { digitsToDecimal, decimalToDigits } from "@/lib/masks";
import type { CentroCusto } from "@/lib/db-types";

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

interface DeducaoLinha {
  id: string;
  descricao: string;
  valor: number;
}

function novaDeducao(descricao = ""): DeducaoLinha {
  return { id: crypto.randomUUID(), descricao, valor: 0 };
}

const ESPECIES = ["Automóvel", "Motocicleta", "Caminhonete", "Caminhão", "Utilitário", "Ônibus", "Outro"];
const CATEGORIAS = ["Particular", "Aluguel", "Comercial", "Oficial", "Diplomática"];
const COMBUSTIVEIS = [
  { v: "FLEX", l: "Flex" }, { v: "GASOLINA", l: "Gasolina" }, { v: "ETANOL", l: "Etanol" },
  { v: "DIESEL", l: "Diesel" }, { v: "GNV", l: "GNV" }, { v: "ELÉTRICO", l: "Elétrico" }, { v: "HÍBRIDO", l: "Híbrido" },
];
const FORMAS_PAGAMENTO = ["PIX", "Dinheiro", "Transferência", "Cartão Débito", "Cartão Crédito", "Cheque", "Financiamento Banco", "Veículo na Troca"];
const ATALHOS_DEDUCAO = ["IPVA", "Multas", "Licenciamento", "Saldo de Quitação", "Comissão", "Repasse a Terceiro", "Frete/Transporte"];

export default function NovoVeiculoDialog({ open, onClose, defaultValues, title }: Props) {
  const { user } = useAuth();
  const [centros, setCentros] = useState<CentroCusto[]>([]);

  const [form, setForm] = useState({
    placa: "", marca_modelo: "", ano: "", ano_modelo: "", cor: "", renavam: "", chassi: "", combustivel: "",
    quilometragem: "",
    especie: "",
    categoria: "",
    alienacao_fiduciaria: "",
    valor_aquisicao: parseFloat(defaultValues?.valor_aquisicao ?? "") || 0,
    valor_venda: 0,
    desconto: 0,
    forma_pagamento: "",
    centro_custo_id: defaultValues?.centro_custo_id ?? "",
    data_entrada_patio: new Date().toISOString().split("T")[0],
  });

  const [clienteCompraId, setClienteCompraId] = useState<string | null>(defaultValues?.cliente_compra_id ?? null);
  const [isConsignment, setIsConsignment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deducoes, setDeducoes] = useState<DeducaoLinha[]>([]);

  function addDeducao(descricao = "") {
    setDeducoes(d => [...d, novaDeducao(descricao)]);
  }
  function updateDeducao(id: string, field: "descricao" | "valor", value: string | number) {
    setDeducoes(d => d.map(x => x.id === id ? { ...x, [field]: value } as DeducaoLinha : x));
  }
  function removeDeducao(id: string) {
    setDeducoes(d => d.filter(x => x.id !== id));
  }
  const totalDeducoes = deducoes.reduce((s, d) => s + (d.valor || 0), 0);

  useEffect(() => {
    supabase.from("centros_custo").select("*").then(({ data }) => setCentros(data ?? []));
  }, []);

  useEffect(() => {
    if (open && defaultValues) {
      setForm(f => ({
        ...f,
        valor_aquisicao: parseFloat(defaultValues.valor_aquisicao ?? "") || f.valor_aquisicao,
        centro_custo_id: defaultValues.centro_custo_id ?? f.centro_custo_id,
      }));
      setClienteCompraId(defaultValues.cliente_compra_id ?? null);
    }
  }, [open, defaultValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (form.valor_aquisicao < 0) { toast.error("Valor de aquisição inválido"); return; }
    if (isConsignment && !clienteCompraId) {
      toast.error("Selecione o dono do veículo consignado");
      return;
    }
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
      quilometragem: form.quilometragem ? parseInt(form.quilometragem, 10) : null,
      especie: form.especie || null,
      categoria: form.categoria || null,
      alienacao_fiduciaria: form.alienacao_fiduciaria.trim() || null,
      valor_aquisicao: form.valor_aquisicao || 0,
      valor_venda: form.valor_venda || 0,
      desconto: form.desconto || 0,
      forma_pagamento: form.forma_pagamento || null,
      centro_custo_id: form.centro_custo_id || null,
      cliente_compra_id: clienteCompraId,
      is_consignment: isConsignment,
      data_entrada_patio: form.data_entrada_patio || new Date().toISOString().split("T")[0],
    }).select("id").single();

    if (error) { toast.error(translateError(error)); setLoading(false); return; }

    const txsToInsert = [];

    if (form.valor_aquisicao > 0) {
      txsToInsert.push({
        descricao: `Compra de Veículo - ${form.placa.toUpperCase()}`,
        valor: form.valor_aquisicao,
        tipo: "Despesa",
        status: "Pendente",
        data_vencimento: form.data_entrada_patio || new Date().toISOString().split("T")[0],
        centro_custo_id: form.centro_custo_id || null,
        veiculo_id: data?.id,
        categoria: "Custo de Veículo",
        user_id: user?.id,
      });
    }

    for (const d of deducoes) {
      const v = d.valor || 0;
      const desc = d.descricao.trim();
      if (v > 0 && desc) {
        txsToInsert.push({
          descricao: `${desc} - ${form.placa.toUpperCase()}`,
          valor: v,
          tipo: "Despesa",
          status: "Pendente",
          data_vencimento: form.data_entrada_patio || new Date().toISOString().split("T")[0],
          centro_custo_id: form.centro_custo_id || null,
          veiculo_id: data?.id,
          categoria: "Dedução",
          user_id: user?.id,
        });
      }
    }

    if (txsToInsert.length > 0) {
      await supabase.from("transacoes").insert(txsToInsert);
    }

    setLoading(false);
    toast.success("Veículo cadastrado com sucesso!");
    onClose(data?.id);
  }

  const upper = (v: string) => v.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title ?? "Novo Veículo"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Accordion type="multiple" defaultValue={["identificacao", "financeiro"]} className="space-y-2">

            {/* Identificação */}
            <AccordionItem value="identificacao" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                🚗 Identificação
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label>Placa *</Label>
                    <Input value={form.placa} onChange={e => setForm({ ...form, placa: upper(e.target.value) })} required className="uppercase" />
                  </div>
                  <div>
                    <Label>Marca/Modelo *</Label>
                    <Input value={form.marca_modelo} onChange={e => setForm({ ...form, marca_modelo: upper(e.target.value) })} required className="uppercase" />
                  </div>
                  <div>
                    <Label>Ano Fabricação *</Label>
                    <Input value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value })} required inputMode="numeric" maxLength={4} />
                  </div>
                  <div>
                    <Label>Ano Modelo</Label>
                    <Input value={form.ano_modelo} onChange={e => setForm({ ...form, ano_modelo: e.target.value })} inputMode="numeric" maxLength={4} />
                  </div>
                  <div>
                    <Label>Cor</Label>
                    <Input value={form.cor} onChange={e => setForm({ ...form, cor: upper(e.target.value) })} className="uppercase" />
                  </div>
                  <div>
                    <Label>Combustível</Label>
                    <Select value={form.combustivel} onValueChange={v => setForm({ ...form, combustivel: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{COMBUSTIVEIS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Documentação */}
            <AccordionItem value="documentacao" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                📄 Documentação
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div><Label>Renavam</Label><Input value={form.renavam} onChange={e => setForm({ ...form, renavam: e.target.value })} inputMode="numeric" /></div>
                  <div><Label>Chassi</Label><Input value={form.chassi} onChange={e => setForm({ ...form, chassi: upper(e.target.value) })} className="uppercase" /></div>
                  <div><Label>Quilometragem (KM)</Label><Input type="number" min="0" value={form.quilometragem} onChange={e => setForm({ ...form, quilometragem: e.target.value })} placeholder="Ex: 45000" inputMode="numeric" /></div>
                  <div>
                    <Label>Espécie/Tipo</Label>
                    <Select value={form.especie} onValueChange={v => setForm({ ...form, especie: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{ESPECIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Alienação Fiduciária</Label><Input value={form.alienacao_fiduciaria} onChange={e => setForm({ ...form, alienacao_fiduciaria: e.target.value })} placeholder="Ex: Sem, Banco XYZ" /></div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Financeiro */}
            <AccordionItem value="financeiro" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                💰 Financeiro
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label>Valor de Aquisição *</Label>
                    <CurrencyInput value={form.valor_aquisicao} onChange={(v) => setForm({ ...form, valor_aquisicao: v })} />
                  </div>
                  <div>
                    <Label>Valor de Venda (previsto)</Label>
                    <CurrencyInput value={form.valor_venda} onChange={(v) => setForm({ ...form, valor_venda: v })} />
                  </div>
                  <div>
                    <Label>Desconto</Label>
                    <CurrencyInput value={form.desconto} onChange={(v) => setForm({ ...form, desconto: v })} />
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Deduções */}
            <AccordionItem value="deducoes" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                📉 Deduções {deducoes.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">({deducoes.length} · R$ {totalDeducoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <p className="text-[11px] text-muted-foreground">Cada linha vira uma despesa vinculada ao veículo. Aparece automaticamente no contrato de compra.</p>

                  {/* Atalhos rápidos */}
                  <div className="flex flex-wrap gap-1">
                    {ATALHOS_DEDUCAO.map(sug => (
                      <Button key={sug} type="button" size="sm" variant="secondary" className="h-6 text-[11px]" onClick={() => addDeducao(sug)}>
                        + {sug}
                      </Button>
                    ))}
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => addDeducao()}>
                      <Plus className="h-3 w-3 mr-1" /> Outra
                    </Button>
                  </div>

                  {deducoes.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhuma dedução.</p>}

                  {deducoes.map(d => (
                    <div key={d.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-7">
                        <Label className="text-xs">Descrição</Label>
                        <Input className="h-8 text-sm" value={d.descricao} onChange={e => updateDeducao(d.id, "descricao", e.target.value)} placeholder="Ex: IPVA atrasado" />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs">Valor</Label>
                        <CurrencyInput className="h-8 text-sm" value={d.valor} onChange={(v) => updateDeducao(d.id, "valor", v)} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeDeducao(d.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Origem */}
            <AccordionItem value="origem" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                🏢 Origem
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={isConsignment} onCheckedChange={setIsConsignment} />
                    <Label>Veículo Consignado</Label>
                  </div>
                  <ClienteSelector label={isConsignment ? "Dono do Veículo (obrigatório)" : "Comprado de (Cliente)"} value={clienteCompraId} onChange={setClienteCompraId} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Centro de Custo</Label>
                      <Select value={form.centro_custo_id} onValueChange={v => setForm({ ...form, centro_custo_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Data Entrada Pátio</Label><Input type="date" value={form.data_entrada_patio} onChange={e => setForm({ ...form, data_entrada_patio: e.target.value })} /></div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Cadastrar Veículo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
