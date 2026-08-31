import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface AuditRow {
  id: number;
  table_name: string;
  row_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
}

const TABLES = [
  { value: "__all__", label: "Todas as tabelas" },
  { value: "veiculos", label: "Veículos" },
  { value: "clientes", label: "Clientes" },
  { value: "transacoes", label: "Transações" },
  { value: "contas_bancarias", label: "Contas Bancárias" },
  { value: "chaves_pix", label: "Chaves PIX" },
  { value: "centros_custo", label: "Centros de Custo" },
  { value: "cartoes", label: "Cartões" },
  { value: "financiamentos", label: "Financiamentos" },
  { value: "contas_fixas", label: "Contas Fixas" },
  { value: "user_roles", label: "Perfis de Acesso" },
];

const actionColor: Record<string, string> = {
  INSERT: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  UPDATE: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  DELETE: "bg-red-500/10 text-red-700 border-red-500/30",
};

const actionLabel: Record<string, string> = {
  INSERT: "Criado",
  UPDATE: "Editado",
  DELETE: "Excluído",
};

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function Auditoria() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabela, setTabela] = useState<string>("__all__");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [busca, setBusca] = useState<string>("");
  const [detalhe, setDetalhe] = useState<AuditRow | null>(null);
  const [expandido, setExpandido] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    let q = supabase.from("audit_logs").select("*").order("changed_at", { ascending: false }).limit(500);
    if (tabela !== "__all__") q = q.eq("table_name", tabela);
    if (dataInicio) q = q.gte("changed_at", dataInicio);
    if (dataFim) q = q.lte("changed_at", `${dataFim}T23:59:59`);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar auditoria");
      return;
    }
    setRows((data ?? []) as AuditRow[]);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tabela, dataInicio, dataFim]);

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r =>
      (r.user_name ?? "").toLowerCase().includes(q) ||
      (r.user_email ?? "").toLowerCase().includes(q) ||
      (r.row_id ?? "").toLowerCase().includes(q)
    );
  }, [rows, busca]);

  function toggleExpand(id: number) {
    setExpandido(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Histórico de alterações no sistema — quem fez o quê e quando.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Tabela</Label>
              <Select value={tabela} onValueChange={setTabela}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TABLES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>De</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div>
              <Label>Buscar usuário / ID</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, e-mail ou id" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-[160px]">Quando</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead className="w-[100px]">Ação</TableHead>
                <TableHead className="w-[160px]">Tabela</TableHead>
                <TableHead>Resumo</TableHead>
                <TableHead className="w-[100px] text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
              )}
              {!loading && filtered.map(r => {
                const isOpen = expandido.has(r.id);
                const changesKeys = r.changes ? Object.keys(r.changes) : [];
                const resumo = r.action === "UPDATE"
                  ? changesKeys.slice(0, 3).join(", ") + (changesKeys.length > 3 ? ` +${changesKeys.length - 3}` : "")
                  : r.action === "INSERT"
                    ? "Registro criado"
                    : "Registro excluído";
                return (
                  <Fragment key={r.id}>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell>
                        {r.action === "UPDATE" && changesKeys.length > 0 && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleExpand(r.id)}>
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(r.changed_at), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.user_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.user_email ?? "sistema"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={actionColor[r.action]}>{actionLabel[r.action]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.table_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{resumo}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetalhe(r)}>Ver</Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && r.changes && (
                      <TableRow className="bg-muted/20">
                        <TableCell />
                        <TableCell colSpan={6} className="py-2">
                          <div className="text-xs space-y-1">
                            {Object.entries(r.changes).map(([campo, diff]) => (
                              <div key={campo} className="flex gap-2 items-start">
                                <span className="font-mono font-semibold min-w-[120px]">{campo}:</span>
                                <span className="text-red-600 line-through max-w-[300px] truncate" title={formatVal(diff.old)}>{formatVal(diff.old)}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-emerald-700 max-w-[300px] truncate" title={formatVal(diff.new)}>{formatVal(diff.new)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da alteração</DialogTitle></DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-semibold">Tabela:</span> {detalhe.table_name}</div>
                <div><span className="font-semibold">ID:</span> <span className="font-mono text-xs">{detalhe.row_id}</span></div>
                <div><span className="font-semibold">Quem:</span> {detalhe.user_name ?? "—"} ({detalhe.user_email ?? "sistema"})</div>
                <div><span className="font-semibold">Quando:</span> {format(new Date(detalhe.changed_at), "dd/MM/yyyy HH:mm:ss")}</div>
                <div><span className="font-semibold">Ação:</span> {actionLabel[detalhe.action]}</div>
              </div>
              {detalhe.changes && (
                <div>
                  <div className="font-semibold mb-1">Campos alterados</div>
                  <div className="border rounded-md p-2 space-y-1 text-xs font-mono bg-muted/30 max-h-64 overflow-y-auto">
                    {Object.entries(detalhe.changes).map(([c, d]) => (
                      <div key={c}>
                        <div className="font-semibold">{c}</div>
                        <div className="pl-3 text-red-600">- {formatVal(d.old)}</div>
                        <div className="pl-3 text-emerald-700">+ {formatVal(d.new)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detalhe.action === "DELETE" && detalhe.old_data && (
                <div>
                  <div className="font-semibold mb-1">Dados excluídos</div>
                  <pre className="border rounded-md p-2 text-xs bg-muted/30 max-h-64 overflow-auto">{JSON.stringify(detalhe.old_data, null, 2)}</pre>
                </div>
              )}
              {detalhe.action === "INSERT" && detalhe.new_data && (
                <div>
                  <div className="font-semibold mb-1">Dados inseridos</div>
                  <pre className="border rounded-md p-2 text-xs bg-muted/30 max-h-64 overflow-auto">{JSON.stringify(detalhe.new_data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
