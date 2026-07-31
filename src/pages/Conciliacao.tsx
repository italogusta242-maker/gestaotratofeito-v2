import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Check, X, Plus, Settings, Link2, FilePlus, Search } from "lucide-react";
import Papa from "papaparse";
import * as pdfjsLib from "pdfjs-dist";
import { formatBRL } from "@/lib/format";

// Configuração do Web Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

interface ExtractLine {
  data: string;
  descricao: string;
  valor: number;
  tipo: "Receita" | "Despesa";
  categoria_sugerida: string;
  centro_custo_sugerido: string | null;
  selected: boolean;
  acao: "criar" | "vincular" | "ignorar";
  transacao_vinculada_id: string | null;
  veiculo_id: string | null;
  forma_pagamento: string;
  favorecido_pagador: string;
}

export default function Conciliacao() {
  const { user } = useAuth();
  const [lines, setLines] = useState<ExtractLine[]>([]);
  const [regras, setRegras] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [contaId, setContaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("importar");

  // Match modal
  const [matchIdx, setMatchIdx] = useState<number | null>(null);
  const [matchSearch, setMatchSearch] = useState("");
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  // Create modal
  const [createIdx, setCreateIdx] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({ categoria: "", centro_custo_id: "", veiculo_id: "", destinoCusto: "" as "Loja" | "Veículo" | "", forma_pagamento: "PIX", favorecido_pagador: "" });
  const [veiculos, setVeiculos] = useState<any[]>([]);

  // Rule form
  const [showAddRegra, setShowAddRegra] = useState(false);
  const [regraForm, setRegraForm] = useState({ palavra_chave: "", categoria_sugerida: "", centro_custo_sugerido: "" });

  useEffect(() => { loadMeta(); }, []);

  async function loadMeta() {
    const [r, cc, ct, v] = await Promise.all([
      supabase.from("regras_categorizacao").select("*, centros_custo(nome)").order("palavra_chave"),
      supabase.from("centros_custo").select("*"),
      supabase.from("contas_bancarias").select("*"),
      supabase.from("veiculos").select("id, placa, marca_modelo, status").order("created_at", { ascending: false }),
    ]);
    setRegras(r.data ?? []);
    setCentros(cc.data ?? []);
    setContas(ct.data ?? []);
    setVeiculos(v.data ?? []);
  }

  function matchRule(descricao: string) {
    const lower = descricao.toLowerCase();
    return regras.find(r => lower.includes(r.palavra_chave.toLowerCase()));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "ofx") {
      const reader = new FileReader();
      reader.onload = (ev) => parseOFX(ev.target?.result as string);
      reader.readAsText(file);
    } else if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (result) => {
          if (result.errors?.length) {
            console.warn("CSV parse warnings:", result.errors);
          }
          if (!result.data?.length) {
            toast.error("Nenhuma linha encontrada no CSV.");
            return;
          }
          parseCSV(result.data as any[]);
        },
        error: (err: any) => {
          console.error("Erro ao processar CSV:", err);
          toast.error("Erro ao processar o arquivo CSV.");
        },
      });
    } else if (ext === "pdf") {
      parsePDF(file);
    } else {
      toast.error("Formato não suportado. Use .ofx, .csv ou .pdf (Nubank)");
    }
  }

  async function parsePDF(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join("\n");
        fullText += pageText + "\n";
      }

      // Nubank PDF Regex Pattern
      // Example line: "01 FEV 2026 Total de saídas - 345,00\nTransferência enviada pelo Pix Erick Luan..."
      // Or: "Pagamento de boleto efetuado ALL CARE ADM BENEF SP LTDA 999,43"

      const transactions: ExtractLine[] = [];
      const lines = fullText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

      let currentData = "";
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        // Month translation
        const months: Record<string, string> = { JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06", JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12" };

        // Detect Date Headers (e.g., "01 FEV 2026")
        const dateMatch = line.match(/^(\d{2})\s([A-Z]{3})\s(\d{4})/);
        if (dateMatch) {
          currentData = `${dateMatch[3]}-${months[dateMatch[2]]}-${dateMatch[1]}`;
        }

        // Look for transaction markers
        const isTransferencia = line.startsWith("Transferência enviada") || line.startsWith("Transferência recebida") || line.startsWith("Transferência Recebida");
        const isCompra = line.startsWith("Compra no débito") || line.startsWith("Pagamento de boleto") || line.startsWith("Pagamento de fatura");
        const isEstorno = line.startsWith("Estorno");

        if (isTransferencia || isCompra || isEstorno) {
          let descricao = line;
          let valor = 0;
          let j = i + 1;

          // Accumulate next lines for description until we hit the value
          let valueFound = false;
          while (j < lines.length) {
            const nextLine = lines[j];
            // Check if it's a value (format: 1.000,00 or 150,00)
            const isValue = /^[\d\.]+,[0-9]{2}$/.test(nextLine.replace("- ", ""));

            if (isValue) {
              valor = parseFloat(nextLine.replace("- ", "").replace(".", "").replace(",", "."));
              valueFound = true;
              break;
            } else if (nextLine.match(/^(\d{2})\s([A-Z]{3})\s(\d{4})/) || nextLine.startsWith("Saldo do dia") || nextLine.startsWith("Total de entradas") || nextLine.startsWith("Total de saídas")) {
              // Hit next transaction or summary, abort
              break;
            } else {
              descricao += " " + nextLine; // Append multi-line description
            }
            j++;
          }

          if (valueFound) {
            // Determine type
            let tipo: "Receita" | "Despesa" = "Despesa";
            if (line.includes("recebida") || line.includes("Recebida") || (isEstorno && line.includes("saída"))) {
              tipo = "Receita";
            }

            // Extract Name/Payee for Pix if possible
            let favorecido = "";
            let formaPgto = "Transferência";

            if (descricao.includes("Pix")) {
              formaPgto = "PIX";
              const parts = descricao.split(" - ");
              if (parts.length > 1 && parts[0].includes("Pix")) {
                favorecido = parts[0].replace(/Transferência (enviada|recebida|Recebida) pelo Pix /i, "").trim();
              }
            } else if (descricao.includes("boleto")) {
              formaPgto = "Boleto";
              favorecido = descricao.replace("Pagamento de boleto efetuado ", "").trim();
            } else if (descricao.includes("débito")) {
              formaPgto = "Débito";
              favorecido = descricao.replace("Compra no débito ", "").trim();
            }

            const rule = matchRule(descricao);

            transactions.push({
              data: currentData || new Date().toISOString().split("T")[0],
              descricao: descricao,
              valor: valor,
              tipo: tipo,
              categoria_sugerida: rule?.categoria_sugerida ?? "",
              centro_custo_sugerido: rule?.centro_custo_sugerido ?? null,
              selected: true,
              acao: "criar",
              transacao_vinculada_id: null,
              veiculo_id: null,
              forma_pagamento: formaPgto,
              favorecido_pagador: favorecido || "",
            });
            i = j; // Skip lines we just processed
          }
        }
        i++;
      }

      setLines(transactions);
      toast.success(`${transactions.length} transações importadas do PDF!`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao ler PDF Nubank. Formato não reconhecido.");
    }
  }

  function parseOFX(text: string) {
    const transactions: ExtractLine[] = [];
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;
    while ((match = stmtTrnRegex.exec(text)) !== null) {
      const block = match[1];
      const getValue = (tag: string) => {
        const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(block);
        return m ? m[1].trim() : "";
      };
      const dtPosted = getValue("DTPOSTED");
      const trnAmt = parseFloat(getValue("TRNAMT")) || 0;
      const memo = getValue("MEMO") || getValue("NAME");
      const dateFormatted = dtPosted.length >= 8
        ? `${dtPosted.substring(0, 4)}-${dtPosted.substring(4, 6)}-${dtPosted.substring(6, 8)}`
        : new Date().toISOString().split("T")[0];

      const rule = matchRule(memo);
      transactions.push({
        data: dateFormatted,
        descricao: memo,
        valor: Math.abs(trnAmt),
        tipo: trnAmt >= 0 ? "Receita" : "Despesa",
        categoria_sugerida: rule?.categoria_sugerida ?? "",
        centro_custo_sugerido: rule?.centro_custo_sugerido ?? null,
        selected: true,
        acao: "criar",
        transacao_vinculada_id: null,
        veiculo_id: null,
        forma_pagamento: "PIX", // Default
        favorecido_pagador: "",
      });
    }
    setLines(transactions);
    if (transactions.length === 0) toast.info("Nenhuma transação encontrada no arquivo OFX.");
    else toast.success(`${transactions.length} transações carregadas!`);
  }

  function parseCSV(data: any[]) {
    const transactions: ExtractLine[] = data.map((row) => {
      // Improved matching for description and value
      const desc = row.descricao || row.Descricao || row.DESCRICAO || row.memo || row.Memo || row.historico || row.Historico || "";
      const valText = String(row.valor || row.Valor || row.VALOR || row.valor_lancamento || "0");
      const val = parseFloat(valText.replace("R$", "").replace(".", "").replace(",", ".")) || 0;
      const date = row.data || row.Data || row.DATA || row.data_movimentacao || new Date().toISOString().split("T")[0];
      const rule = matchRule(desc as string);
      return {
        data: String(date), descricao: String(desc), valor: Math.abs(val),
        tipo: val >= 0 ? "Receita" as const : "Despesa" as const,
        categoria_sugerida: rule?.categoria_sugerida ?? "",
        centro_custo_sugerido: rule?.centro_custo_sugerido ?? null,
        selected: true, acao: "criar" as const, transacao_vinculada_id: null, veiculo_id: null,
        forma_pagamento: "PIX", favorecido_pagador: "",
      };
    });
    setLines(transactions);
    toast.success(`${transactions.length} linhas importadas!`);
  }

  function toggleLine(idx: number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, selected: !l.selected } : l));
  }

  function updateLine(idx: number, field: keyof ExtractLine, value: any) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  // Match: search existing pending transactions
  async function searchTransacoes(valor: number, descricao: string) {
    setMatchLoading(true);
    const margin = valor * 0.05; // 5% margin
    const { data } = await supabase.from("transacoes")
      .select("id, descricao, valor, tipo, status, data_vencimento, categoria")
      .gte("valor", valor - margin).lte("valor", valor + margin)
      .in("status", ["Pendente", "A Pagar"])
      .order("data_vencimento", { ascending: false })
      .limit(20);
    setMatchResults(data ?? []);
    setMatchLoading(false);
  }

  function openMatchModal(idx: number) {
    const line = lines[idx];
    setMatchIdx(idx);
    setMatchSearch(line.descricao);
    searchTransacoes(line.valor, line.descricao);
  }

  function vincularTransacao(txId: string) {
    if (matchIdx === null) return;
    setLines(prev => prev.map((l, i) => i === matchIdx ? { ...l, acao: "vincular", transacao_vinculada_id: txId, selected: true } : l));
    setMatchIdx(null);
    toast.success("Transação vinculada!");
  }

  function openCreateModal(idx: number) {
    const line = lines[idx];
    setCreateIdx(idx);
    setCreateForm({
      categoria: line.categoria_sugerida,
      centro_custo_id: line.centro_custo_sugerido ?? "",
      veiculo_id: "",
      destinoCusto: line.centro_custo_sugerido ? "Loja" : "",
      forma_pagamento: "PIX",
      favorecido_pagador: "",
    });
  }

  function confirmarCreate() {
    if (createIdx === null) return;
    if (!createForm.destinoCusto) { toast.error("Selecione Destino do Custo"); return; }
    if (createForm.destinoCusto === "Loja" && !createForm.centro_custo_id) { toast.error("Selecione Centro de Custo da Loja"); return; }
    if (createForm.destinoCusto === "Veículo" && !createForm.veiculo_id) { toast.error("Selecione o Veículo"); return; }

    setLines(prev => prev.map((l, i) => i === createIdx ? {
      ...l, acao: "criar", categoria_sugerida: createForm.categoria,
      centro_custo_sugerido: createForm.destinoCusto === "Loja" ? createForm.centro_custo_id || null : null,
      veiculo_id: createForm.destinoCusto === "Veículo" ? createForm.veiculo_id || null : null, selected: true,
      forma_pagamento: createForm.forma_pagamento,
      favorecido_pagador: createForm.favorecido_pagador,
    } : l));
    setCreateIdx(null);
    toast.success("Configurado para criar nova transação!");
  }

  async function confirmarSelecionados() {
    const selected = lines.filter(l => l.selected && l.acao !== "ignorar");
    if (!selected.length) { toast.error("Selecione ao menos uma transação."); return; }
    setLoading(true);

    try {
      // Process "vincular" lines - update existing transactions
      const vincular = selected.filter(l => l.acao === "vincular" && l.transacao_vinculada_id);
      for (const l of vincular) {
        await supabase.from("transacoes").update({
          status: "Pago",
          data_pagamento: l.data,
          conta_bancaria_id: contaId || null,
        }).eq("id", l.transacao_vinculada_id!);
      }

      // Process "criar" lines - insert new transactions
      const criar = selected.filter(l => l.acao === "criar");
      if (criar.length > 0) {
        const inserts = criar.map(l => ({
          descricao: l.descricao,
          valor: l.valor,
          tipo: l.tipo,
          status: "Pago" as const,
          data_vencimento: l.data,
          data_pagamento: l.data,
          conta_bancaria_id: contaId || null,
          centro_custo_id: l.centro_custo_sugerido || null,
          categoria: l.categoria_sugerida || "Importado",
          veiculo_id: l.veiculo_id || null,
          forma_pagamento: l.forma_pagamento,
          favorecido_pagador: l.favorecido_pagador,
          user_id: user?.id,
        }));
        const { error } = await supabase.from("transacoes").insert(inserts);
        if (error) throw error;
      }

      toast.success(`${selected.length} transações processadas! (${vincular.length} vinculadas, ${criar.length} criadas)`);
      setLines(prev => prev.filter(l => !l.selected || l.acao === "ignorar"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addRegra(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("regras_categorizacao").insert({
      palavra_chave: regraForm.palavra_chave,
      categoria_sugerida: regraForm.categoria_sugerida || null,
      centro_custo_sugerido: regraForm.centro_custo_sugerido || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Regra criada!");
    setShowAddRegra(false);
    setRegraForm({ palavra_chave: "", categoria_sugerida: "", centro_custo_sugerido: "" });
    loadMeta();
  }

  async function deleteRegra(id: string) {
    await supabase.from("regras_categorizacao").delete().eq("id", id);
    loadMeta();
  }

  const acaoLabel: Record<string, string> = { criar: "Criar Nova", vincular: "Vinculada ✓", ignorar: "Ignorar" };
  const acaoColor: Record<string, string> = { criar: "", vincular: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", ignorar: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Conciliação Bancária</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="importar">Importar Extrato</TabsTrigger>
          <TabsTrigger value="regras">Regras de Categorização</TabsTrigger>
        </TabsList>

        <TabsContent value="importar" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>Arquivo Caixa (OFX, CSV, PDF)</Label>
              <Input type="file" accept=".ofx,.csv,.pdf" onChange={handleFileUpload} className="w-64" />
            </div>
            <div>
              <Label>Conta Bancária de Destino</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {lines.length > 0 && (
              <Button onClick={confirmarSelecionados} disabled={loading}>
                <Check className="h-4 w-4 mr-1" /> Confirmar ({lines.filter(l => l.selected && l.acao !== "ignorar").length})
              </Button>
            )}
          </div>

          {lines.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição (Extrato)</TableHead>
                      <TableHead>Categoria / Favorecido</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => (
                      <TableRow key={idx} className={l.selected ? "" : "opacity-40"}>
                        <TableCell>
                          <Checkbox checked={l.selected} onCheckedChange={() => toggleLine(idx)} />
                        </TableCell>
                        <TableCell className="text-sm">{l.data}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={l.descricao}>{l.descricao}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            {l.acao === "criar" ? (
                              <>
                                <span className="text-xs font-semibold text-emerald-600">{l.categoria_sugerida || "Sem Categoria"}</span>
                                <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[150px]">{l.favorecido_pagador || "Favorecido não inf."}</span>
                                <span className="text-[10px] text-primary">{l.forma_pagamento}</span>
                              </>
                            ) : l.acao === "vincular" ? (
                              <span className="text-xs italic text-blue-600">Vinculado a transação existente</span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Ação pendente</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{formatBRL(l.valor)}</TableCell>
                        <TableCell>
                          <Badge variant={l.tipo === "Receita" ? "secondary" : "destructive"}>{l.tipo}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant={l.acao === "vincular" ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => openMatchModal(idx)}>
                              <Link2 className="h-3 w-3" /> {l.acao === "vincular" ? "Vinculada ✓" : "Vincular"}
                            </Button>
                            <Button size="sm" variant={l.acao === "criar" ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => openCreateModal(idx)}>
                              <FilePlus className="h-3 w-3" /> Criar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateLine(idx, "acao", l.acao === "ignorar" ? "criar" : "ignorar")}>
                              {l.acao === "ignorar" ? "↩ Desfazer" : <X className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="regras" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showAddRegra} onOpenChange={setShowAddRegra}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova Regra</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Regra de Categorização</DialogTitle></DialogHeader>
                <form onSubmit={addRegra} className="space-y-3">
                  <div><Label>Palavra-chave (no extrato)</Label><Input value={regraForm.palavra_chave} onChange={(e) => setRegraForm({ ...regraForm, palavra_chave: e.target.value })} required placeholder="Ex: UBER, PIX, ENERGIA" /></div>
                  <div><Label>Categoria Sugerida</Label><Input value={regraForm.categoria_sugerida} onChange={(e) => setRegraForm({ ...regraForm, categoria_sugerida: e.target.value })} placeholder="Ex: Transporte, Alimentação" /></div>
                  <div><Label>Centro de Custo</Label>
                    <Select value={regraForm.centro_custo_sugerido} onValueChange={(v) => setRegraForm({ ...regraForm, centro_custo_sugerido: v })}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>{centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Salvar Regra</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Palavra-chave</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Centro Custo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regras.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.palavra_chave}</TableCell>
                      <TableCell>{r.categoria_sugerida ?? "—"}</TableCell>
                      <TableCell>{r.centros_custo?.nome ?? "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteRegra(r.id)}><X className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {regras.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma regra cadastrada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Vincular transação existente */}
      <Dialog open={matchIdx !== null} onOpenChange={() => setMatchIdx(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vincular a Transação Existente</DialogTitle></DialogHeader>
          {matchIdx !== null && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Extrato: <strong>{lines[matchIdx]?.descricao}</strong> — {formatBRL(lines[matchIdx]?.valor ?? 0)}
              </p>
              <div className="flex gap-2">
                <Input placeholder="Buscar por descrição..." value={matchSearch} onChange={e => setMatchSearch(e.target.value)} className="flex-1" />
                <Button size="sm" variant="outline" onClick={() => {
                  if (matchIdx !== null) {
                    setMatchLoading(true);
                    supabase.from("transacoes")
                      .select("id, descricao, valor, tipo, status, data_vencimento, categoria")
                      .ilike("descricao", `%${matchSearch}%`)
                      .in("status", ["Pendente", "A Pagar"])
                      .order("data_vencimento", { ascending: false })
                      .limit(20)
                      .then(({ data }) => { setMatchResults(data ?? []); setMatchLoading(false); });
                  }
                }}>
                  <Search className="h-3 w-3" />
                </Button>
              </div>
              {matchLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>
              ) : matchResults.length > 0 ? (
                <div className="space-y-1">
                  {matchResults.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between border rounded p-2 hover:bg-accent cursor-pointer" onClick={() => vincularTransacao(tx.id)}>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[250px]">{tx.descricao}</p>
                        <p className="text-xs text-muted-foreground">{tx.data_vencimento} • {tx.status} • {tx.categoria ?? "—"}</p>
                      </div>
                      <span className="text-sm font-bold">{formatBRL(tx.valor)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação pendente encontrada com valor aproximado.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Criar nova transação com detalhes */}
      <Dialog open={createIdx !== null} onOpenChange={() => setCreateIdx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurar Nova Transação</DialogTitle></DialogHeader>
          {createIdx !== null && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {lines[createIdx]?.descricao} — {formatBRL(lines[createIdx]?.valor ?? 0)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={createForm.forma_pagamento} onValueChange={v => setCreateForm({ ...createForm, forma_pagamento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="TED">TED</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Favorecido/Pagador</Label>
                  <Input value={createForm.favorecido_pagador} onChange={e => setCreateForm({ ...createForm, favorecido_pagador: e.target.value })} placeholder="Nome da pessoa/empresa" />
                </div>
              </div>

              <div>
                <Label>Categoria</Label>
                <Select value={createForm.categoria} onValueChange={v => setCreateForm({ ...createForm, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {createForm.destinoCusto === "Loja" ? (
                      <>
                        <SelectItem value="Aluguel">Aluguel</SelectItem>
                        <SelectItem value="Água/Luz/Internet">Água/Luz/Internet</SelectItem>
                        <SelectItem value="Folha">Folha</SelectItem>
                        <SelectItem value="Impostos">Impostos</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="Funilaria/Pintura">Funilaria/Pintura</SelectItem>
                        <SelectItem value="Mecânica">Mecânica</SelectItem>
                        <SelectItem value="Estética">Estética</SelectItem>
                        <SelectItem value="Taxas/Despachante">Taxas/Despachante</SelectItem>
                        <SelectItem value="Combustível">Combustível</SelectItem>
                        <SelectItem value="Compra/Venda">Compra/Venda</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={confirmarCreate}>Confirmar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
