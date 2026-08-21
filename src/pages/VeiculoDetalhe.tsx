import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CurrencyInput } from "@/components/ui/masked-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Car, ShoppingCart, Trash2, FileText, Upload, Download, Loader2, Plus, Pencil, Calendar, User, FileSignature, Undo2, X } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import DespesaDialog from "@/components/DespesaDialog";
import VendaDialog from "@/components/VendaDialog";
import ClienteSelector from "@/components/ClienteSelector";
import { ChecklistDocumentos } from "@/components/ChecklistDocumentos";
import { formatBRL } from "@/lib/format";
import type { VeiculoComCentro, Cliente, Transacao, CentroCusto } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

const statusOptions = ["Em Estoque", "Preparação", "Na Oficina", "No Despachante", "No Pátio", "Consignado", "Vendido"];

const statusColor: Record<string, string> = {
  "Em Estoque": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Vendido: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Preparação: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Consignado: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "Na Oficina": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "No Despachante": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "No Pátio": "bg-teal-500/10 text-teal-600 border-teal-500/20",
};

export default function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const canWrite = role === "admin" || role === "auxiliar_operacional";
  const isEmissao = role === "auxiliar_emissao";

  const [veiculo, setVeiculo] = useState<VeiculoComCentro | null>(null);
  const [clienteCompra, setClienteCompra] = useState<Cliente | null>(null);
  const [clienteVenda, setClienteVenda] = useState<Cliente | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [docs, setDocs] = useState<{ name: string; created_at?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDespesa, setShowDespesa] = useState(false);
  const [showVenda, setShowVenda] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showProcuracao, setShowProcuracao] = useState(false);
  const [tipoReconhecimento, setTipoReconhecimento] = useState("GOV.BR");
  const [editForm, setEditForm] = useState<Record<string, string | number | null>>({});
  const [editDeducoes, setEditDeducoes] = useState<{ id: string; txId: string | null; descricao: string; valor: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.storage.from("veiculos-docs").list(id, { sortBy: { column: "created_at", order: "desc" } });
    setDocs(data ?? []);
  }, [id]);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [v, t, c] = await Promise.all([
      supabase.from("veiculos").select("*, centros_custo(nome)").eq("id", id).single(),
      supabase.from("transacoes").select("*").eq("veiculo_id", id).order("created_at", { ascending: false }),
      supabase.from("centros_custo").select("*"),
    ]);

    if (v.error) {
      console.error("load veiculo failed:", v.error);
      toast.error("Falha ao carregar veículo");
    }
    if (t.error) console.error("load transacoes failed:", t.error);
    if (c.error) console.error("load centros failed:", c.error);

    setCentros(c.data ?? []);
    const veiculoData = v.data;
    setVeiculo(veiculoData);
    setTransacoes(t.data ?? []);

    if (veiculoData?.cliente_compra_id) {
      const { data: cli } = await supabase.from("clientes").select("*").eq("id", veiculoData.cliente_compra_id).single();
      setClienteCompra(cli);
    } else {
      setClienteCompra(null);
    }
    if (veiculoData?.cliente_venda_id) {
      const { data: cli } = await supabase.from("clientes").select("*").eq("id", veiculoData.cliente_venda_id).single();
      setClienteVenda(cli);
    } else {
      setClienteVenda(null);
    }

    await loadDocs();
    setLoading(false);
  }, [id, loadDocs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleStatusChange(newStatus: string) {
    await supabase.from("veiculos").update({ status: newStatus }).eq("id", id!);
    setVeiculo((v) => (v ? { ...v, status: newStatus } : v));
    toast.success(`Status atualizado para "${newStatus}"`);
  }

  async function handleDesfazerVenda() {
    if (!id) return;
    const ok = window.confirm(
      "Desfazer a venda deste veículo?\n\n" +
      "• Todas as transações de venda serão APAGADAS (venda, saldo e troca).\n" +
      "• O veículo volta para 'Em Estoque'.\n" +
      "• Esta ação não pode ser desfeita.\n\n" +
      "Confirma?"
    );
    if (!ok) return;

    try {
      // 1. Deleta transações relacionadas à venda deste veículo
      const { error: txErr } = await supabase
        .from("transacoes")
        .delete()
        .eq("veiculo_id", id)
        .in("categoria", ["Venda de Veículo", "Venda de Veículo (Saldo)", "Troca de Veículo"]);
      if (txErr) {
        toast.error("Não foi possível apagar as transações: " + translateError(txErr));
        return;
      }

      // 2. Volta veículo para "Em Estoque" e limpa comprador
      const { error: vErr } = await supabase
        .from("veiculos")
        .update({ status: "Em Estoque", cliente_venda_id: null })
        .eq("id", id);
      if (vErr) {
        toast.error("Não foi possível reverter o status: " + translateError(vErr));
        return;
      }

      toast.success("Venda desfeita. Atualizando telas...");
      // Reload total garante que Dashboard, Caixa Diário, A Pagar/Receber e outras
      // telas não mostrem receitas fantasmas em cache.
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      const msg = err instanceof TypeError
        ? "Sem conexão com o servidor. Tente novamente."
        : `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`;
      toast.error(msg);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("veiculos-docs").upload(path, file);
        if (error) throw error;
      }
      toast.success("Documento(s) enviado(s)!");
      loadDocs();
    } catch (err) {
      toast.error(translateError(err as { message?: string }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteDoc(name: string) {
    if (!confirm(`Remover o documento "${name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.storage.from("veiculos-docs").remove([`${id}/${name}`]);
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Documento removido");
    loadDocs();
  }

  async function handleDeleteTransacao(txId: string) {
    if (!confirm("Excluir esta transação? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("transacoes").delete().eq("id", txId);
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Transação removida");
    loadAll();
  }

  async function openDoc(name: string) {
    const { data, error } = await supabase.storage
      .from("veiculos-docs")
      .createSignedUrl(`${id}/${name}`, 60 * 5); // 5 minutos
    if (error || !data) {
      toast.error("Não foi possível abrir o documento");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function openEdit() {
    if (!veiculo) return;
    setEditForm({
      placa: veiculo.placa,
      marca_modelo: veiculo.marca_modelo,
      ano: veiculo.ano,
      ano_modelo: veiculo.ano_modelo || "",
      cor: veiculo.cor || "",
      renavam: veiculo.renavam || "",
      chassi: veiculo.chassi || "",
      combustivel: veiculo.combustivel || "",
      quilometragem: veiculo.quilometragem ?? "",
      especie: veiculo.especie || "",
      categoria: veiculo.categoria || "",
      alienacao_fiduciaria: veiculo.alienacao_fiduciaria || "",
      valor_aquisicao: veiculo.valor_aquisicao,
      valor_venda: veiculo.valor_venda || 0,
      desconto: veiculo.desconto ?? 0,
      forma_pagamento: veiculo.forma_pagamento || "",
      data_venda: veiculo.data_venda || "",
      is_consignment: veiculo.is_consignment ? "true" : "false",
      data_entrada_patio: veiculo.data_entrada_patio || "",
      centro_custo_id: veiculo.centro_custo_id || "",
      cliente_compra_id: veiculo.cliente_compra_id || null,
      cliente_venda_id: veiculo.cliente_venda_id || null,
    });
    // Carrega TODAS as deduções (novo formato "Dedução" + retrocompatibilidade com IPVA/Multas/Licenciamento/Despesa de Veículo)
    const CATS_DEDUCAO = ["Dedução", "IPVA", "Multas", "Licenciamento", "Despesa de Veículo"];
    const existentes = transacoes
      .filter(t => t.categoria != null && CATS_DEDUCAO.includes(t.categoria) && t.tipo === "Despesa")
      .map(t => ({
        id: crypto.randomUUID(),
        txId: t.id,
        descricao: t.descricao.replace(new RegExp(` - ${veiculo.placa}$`), ""),
        valor: Number(t.valor),
      }));
    setEditDeducoes(existentes);
    setShowEdit(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!veiculo || !id) return;

    const placaUpper = String(editForm.placa).toUpperCase();
    const dataVenc = (editForm.data_entrada_patio as string) || veiculo.data_entrada_patio || new Date().toISOString().split("T")[0];
    const centroId = (editForm.centro_custo_id as string) || null;

    const { error } = await supabase.from("veiculos").update({
      placa: placaUpper,
      marca_modelo: String(editForm.marca_modelo).toUpperCase(),
      ano: String(editForm.ano),
      ano_modelo: String(editForm.ano_modelo || editForm.ano),
      cor: String(editForm.cor).toUpperCase(),
      renavam: String(editForm.renavam),
      chassi: (editForm.chassi as string)?.toUpperCase() || null,
      combustivel: (editForm.combustivel as string) || null,
      quilometragem: editForm.quilometragem === "" || editForm.quilometragem == null ? null : parseInt(String(editForm.quilometragem), 10),
      especie: (editForm.especie as string) || null,
      categoria: (editForm.categoria as string) || null,
      alienacao_fiduciaria: (editForm.alienacao_fiduciaria as string)?.trim() || null,
      valor_aquisicao: Number(editForm.valor_aquisicao) || 0,
      valor_venda: Number(editForm.valor_venda) || 0,
      desconto: Number(editForm.desconto) || 0,
      forma_pagamento: (editForm.forma_pagamento as string) || null,
      data_venda: (editForm.data_venda as string) || null,
      is_consignment: editForm.is_consignment === "true",
      data_entrada_patio: editForm.data_entrada_patio || null,
      centro_custo_id: centroId,
      cliente_compra_id: editForm.cliente_compra_id || null,
      cliente_venda_id: editForm.cliente_venda_id || null,
    }).eq("id", id);
    if (error) { toast.error(translateError(error)); return; }

    // Sync do bloco de deduções (único ponto de gerenciamento de despesas do veículo)
    try {
      const CATS_DEDUCAO = ["Dedução", "IPVA", "Multas", "Licenciamento", "Despesa de Veículo"];
      const txIdsAtuais = new Set(editDeducoes.filter(d => d.txId).map(d => d.txId as string));
      const txIdsOriginais = transacoes
        .filter(t => t.categoria != null && CATS_DEDUCAO.includes(t.categoria) && t.tipo === "Despesa")
        .map(t => t.id);
      const removidas = txIdsOriginais.filter(txId => !txIdsAtuais.has(txId));
      if (removidas.length > 0) {
        await supabase.from("transacoes").delete().in("id", removidas);
      }
      for (const d of editDeducoes) {
        const v = d.valor || 0;
        const desc = d.descricao.trim();
        if (!desc || v <= 0) {
          if (d.txId) await supabase.from("transacoes").delete().eq("id", d.txId);
          continue;
        }
        const descFinal = `${desc} - ${placaUpper}`;
        if (d.txId) {
          await supabase.from("transacoes").update({ descricao: descFinal, valor: v, categoria: "Dedução" }).eq("id", d.txId);
        } else {
          await supabase.from("transacoes").insert({
            descricao: descFinal,
            valor: v,
            tipo: "Despesa",
            status: "Pendente",
            data_vencimento: dataVenc,
            centro_custo_id: centroId,
            veiculo_id: id,
            categoria: "Dedução",
            user_id: user?.id,
          });
        }
      }

      // Recalcula a transação "Custo de Veículo" = valor_aquisicao − soma(deduções válidas).
      // Deduções são embutidas no valor de compra: o vendedor recebe o líquido.
      const valorAquisicao = Number(editForm.valor_aquisicao) || 0;
      const totalDeducoes = editDeducoes.reduce(
        (s, d) => s + (d.valor > 0 && d.descricao.trim() ? d.valor : 0),
        0,
      );
      const liquidoAoVendedor = Math.max(0, valorAquisicao - totalDeducoes);
      const txCustoExistente = transacoes.find(t => t.categoria === "Custo de Veículo" && t.tipo === "Despesa");
      const descCusto = `Compra de Veículo - ${placaUpper}`;
      if (txCustoExistente) {
        if (liquidoAoVendedor > 0) {
          await supabase.from("transacoes").update({ descricao: descCusto, valor: liquidoAoVendedor }).eq("id", txCustoExistente.id);
        } else {
          await supabase.from("transacoes").delete().eq("id", txCustoExistente.id);
        }
      } else if (liquidoAoVendedor > 0) {
        await supabase.from("transacoes").insert({
          descricao: descCusto,
          valor: liquidoAoVendedor,
          tipo: "Despesa",
          status: "Pendente",
          data_vencimento: dataVenc,
          centro_custo_id: centroId,
          veiculo_id: id,
          categoria: "Custo de Veículo",
          user_id: user?.id,
        });
      }
    } catch (err) {
      console.error("sync deduções:", err);
      toast.error("Veículo atualizado, mas houve erro ao sincronizar deduções.");
    }

    toast.success("Veículo atualizado!");
    setShowEdit(false);
    loadAll();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...</div>;
  }

  if (!veiculo) {
    return <div className="text-center py-20 text-muted-foreground">Veículo não encontrado.</div>;
  }

  const custoCompra = Number(veiculo.valor_aquisicao);
  // "Custo de Veículo" e "Dedução" (e legacy) compõem o valor de aquisição embutido —
  // filtrar para o Custo Total não duplicar o bruto.
  const CATS_EMBUTIDAS_NO_BRUTO = ["Custo de Veículo", "Dedução", "IPVA", "Multas", "Licenciamento", "Despesa de Veículo"];
  const despesas = transacoes
    .filter(t => t.tipo === "Despesa" && !CATS_EMBUTIDAS_NO_BRUTO.includes(t.categoria ?? ""))
    .reduce((s, t) => s + Number(t.valor), 0);
  const receitas = transacoes.filter(t => t.tipo === "Receita").reduce((s, t) => s + Number(t.valor), 0);
  const custoTotal = custoCompra + despesas;
  const lucro = receitas - custoTotal;

  const dataEntrada = veiculo.data_entrada_patio ? new Date(veiculo.data_entrada_patio) : new Date(veiculo.created_at);
  const diasPatio = differenceInDays(new Date(), dataEntrada);
  const anoDisplay = veiculo.ano_modelo && veiculo.ano_modelo !== veiculo.ano
    ? `${veiculo.ano}/${veiculo.ano_modelo}`
    : veiculo.ano;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/veiculos")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold">{veiculo.marca_modelo}</h1>
              {veiculo.is_consignment && <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20" variant="outline">Consignado</Badge>}
            </div>
            <div className="text-sm text-foreground mt-2 bg-muted/30 p-2.5 rounded-md border inline-block">
              <span className="font-semibold mr-1">Placa:</span>{veiculo.placa} •&nbsp;
              <span className="font-semibold mr-1">Chassi:</span>{veiculo.chassi || "—"} •&nbsp;
              <span className="font-semibold mr-1">Renavam:</span>{veiculo.renavam || "—"} •&nbsp;
              <span className="font-semibold mr-1">Marca/Modelo:</span>{veiculo.marca_modelo} •&nbsp;
              <span className="font-semibold mr-1">Ano Fab/Mod:</span>{anoDisplay} •&nbsp;
              <span className="font-semibold mr-1">Cor:</span>{veiculo.cor || "—"} •&nbsp;
              <span className="font-semibold mr-1">Combustível:</span>{veiculo.combustivel || "—"}
            </div>
            <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span className={diasPatio > 60 ? "text-destructive font-medium" : diasPatio > 30 ? "text-amber-600 font-medium" : ""}>
                {diasPatio} dias no pátio
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canWrite && (
            <Button variant="outline" size="sm" className="gap-1" onClick={openEdit}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}

          {canWrite && veiculo.status !== "Vendido" ? (
            <Select value={veiculo.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Badge className={statusColor[veiculo.status] ?? ""} variant="outline">{veiculo.status}</Badge>
          )}

          {canWrite && veiculo.status !== "Vendido" && (
            <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowVenda(true)}>
              <ShoppingCart className="h-4 w-4" /> Realizar Venda
            </Button>
          )}

          {role === "admin" && veiculo.status === "Vendido" && (
            <Button variant="outline" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={handleDesfazerVenda}>
              <Undo2 className="h-4 w-4" /> Desfazer Venda
            </Button>
          )}
        </div>
      </div>

      {/* Clientes Vinculados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium uppercase">Comprado de</p>
            </div>
            {clienteCompra ? (
              <div className="text-sm space-y-0.5">
                <p className="font-semibold">{clienteCompra.nome}</p>
                <p className="text-muted-foreground">CPF/CNPJ: {clienteCompra.cpf_cnpj}</p>
                {clienteCompra.telefone && <p className="text-muted-foreground">Tel: {clienteCompra.telefone}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Não informado</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium uppercase">Vendido para</p>
            </div>
            {clienteVenda ? (
              <div className="text-sm space-y-0.5">
                <p className="font-semibold">{clienteVenda.nome}</p>
                <p className="text-muted-foreground">CPF/CNPJ: {clienteVenda.cpf_cnpj}</p>
                {clienteVenda.telefone && <p className="text-muted-foreground">Tel: {clienteVenda.telefone}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Não informado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {!isEmissao && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Custo de Compra</p>
              <p className="text-xl font-bold">{formatBRL(custoCompra)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Receitas</p>
              <p className="text-xl font-bold text-emerald-600">{formatBRL(receitas)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Despesas Extras</p>
              <p className="text-xl font-bold">{formatBRL(despesas)}</p>
              <p className="text-[10px] text-muted-foreground">{transacoes.filter(t => t.tipo === "Despesa" && !CATS_EMBUTIDAS_NO_BRUTO.includes(t.categoria ?? "")).length} lançamento(s) • fora da compra</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Custo Total</p>
              <p className="text-xl font-bold text-destructive">{formatBRL(custoTotal)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lucro real if there are receitas */}
      {!isEmissao && receitas > 0 && (
        <Card className={lucro >= 0 ? "border-emerald-500/30" : "border-destructive/30"}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Lucro Real</p>
            <p className={`text-2xl font-bold ${lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}>{formatBRL(lucro)}</p>
          </CardContent>
        </Card>
      )}

      {/* Resumo por Categoria */}
      {!isEmissao && transacoes.filter(t => t.tipo === "Despesa" && !CATS_EMBUTIDAS_NO_BRUTO.includes(t.categoria ?? "")).length > 0 && (() => {
        const despesasPorCategoria = transacoes
          .filter(t => t.tipo === "Despesa" && !CATS_EMBUTIDAS_NO_BRUTO.includes(t.categoria ?? ""))
          .reduce((acc, t) => {
            const cat = t.categoria || "Sem categoria";
            acc[cat] = (acc[cat] || 0) + Number(t.valor);
            return acc;
          }, {} as Record<string, number>);
        return (
          <div>
            <h2 className="text-lg font-semibold mb-3">Custos por Categoria</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(despesasPorCategoria)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, total]) => (
                  <Card key={cat}>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1 truncate">{cat}</p>
                      <p className="text-base font-bold">{formatBRL(total as number)}</p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        );
      })()}

      {/* Despesas do Veículo */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Despesas do Veículo</h2>
          {canWrite && veiculo.status !== "Vendido" && (
            <Button size="sm" className="gap-1" onClick={() => setShowDespesa(true)}>
              <Plus className="h-4 w-4" /> Nova Despesa
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  {canWrite && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const despesasTx = transacoes.filter(t => t.tipo === "Despesa");
                  const custoVeiculo = despesasTx.filter(t => t.categoria === "Custo de Veículo");
                  const deducoesTx = despesasTx.filter(t => ["Dedução", "IPVA", "Multas", "Licenciamento", "Despesa de Veículo"].includes(t.categoria ?? ""));
                  const outras = despesasTx.filter(t => !CATS_EMBUTIDAS_NO_BRUTO.includes(t.categoria ?? ""));
                  const totalDeducoes = deducoesTx.reduce((s, d) => s + Number(d.valor), 0);
                  const colCount = canWrite ? 5 : 4;

                  if (despesasTx.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">
                          Nenhuma despesa vinculada.
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <>
                      {custoVeiculo.map(tx => (
                        <React.Fragment key={tx.id}>
                          <TableRow className="border-b-0">
                            <TableCell className="font-medium">{tx.descricao}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{tx.categoria}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{formatBRL(Number(tx.valor))}</TableCell>
                            <TableCell>{format(new Date(tx.created_at), "dd/MM/yyyy")}</TableCell>
                            {canWrite && (
                              <TableCell>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTransacao(tx.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                          {deducoesTx.length > 0 && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={colCount} className="py-2 px-4">
                                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                  Deduções abatidas do valor bruto ({formatBRL(Number(tx.valor) + totalDeducoes)})
                                </div>
                                <div className="space-y-1">
                                  {deducoesTx.map(d => (
                                    <div key={d.id} className="flex items-center justify-between text-sm border-l-2 border-muted-foreground/30 pl-3 py-1">
                                      <span className="text-muted-foreground">
                                        <span className="mr-1.5">•</span>{d.descricao}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">{formatBRL(Number(d.valor))}</span>
                                        {canWrite && (
                                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteTransacao(d.id)}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between text-xs pt-1 mt-1 border-t border-muted-foreground/20">
                                    <span className="text-muted-foreground italic">Líquido pago ao vendedor</span>
                                    <span className="font-semibold">{formatBRL(Number(tx.valor))}</span>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                      {/* Deduções órfãs (sem transação "Custo de Veículo" pai — retrocompatibilidade) */}
                      {custoVeiculo.length === 0 && deducoesTx.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.descricao}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{d.categoria}</Badge></TableCell>
                          <TableCell className="font-medium">{formatBRL(Number(d.valor))}</TableCell>
                          <TableCell>{format(new Date(d.created_at), "dd/MM/yyyy")}</TableCell>
                          {canWrite && (
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTransacao(d.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {outras.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium">{tx.descricao}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{tx.categoria || tx.tipo}</Badge></TableCell>
                          <TableCell className="font-medium">{formatBRL(Number(tx.valor))}</TableCell>
                          <TableCell>{format(new Date(tx.created_at), "dd/MM/yyyy")}</TableCell>
                          {canWrite && (
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTransacao(tx.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Receitas do Veículo */}
      {!isEmissao && transacoes.filter(t => t.tipo === "Receita").length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Receitas do Veículo</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacoes.filter(t => t.tipo === "Receita").map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.descricao}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{tx.categoria || "Receita"}</Badge></TableCell>
                      <TableCell className="text-emerald-600 font-medium">{formatBRL(Number(tx.valor))}</TableCell>
                      <TableCell>{format(new Date(tx.created_at), "dd/MM/yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Documentos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Anexos / Documentos</h2>
          {canWrite && (
            <div>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
              <Button size="sm" variant="outline" className="gap-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          )}
        </div>
        <Card>
          <CardContent className="p-4 space-y-2">
            {docs.map(d => (
              <div key={d.name} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="truncate max-w-[400px] text-sm">{d.name.replace(/^\d+_/, "")}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDoc(d.name)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canWrite && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDoc(d.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {docs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento anexado.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Checklist de dados essenciais pra cada documento — evita imprimir
          contratos com campos em branco. Aparece antes dos botões dos contratos. */}
      <ChecklistDocumentos
        veiculo={veiculo}
        clienteCompra={clienteCompra}
        clienteVenda={clienteVenda}
        transacoes={transacoes}
      />

      {/* Ações extras - Contratos */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/veiculos/${id}/contrato-compra`)}>
          <FileText className="h-4 w-4" /> Contrato de Compra
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/veiculos/${id}/contrato-venda`)}>
          <FileText className="h-4 w-4" /> Contrato de Venda
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/veiculos/${id}/contrato-intermediacao`)}>
          <FileText className="h-4 w-4" /> Intermediação
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/veiculos/${id}/contrato-repasse`)}>
          <FileText className="h-4 w-4" /> Repasse
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/recibo/${id}`)}>
          <FileText className="h-4 w-4" /> Gerar Recibo
        </Button>
        <Button className="gap-1 bg-amber-600 hover:bg-amber-700 text-white" size="sm" onClick={() => setShowProcuracao(true)}>
          <FileSignature className="h-4 w-4" /> Gerar Procuração
        </Button>
      </div>

      {/* Edit Dialog */}
      {showEdit && (
        <Dialog open onOpenChange={() => setShowEdit(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Veículo</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <Accordion type="multiple" defaultValue={["identificacao", "financeiro"]} className="space-y-2">

                {/* Identificação */}
                <AccordionItem value="identificacao" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">🚗 Identificação</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div><Label>Placa *</Label><Input value={editForm.placa as string} onChange={(e) => setEditForm({ ...editForm, placa: e.target.value.toUpperCase() })} required className="uppercase" /></div>
                      <div><Label>Marca/Modelo *</Label><Input value={editForm.marca_modelo as string} onChange={(e) => setEditForm({ ...editForm, marca_modelo: e.target.value.toUpperCase() })} required className="uppercase" /></div>
                      <div><Label>Ano Fabricação *</Label><Input value={editForm.ano as string} onChange={(e) => setEditForm({ ...editForm, ano: e.target.value })} required inputMode="numeric" maxLength={4} /></div>
                      <div><Label>Ano Modelo</Label><Input value={editForm.ano_modelo as string} onChange={(e) => setEditForm({ ...editForm, ano_modelo: e.target.value })} inputMode="numeric" maxLength={4} /></div>
                      <div><Label>Cor</Label><Input value={editForm.cor as string} onChange={(e) => setEditForm({ ...editForm, cor: e.target.value.toUpperCase() })} className="uppercase" /></div>
                      <div>
                        <Label>Combustível</Label>
                        <Select value={editForm.combustivel as string} onValueChange={(v) => setEditForm({ ...editForm, combustivel: v })}>
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
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Documentação */}
                <AccordionItem value="documentacao" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">📄 Documentação</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div><Label>Renavam</Label><Input value={editForm.renavam as string} onChange={(e) => setEditForm({ ...editForm, renavam: e.target.value })} inputMode="numeric" /></div>
                      <div><Label>Chassi</Label><Input value={editForm.chassi as string} onChange={(e) => setEditForm({ ...editForm, chassi: e.target.value.toUpperCase() })} className="uppercase" /></div>
                      <div><Label>Quilometragem (KM)</Label><Input type="number" min="0" value={editForm.quilometragem as string | number} onChange={(e) => setEditForm({ ...editForm, quilometragem: e.target.value })} inputMode="numeric" /></div>
                      <div>
                        <Label>Espécie/Tipo</Label>
                        <Select value={editForm.especie as string} onValueChange={(v) => setEditForm({ ...editForm, especie: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Automóvel">Automóvel</SelectItem>
                            <SelectItem value="Motocicleta">Motocicleta</SelectItem>
                            <SelectItem value="Caminhonete">Caminhonete</SelectItem>
                            <SelectItem value="Caminhão">Caminhão</SelectItem>
                            <SelectItem value="Utilitário">Utilitário</SelectItem>
                            <SelectItem value="Ônibus">Ônibus</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Categoria</Label>
                        <Select value={editForm.categoria as string} onValueChange={(v) => setEditForm({ ...editForm, categoria: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Particular">Particular</SelectItem>
                            <SelectItem value="Aluguel">Aluguel</SelectItem>
                            <SelectItem value="Comercial">Comercial</SelectItem>
                            <SelectItem value="Oficial">Oficial</SelectItem>
                            <SelectItem value="Diplomática">Diplomática</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Alienação Fiduciária</Label><Input value={editForm.alienacao_fiduciaria as string} onChange={(e) => setEditForm({ ...editForm, alienacao_fiduciaria: e.target.value })} placeholder="Ex: Sem, Banco XYZ" /></div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Financeiro */}
                <AccordionItem value="financeiro" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">💰 Financeiro</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div><Label>Valor de Aquisição *</Label><CurrencyInput value={editForm.valor_aquisicao as number} onChange={(v) => setEditForm({ ...editForm, valor_aquisicao: v })} /></div>
                      <div><Label>Valor de Venda</Label><CurrencyInput value={editForm.valor_venda as number} onChange={(v) => setEditForm({ ...editForm, valor_venda: v })} /></div>
                      <div><Label>Desconto</Label><CurrencyInput value={editForm.desconto as number} onChange={(v) => setEditForm({ ...editForm, desconto: v })} /></div>
                      <div>
                        <Label>Forma de Pagamento</Label>
                        <Select value={editForm.forma_pagamento as string} onValueChange={(v) => setEditForm({ ...editForm, forma_pagamento: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PIX">PIX</SelectItem>
                            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="Transferência">Transferência</SelectItem>
                            <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                            <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                            <SelectItem value="Financiamento Banco">Financiamento Banco</SelectItem>
                            <SelectItem value="Veículo na Troca">Veículo na Troca</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Data da Venda</Label>
                        <Input type="date" value={editForm.data_venda as string} onChange={(e) => setEditForm({ ...editForm, data_venda: e.target.value })} />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Deduções */}
                <AccordionItem value="deducoes" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    📉 Deduções {editDeducoes.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">({editDeducoes.length} · R$ {editDeducoes.reduce((s, d) => s + (d.valor || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <p className="text-[11px] text-muted-foreground">Editar aqui atualiza/cria/apaga a despesa financeira correspondente. Sem duplicidade.</p>
                      <div className="flex flex-wrap gap-1">
                        {["IPVA", "Multas", "Licenciamento", "Saldo de Quitação", "Comissão", "Repasse a Terceiro", "Frete/Transporte"].map(sug => (
                          <Button key={sug} type="button" size="sm" variant="secondary" className="h-6 text-[11px]" onClick={() => setEditDeducoes(d => [...d, { id: crypto.randomUUID(), txId: null, descricao: sug, valor: 0 }])}>
                            + {sug}
                          </Button>
                        ))}
                        <Button type="button" size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => setEditDeducoes(d => [...d, { id: crypto.randomUUID(), txId: null, descricao: "", valor: 0 }])}>
                          <Plus className="h-3 w-3 mr-1" /> Outra
                        </Button>
                      </div>
                      {editDeducoes.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhuma dedução.</p>}
                      {editDeducoes.map((d) => (
                        <div key={d.id} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-7">
                            <Label className="text-xs">Descrição</Label>
                            <Input className="h-8 text-sm" value={d.descricao} onChange={(e) => setEditDeducoes(list => list.map(x => x.id === d.id ? { ...x, descricao: e.target.value } : x))} />
                          </div>
                          <div className="col-span-4">
                            <Label className="text-xs">Valor</Label>
                            <CurrencyInput className="h-8 text-sm" value={d.valor} onChange={(v) => setEditDeducoes(list => list.map(x => x.id === d.id ? { ...x, valor: v } : x))} />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditDeducoes(list => list.filter(x => x.id !== d.id))}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Origem */}
                <AccordionItem value="origem" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">🏢 Origem</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <Switch checked={editForm.is_consignment === "true"} onCheckedChange={(v) => setEditForm({ ...editForm, is_consignment: v ? "true" : "false" })} />
                        <Label>Veículo Consignado</Label>
                      </div>
                      <ClienteSelector label="Comprado de (Cliente)" value={editForm.cliente_compra_id as string | null} onChange={(v) => setEditForm({ ...editForm, cliente_compra_id: v })} />
                      <ClienteSelector label="Vendido para (Cliente)" value={editForm.cliente_venda_id as string | null} onChange={(v) => setEditForm({ ...editForm, cliente_venda_id: v })} />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Centro de Custo</Label>
                          <Select value={editForm.centro_custo_id as string} onValueChange={(v) => setEditForm({ ...editForm, centro_custo_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {centros.filter(c => role === "admin" || c.nome !== "Casa").map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Data Entrada Pátio</Label><Input type="date" value={editForm.data_entrada_patio as string} onChange={(e) => setEditForm({ ...editForm, data_entrada_patio: e.target.value })} /></div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button type="submit" className="w-full">Salvar Alterações</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Procuração Dialog */}
      {showProcuracao && (
        <Dialog open onOpenChange={() => setShowProcuracao(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Gerar Procuração</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2 border rounded-md p-4">
                <Label className="text-base font-semibold">Tipo de Reconhecimento</Label>
                <div className="flex flex-col gap-2 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipoReconhecimento" value="GOV.BR" checked={tipoReconhecimento === "GOV.BR"} onChange={e => setTipoReconhecimento(e.target.value)} />
                    Reconhecimento por GOV.BR
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipoReconhecimento" value="Autenticidade" checked={tipoReconhecimento === "Autenticidade"} onChange={e => setTipoReconhecimento(e.target.value)} />
                    Reconhecimento por Autenticidade
                  </label>
                </div>
              </div>
              <Button className="w-full" onClick={() => navigate(`/veiculos/${id}/procuracao?tipo=${tipoReconhecimento}`)}>Gerar e Imprimir</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogs */}
      {showDespesa && <DespesaDialog veiculo={veiculo} onClose={() => { setShowDespesa(false); loadAll(); }} />}
      {showVenda && <VendaDialog veiculo={veiculo} onClose={() => { setShowVenda(false); loadAll(); }} />}
    </div>
  );
}
