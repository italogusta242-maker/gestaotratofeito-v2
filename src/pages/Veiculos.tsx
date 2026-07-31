import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, FileText, DollarSign, MapPin, ShoppingCart, Eye, LayoutGrid, List, Trash2, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import DespesaDialog from "@/components/DespesaDialog";
import VendaDialog from "@/components/VendaDialog";
import ClienteSelector from "@/components/ClienteSelector";
import { differenceInDays } from "date-fns";
import { formatPlaca, cleanPlaca } from "@/lib/format-placa";
import { formatBRL, upperCase } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VeiculoComCentro, CentroCusto } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

const STATUSES = ["Em Estoque", "Preparação", "Na Oficina", "No Despachante", "No Pátio", "Consignado", "Vendido"];

const statusStyle: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Em Estoque": { bg: "bg-emerald-500/5", border: "border-emerald-500/30", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Preparação": { bg: "bg-amber-500/5", border: "border-amber-500/30", text: "text-amber-700", dot: "bg-amber-500" },
  "Na Oficina": { bg: "bg-orange-500/5", border: "border-orange-500/30", text: "text-orange-700", dot: "bg-orange-500" },
  "No Despachante": { bg: "bg-cyan-500/5", border: "border-cyan-500/30", text: "text-cyan-700", dot: "bg-cyan-500" },
  "No Pátio": { bg: "bg-teal-500/5", border: "border-teal-500/30", text: "text-teal-700", dot: "bg-teal-700" },
  "Consignado": { bg: "bg-purple-500/5", border: "border-purple-500/30", text: "text-purple-700", dot: "bg-purple-500" },
  "Vendido": { bg: "bg-blue-500/5", border: "border-blue-500/30", text: "text-blue-700", dot: "bg-blue-500" },
};

export default function Veiculos() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [veiculos, setVeiculos] = useState<VeiculoComCentro[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [despesaVeiculo, setDespesaVeiculo] = useState<VeiculoComCentro | null>(null);
  const [vendaVeiculo, setVendaVeiculo] = useState<VeiculoComCentro | null>(null);
  const [form, setForm] = useState({ placa: "", marca_modelo: "", ano: "", ano_modelo: "", cor: "", renavam: "", chassi: "", combustivel: "", valor_aquisicao: "", centro_custo_id: "", status: "Em Estoque", data_entrada_patio: new Date().toISOString().split("T")[0] });
  const [editingVeiculo, setEditingVeiculo] = useState<VeiculoComCentro | null>(null);
  const [deleteVeiculo, setDeleteVeiculo] = useState<VeiculoComCentro | null>(null);
  const [clienteCompraId, setClienteCompraId] = useState<string | null>(null);
  const [isConsignment, setIsConsignment] = useState(false);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");

  useEffect(() => { load(); }, []);

  async function load() {
    const [v, c] = await Promise.all([
      supabase.from("veiculos").select("*, centros_custo(nome)").order("created_at", { ascending: false }),
      supabase.from("centros_custo").select("*"),
    ]);
    setVeiculos(v.data ?? []);
    setCentros(c.data ?? []);
  }

  function handlePlacaChange(value: string) {
    const formatted = formatPlaca(value);
    setForm({ ...form, placa: formatted });
  }

  function openEdit(v: VeiculoComCentro) {
    setForm({
      placa: v.placa,
      marca_modelo: v.marca_modelo,
      ano: v.ano,
      ano_modelo: v.ano_modelo || v.ano,
      cor: v.cor || "",
      renavam: v.renavam || "",
      chassi: v.chassi || "",
      combustivel: v.combustivel || "",
      valor_aquisicao: String(v.valor_aquisicao),
      centro_custo_id: v.centro_custo_id || "",
      status: v.status,
      data_entrada_patio: v.data_entrada_patio || v.created_at?.split("T")[0],
    });
    setClienteCompraId(v.cliente_compra_id);
    setIsConsignment(v.is_consignment || false);
    setEditingVeiculo(v);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const placaClean = cleanPlaca(form.placa);
    const payload = {
      placa: formatPlaca(form.placa),
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
      status: form.status,
    };

    if (editingVeiculo) {
      const { error } = await supabase.from("veiculos").update(payload).eq("id", editingVeiculo.id);
      if (error) { toast.error(translateError(error)); return; }
      toast.success("Veículo atualizado!");
      setEditingVeiculo(null);
    } else {
      const { error } = await supabase.from("veiculos").insert(payload);
      if (error) { toast.error(translateError(error)); return; }
      toast.success("Veículo cadastrado!");
      setShowAdd(false);
    }

    setClienteCompraId(null);
    setIsConsignment(false);
    setForm({ placa: "", marca_modelo: "", ano: "", ano_modelo: "", cor: "", renavam: "", chassi: "", combustivel: "", valor_aquisicao: "", centro_custo_id: "", status: "Em Estoque", data_entrada_patio: new Date().toISOString().split("T")[0] });
    load();
  }


  async function handleDrop(veiculoId: string, newStatus: string) {
    setDragOverStatus(null);
    setDraggingId(null);
    const veiculo = veiculos.find(v => v.id === veiculoId);
    if (!veiculo || veiculo.status === newStatus) return;
    setVeiculos(prev => prev.map(v => v.id === veiculoId ? { ...v, status: newStatus } : v));
    const { error } = await supabase.from("veiculos").update({ status: newStatus }).eq("id", veiculoId);
    if (error) { toast.error("Erro ao mover veículo"); load(); }
    else { toast.success(`${veiculo.placa} → ${newStatus}`); }
  }

  async function handleDeleteVeiculo() {
    if (!deleteVeiculo) return;
    const { error } = await supabase.from("veiculos").delete().eq("id", deleteVeiculo.id);
    if (error) { toast.error("Erro ao excluir: " + translateError(error)); }
    else { toast.success(`Veículo ${deleteVeiculo.placa} excluído!`); load(); }
    setDeleteVeiculo(null);
  }

  const canWrite = role === "admin" || role === "auxiliar_operacional";
  const isEmissao = role === "auxiliar_emissao";

  function getDiasPatio(v: VeiculoComCentro) {
    const dataEntrada = v.data_entrada_patio ? new Date(v.data_entrada_patio) : new Date(v.created_at);
    return differenceInDays(new Date(), dataEntrada);
  }

  const filtered = veiculos.filter((v) => {
    const q = search.toLowerCase();
    return v.placa.toLowerCase().includes(q) || v.marca_modelo.toLowerCase().includes(q);
  });

  const grouped = STATUSES.reduce<Record<string, VeiculoComCentro[]>>((acc, s) => {
    acc[s] = filtered.filter(v => v.status === s);
    return acc;
  }, {});

  function StatusBadge({ status }: { status: string }) {
    const s = statusStyle[status];
    if (!s) return <Badge variant="secondary">{status}</Badge>;
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.border} ${s.text} border`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
        {status}
      </span>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Veículos</h1>
          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" className="rounded-none h-8 px-3" onClick={() => setViewMode("kanban")}>
              <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
            </Button>
            <Button variant={viewMode === "lista" ? "default" : "ghost"} size="sm" className="rounded-none h-8 px-3" onClick={() => setViewMode("lista")}>
              <List className="h-4 w-4 mr-1" /> Lista
            </Button>
          </div>
          {canWrite && (
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Veículo</DialogTitle></DialogHeader>
                <form onSubmit={handleSave} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Placa</Label>
                      <Input value={form.placa} onChange={(e) => handlePlacaChange(e.target.value)} required placeholder="ABC-1D23" maxLength={8} className="uppercase" />
                    </div>
                    <div><Label>Marca/Modelo</Label><Input value={form.marca_modelo} onChange={(e) => setForm({ ...form, marca_modelo: upperCase(e.target.value) })} required className="uppercase" /></div>
                    <div><Label>Ano Fabricação</Label><Input value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} required placeholder="2020" /></div>
                    <div><Label>Ano Modelo</Label><Input value={form.ano_modelo} onChange={(e) => setForm({ ...form, ano_modelo: e.target.value })} placeholder="2021" /></div>
                    <div><Label>Cor</Label><Input value={form.cor} onChange={(e) => setForm({ ...form, cor: upperCase(e.target.value) })} className="uppercase" /></div>
                    <div><Label>Renavam</Label><Input value={form.renavam} onChange={(e) => setForm({ ...form, renavam: e.target.value })} /></div>
                    <div><Label>Chassi</Label><Input value={form.chassi} onChange={(e) => setForm({ ...form, chassi: upperCase(e.target.value) })} className="uppercase" /></div>
                    <div>
                      <Label>Combustível</Label>
                      <Select value={form.combustivel} onValueChange={(v) => setForm({ ...form, combustivel: v })}>
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
                    <div><Label>Valor Aquisição</Label><Input type="number" step="0.01" value={form.valor_aquisicao} onChange={(e) => setForm({ ...form, valor_aquisicao: e.target.value })} required /></div>
                    <div><Label>Data Entrada Pátio</Label><Input type="date" value={form.data_entrada_patio} onChange={(e) => setForm({ ...form, data_entrada_patio: e.target.value })} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={isConsignment} onCheckedChange={setIsConsignment} />
                    <Label>Veículo Consignado</Label>
                  </div>
                  <ClienteSelector label={isConsignment ? "Dono do Veículo (obrigatório)" : "Comprado de (Cliente)"} value={clienteCompraId} onChange={setClienteCompraId} />
                  <div>
                    <Label>Centro de Custo</Label>
                    <Select value={form.centro_custo_id} onValueChange={(v) => setForm({ ...form, centro_custo_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {centros.filter(c => role === "admin" || c.nome !== "Casa").map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Salvar</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por placa ou modelo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {viewMode === "kanban" ? (
        /* ========== KANBAN VIEW ========== */
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-2 min-h-[400px]" style={{ minWidth: `${STATUSES.length * 220}px` }}>
            {STATUSES.map(status => {
              const style = statusStyle[status];
              const items = grouped[status] ?? [];
              return (
                <div
                  key={status}
                  className={`flex flex-col w-[210px] min-w-[210px] rounded-lg border ${style.border} ${dragOverStatus === status ? "ring-2 ring-primary/40" : ""} transition-all`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("veiculoId"); if (id) handleDrop(id, status); }}
                >
                  <div className={`px-2.5 py-2 rounded-t-lg ${style.bg} border-b ${style.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                      <span className={`text-xs font-semibold ${style.text}`}>{status}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">{items.length}</Badge>
                  </div>

                  <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto max-h-[calc(100vh-280px)]">
                    {items.map(v => {
                      const dias = getDiasPatio(v);
                      return (
                        <div
                          key={v.id}
                          draggable={canWrite && status !== "Vendido"}
                          onDragStart={(e) => { e.dataTransfer.setData("veiculoId", v.id); setDraggingId(v.id); }}
                          onDragEnd={() => setDraggingId(null)}
                          className={`rounded-md border bg-card p-2 space-y-1 cursor-pointer hover:shadow-sm transition-shadow ${draggingId === v.id ? "opacity-50" : ""} ${canWrite && status !== "Vendido" ? "cursor-grab active:cursor-grabbing" : ""}`}
                          onClick={() => navigate(`/veiculos/${v.id}/detalhe`)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs">{formatPlaca(v.placa)}</span>
                            {v.is_consignment && (
                              <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-purple-500/30 text-purple-600">C</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-tight truncate">{v.marca_modelo}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{v.ano}{v.ano_modelo && v.ano_modelo !== v.ano ? `/${v.ano_modelo.slice(-2)}` : ""}</span>
                            {status !== "Vendido" && (
                              <span className={`font-medium ${dias > 60 ? "text-destructive" : dias > 30 ? "text-amber-600" : ""}`}>
                                {dias}d
                              </span>
                            )}
                          </div>
                          {!isEmissao && (
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-muted-foreground">C: {formatBRL(Number(v.valor_aquisicao))}</span>
                              <span className="font-semibold text-emerald-600">V: {v.valor_venda ? formatBRL(Number(v.valor_venda)) : "—"}</span>
                            </div>
                          )}
                          <div className="flex gap-0.5 pt-0.5" onClick={e => e.stopPropagation()}>
                            {canWrite && status !== "Vendido" && (
                              <>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-100" onClick={() => setDespesaVeiculo(v)} title="Lançar Despesa neste Veículo">
                                  <DollarSign className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setVendaVeiculo(v)} title="Vender">
                                  <ShoppingCart className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(v)} title="Editar">
                              <Pencil className="h-3 w-3 text-blue-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => navigate(`/veiculos/${v.id}/detalhe`)} title="Detalhes">
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => navigate(`/recibo/${v.id}`)} title="Recibo">
                              <FileText className="h-3 w-3" />
                            </Button>
                            {canWrite && (
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteVeiculo(v)} title="Excluir Veículo">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="text-center text-[10px] text-muted-foreground py-6 opacity-60">Nenhum veículo</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========== LIST VIEW ========== */
        <div className="flex-1 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Placa</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead className="w-[80px]">Ano/Mod</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[80px]">Local</TableHead>
                {!isEmissao && <TableHead className="w-[110px] text-right">Valor Compra</TableHead>}
                {!isEmissao && <TableHead className="w-[110px] text-right">Valor Venda</TableHead>}
                <TableHead className="w-[130px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(v => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/veiculos/${v.id}/detalhe`)}>
                  <TableCell className="font-mono font-bold text-sm">{formatPlaca(v.placa)}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate" title={v.marca_modelo}>{v.marca_modelo}</TableCell>
                  <TableCell className="text-sm">{v.ano}{(v.ano_modelo && v.ano_modelo !== v.ano) ? `/${v.ano_modelo.slice(-2)}` : ""}</TableCell>
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                  <TableCell className="text-sm flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{v.localizacao || "—"}</TableCell>
                  {!isEmissao && <TableCell className="text-sm text-right font-medium text-muted-foreground">{formatBRL(Number(v.valor_aquisicao))}</TableCell>}
                  {!isEmissao && <TableCell className="text-sm text-right font-semibold text-emerald-600">{v.valor_venda ? formatBRL(Number(v.valor_venda)) : "—"}</TableCell>}
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-0.5">
                      {canWrite && v.status !== "Vendido" && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100" onClick={() => setDespesaVeiculo(v)} title="Lançar Despesa neste Veículo">
                            <Plus className="h-4 w-4 absolute -ml-2 -mt-2 opacity-70" style={{ fontSize: '8px' }} />
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVendaVeiculo(v)} title="Vender">
                            <ShoppingCart className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(v)} title="Editar">
                        <Pencil className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(`/veiculos/${v.id}/detalhe`)} title="Detalhes">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(`/recibo/${v.id}`)} title="Recibo">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      {canWrite && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteVeiculo(v)} title="Excluir Veículo">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length > 0 && (
                <TableRow className="border-b">
                  <TableCell colSpan={isEmissao ? 7 : 8} className="p-0" />
                </TableRow>
              )}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isEmissao ? 7 : 8} className="text-center py-8 text-muted-foreground">Nenhum veículo encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {despesaVeiculo && <DespesaDialog veiculo={despesaVeiculo} onClose={() => { setDespesaVeiculo(null); load(); }} />}
      {vendaVeiculo && <VendaDialog veiculo={vendaVeiculo} onClose={() => { setVendaVeiculo(null); load(); }} />}

      <AlertDialog open={!!deleteVeiculo} onOpenChange={(open) => !open && setDeleteVeiculo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Veículo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o veículo <strong>{deleteVeiculo?.placa}</strong> ({deleteVeiculo?.marca_modelo})? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVeiculo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingVeiculo && (
        <Dialog open onOpenChange={() => setEditingVeiculo(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Editar Veículo: {editingVeiculo.placa}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Placa</Label>
                  <Input value={form.placa} onChange={(e) => handlePlacaChange(e.target.value)} required className="uppercase" />
                </div>
                <div><Label>Marca/Modelo</Label><Input value={form.marca_modelo} onChange={(e) => setForm({ ...form, marca_modelo: upperCase(e.target.value) })} required className="uppercase" /></div>
                <div><Label>Ano Fabricação</Label><Input value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} required /></div>
                <div><Label>Ano Modelo</Label><Input value={form.ano_modelo} onChange={(e) => setForm({ ...form, ano_modelo: e.target.value })} /></div>
                <div><Label>Cor</Label><Input value={form.cor} onChange={(e) => setForm({ ...form, cor: upperCase(e.target.value) })} className="uppercase" /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Valor Aquisição</Label><Input type="number" step="0.01" value={form.valor_aquisicao} onChange={(e) => setForm({ ...form, valor_aquisicao: e.target.value })} required /></div>
                <div><Label>Data Entrada Pátio</Label><Input type="date" value={form.data_entrada_patio} onChange={(e) => setForm({ ...form, data_entrada_patio: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isConsignment} onCheckedChange={setIsConsignment} />
                <Label>Veículo Consignado</Label>
              </div>
              <ClienteSelector label={isConsignment ? "Dono do Veículo" : "Comprado de"} value={clienteCompraId} onChange={setClienteCompraId} />
              <div>
                <Label>Centro de Custo</Label>
                <Select value={form.centro_custo_id} onValueChange={(v) => setForm({ ...form, centro_custo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Atualizar Veículo</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
