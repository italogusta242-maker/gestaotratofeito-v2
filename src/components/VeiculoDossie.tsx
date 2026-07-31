import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { FileText, Upload, Trash2, Download, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { translateError } from "@/lib/supabase-errors";
import type { Veiculo, Transacao } from "@/lib/db-types";

interface Props {
  veiculo: Veiculo;
  onClose: () => void;
  isEmissao: boolean;
}

const statusOptions = ["Em Estoque", "Preparação", "Na Oficina", "No Despachante", "No Pátio", "Consignado", "Vendido"];
const localizacaoOptions = ["Pátio", "Oficina", "Despachante", "Lavagem", "Funilaria", "Cliente", "Outro"];

export default function VeiculoDossie({ veiculo, onClose, isEmissao }: Props) {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "auxiliar_operacional";
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [status, setStatus] = useState(veiculo.status);
  const [localizacao, setLocalizacao] = useState(veiculo.localizacao || "Pátio");
  const [docs, setDocs] = useState<{ name: string; created_at?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    const { data } = await supabase.storage.from("veiculos-docs").list(veiculo.id, { limit: 50 });
    setDocs(data ?? []);
  }, [veiculo.id]);

  useEffect(() => {
    supabase.from("transacoes").select("*").eq("veiculo_id", veiculo.id).order("created_at", { ascending: false })
      .then(({ data }) => setTransacoes(data ?? []));
    loadDocs();
  }, [veiculo.id, loadDocs]);

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    await supabase.from("veiculos").update({ status: newStatus }).eq("id", veiculo.id);
    toast.success(`Status atualizado para "${newStatus}"`);
  }

  async function handleLocalizacaoChange(newLoc: string) {
    setLocalizacao(newLoc);
    await supabase.from("veiculos").update({ localizacao: newLoc }).eq("id", veiculo.id);
    toast.success(`Localização atualizada para "${newLoc}"`);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${veiculo.id}/${Date.now()}_${file.name}`;
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

  async function handleDelete(name: string) {
    if (!confirm(`Remover o documento "${name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.storage.from("veiculos-docs").remove([`${veiculo.id}/${name}`]);
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Documento removido");
    loadDocs();
  }

  async function openDoc(name: string) {
    const { data, error } = await supabase.storage
      .from("veiculos-docs")
      .createSignedUrl(`${veiculo.id}/${name}`, 60 * 5);
    if (error || !data) {
      toast.error("Não foi possível abrir o documento");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  const receitas = transacoes.filter(t => t.tipo === "Receita").reduce((s, t) => s + Number(t.valor), 0);
  const despesas = transacoes.filter(t => t.tipo === "Despesa").reduce((s, t) => s + Number(t.valor), 0);
  const lucro = receitas - Number(veiculo.valor_aquisicao) - despesas;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dossiê — {veiculo.placa} ({veiculo.marca_modelo})</DialogTitle>
        </DialogHeader>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Ano:</strong> {veiculo.ano}</div>
          <div><strong>Cor:</strong> {veiculo.cor ?? "—"}</div>
          <div><strong>Renavam:</strong> {veiculo.renavam ?? "—"}</div>
          <div className="flex items-center gap-2">
            <strong>Status:</strong>
            {canWrite && status !== "Vendido" ? (
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-7 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Badge variant="outline">{status}</Badge>
            )}
            {veiculo.is_consignment && <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20" variant="outline">Consignado</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <strong>Local:</strong>
            {canWrite ? (
              <Select value={localizacao} onValueChange={handleLocalizacaoChange}>
                <SelectTrigger className="h-7 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{localizacaoOptions.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <span>{localizacao}</span>
            )}
          </div>
          {!isEmissao && <div><strong>Valor Aquisição:</strong> {formatBRL(Number(veiculo.valor_aquisicao))}</div>}
        </div>

        {/* Financial Summary */}
        {!isEmissao && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="text-lg font-bold text-emerald-500">{formatBRL(receitas)}</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-lg font-bold text-destructive">{formatBRL(despesas)}</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Lucro Real</p>
              <p className={`text-lg font-bold ${lucro >= 0 ? "text-emerald-500" : "text-destructive"}`}>{formatBRL(lucro)}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 print:hidden">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(`/veiculos/${veiculo.id}/contrato-compra`, "_blank")}>
            <FileText className="h-3.5 w-3.5" /> Gerar Contrato
          </Button>
        </div>

        {/* Documents Upload */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Anexos / Documentos</h3>
            {canWrite && (
              <div>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
                <Button size="sm" variant="outline" className="gap-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Enviar
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {docs.map(d => (
              <div key={d.name} className="flex items-center justify-between py-1 border-b text-sm">
                <span className="truncate max-w-[300px]">{d.name.replace(/^\d+_/, "")}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDoc(d.name)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canWrite && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(d.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {docs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>}
          </div>
        </div>

        {/* Transactions */}
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Transações</h3>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {transacoes.map(tx => (
              <div key={tx.id} className="flex justify-between items-center py-1.5 border-b text-sm">
                <div>
                  <span>{tx.descricao}</span>
                  <span className="text-xs text-muted-foreground ml-2">{format(new Date(tx.created_at), "dd/MM/yyyy")}</span>
                </div>
                <span className={tx.tipo === "Receita" ? "text-emerald-500 font-medium" : "text-destructive font-medium"}>
                  {tx.tipo === "Receita" ? "+" : "-"}{formatBRL(Number(tx.valor))}
                </span>
              </div>
            ))}
            {transacoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma transação vinculada.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
