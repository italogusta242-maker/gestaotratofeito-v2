import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Car, ShoppingCart, Trash2, FileText, Upload, Download, Loader2, Plus, Pencil, Calendar, User, FileSignature } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import DespesaDialog from "@/components/DespesaDialog";
import VendaDialog from "@/components/VendaDialog";
import ClienteSelector from "@/components/ClienteSelector";
import { formatBRL } from "@/lib/format";
import type { VeiculoComCentro, Cliente, Transacao, CentroCusto } from "@/lib/db-types";

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
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "auxiliar_operacional";
  const isEmissao = role === "auxiliar_emissao";

  const [veiculo, setVeiculo] = useState<VeiculoComCentro | null>(null);
  const [clienteCompra, setClienteCompra] = useState<Cliente | null>(null);
  const [clienteVenda, setClienteVenda] = useState<Cliente | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDespesa, setShowDespesa] = useState(false);
  const [showVenda, setShowVenda] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showProcuracao, setShowProcuracao] = useState(false);
  const [tipoReconhecimento, setTipoReconhecimento] = useState("GOV.BR");
  const [editForm, setEditForm] = useState<any>({});
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
    setVeiculo((v: any) => ({ ...v, status: newStatus }));
    toast.success(`Status atualizado para "${newStatus}"`);
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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteDoc(name: string) {
    const { error } = await supabase.storage.from("veiculos-docs").remove([`${id}/${name}`]);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento removido");
    loadDocs();
  }

  async function handleDeleteTransacao(txId: string) {
    const { error } = await supabase.from("transacoes").delete().eq("id", txId);
    if (error) { toast.error(error.message); return; }
    toast.success("Transação removida");
    loadAll();
  }

  function getDocUrl(name: string) {
    const { data } = supabase.storage.from("veiculos-docs").getPublicUrl(`${id}/${name}`);
    return data.publicUrl;
  }

  function openEdit() {
    setEditForm({
      placa: veiculo.placa,
      marca_modelo: veiculo.marca_modelo,
      ano: veiculo.ano,
      ano_modelo: veiculo.ano_modelo || "",
      cor: veiculo.cor || "",
      renavam: veiculo.renavam || "",
      chassi: veiculo.chassi || "",
      combustivel: veiculo.combustivel || "",
      valor_aquisicao: veiculo.valor_aquisicao,
      valor_venda: veiculo.valor_venda || 0,
      data_entrada_patio: veiculo.data_entrada_patio || "",
      centro_custo_id: veiculo.centro_custo_id || "",
      cliente_compra_id: veiculo.cliente_compra_id || null,
      cliente_venda_id: veiculo.cliente_venda_id || null,
    });
    setShowEdit(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("veiculos").update({
      placa: editForm.placa.toUpperCase(),
      marca_modelo: editForm.marca_modelo.toUpperCase(),
      ano: editForm.ano,
      ano_modelo: editForm.ano_modelo || editForm.ano,
      cor: editForm.cor.toUpperCase(),
      renavam: editForm.renavam,
      chassi: editForm.chassi?.toUpperCase() || null,
      combustivel: editForm.combustivel || null,
      valor_aquisicao: parseFloat(editForm.valor_aquisicao) || 0,
      valor_venda: parseFloat(editForm.valor_venda) || 0,
      data_entrada_patio: editForm.data_entrada_patio || null,
      centro_custo_id: editForm.centro_custo_id || null,
      cliente_compra_id: editForm.cliente_compra_id || null,
      cliente_venda_id: editForm.cliente_venda_id || null,
    }).eq("id", id!);
    if (error) { toast.error(error.message); return; }
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
  const despesas = transacoes.filter(t => t.tipo === "Despesa").reduce((s, t) => s + Number(t.valor), 0);
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
              <p className="text-xs text-muted-foreground mb-1">Despesas</p>
              <p className="text-xl font-bold">{formatBRL(despesas)}</p>
              <p className="text-xs text-muted-foreground">{transacoes.filter(t => t.tipo === "Despesa").length} lançamento(s)</p>
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
      {!isEmissao && transacoes.filter(t => t.tipo === "Despesa").length > 0 && (() => {
        const despesasPorCategoria = transacoes
          .filter(t => t.tipo === "Despesa")
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
              {transacoes.filter(t => t.tipo === "Despesa").map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">{tx.descricao}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{tx.categoria || tx.tipo}</Badge>
                    </TableCell>
                    <TableCell className={tx.tipo === "Receita" ? "text-emerald-600 font-medium" : "font-medium"}>
                      {formatBRL(Number(tx.valor))}
                    </TableCell>
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
                {transacoes.filter(t => t.tipo === "Despesa").length === 0 && (
                  <TableRow><TableCell colSpan={canWrite ? 5 : 4} className="text-center text-muted-foreground py-8">Nenhuma despesa vinculada.</TableCell></TableRow>
                )}
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
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(getDocUrl(d.name), "_blank")}>
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
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Veículo</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Placa</Label><Input value={editForm.placa} onChange={(e) => setEditForm({ ...editForm, placa: e.target.value.toUpperCase() })} required className="uppercase" /></div>
                <div><Label>Marca/Modelo</Label><Input value={editForm.marca_modelo} onChange={(e) => setEditForm({ ...editForm, marca_modelo: e.target.value.toUpperCase() })} required className="uppercase" /></div>
                <div><Label>Ano Fabricação</Label><Input value={editForm.ano} onChange={(e) => setEditForm({ ...editForm, ano: e.target.value })} required /></div>
                <div><Label>Ano Modelo</Label><Input value={editForm.ano_modelo} onChange={(e) => setEditForm({ ...editForm, ano_modelo: e.target.value })} /></div>
                <div><Label>Cor</Label><Input value={editForm.cor} onChange={(e) => setEditForm({ ...editForm, cor: e.target.value.toUpperCase() })} className="uppercase" /></div>
                <div><Label>Renavam</Label><Input value={editForm.renavam} onChange={(e) => setEditForm({ ...editForm, renavam: e.target.value })} /></div>
                <div><Label>Chassi</Label><Input value={editForm.chassi} onChange={(e) => setEditForm({ ...editForm, chassi: e.target.value.toUpperCase() })} className="uppercase" /></div>
                <div>
                  <Label>Combustível</Label>
                  <Select value={editForm.combustivel} onValueChange={(v) => setEditForm({ ...editForm, combustivel: v })}>
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
                <div><Label>Valor Aquisição</Label><Input type="number" step="0.01" value={editForm.valor_aquisicao} onChange={(e) => setEditForm({ ...editForm, valor_aquisicao: e.target.value })} required /></div>
                <div><Label>Valor Venda</Label><Input type="number" step="0.01" value={editForm.valor_venda} onChange={(e) => setEditForm({ ...editForm, valor_venda: e.target.value })} /></div>
                <div><Label>Data Entrada Pátio</Label><Input type="date" value={editForm.data_entrada_patio} onChange={(e) => setEditForm({ ...editForm, data_entrada_patio: e.target.value })} /></div>
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select value={editForm.centro_custo_id} onValueChange={(v) => setEditForm({ ...editForm, centro_custo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {centros.filter(c => role === "admin" || c.nome !== "Casa").map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ClienteSelector label="Comprado de (Cliente)" value={editForm.cliente_compra_id} onChange={(v) => setEditForm({ ...editForm, cliente_compra_id: v })} />
              <ClienteSelector label="Vendido para (Cliente)" value={editForm.cliente_venda_id} onChange={(v) => setEditForm({ ...editForm, cliente_venda_id: v })} />
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
