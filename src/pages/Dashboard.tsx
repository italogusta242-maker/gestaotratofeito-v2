import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Car, TrendingUp, TrendingDown, DollarSign, AlertTriangle, CreditCard, CalendarClock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ExportBackup from "@/components/ExportBackup";
import { format, startOfMonth, endOfMonth, subWeeks, startOfWeek, endOfWeek, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";
import type { Transacao, VeiculoComCentro, ContaFixa } from "@/lib/db-types";

type ContaFixaComCentro = ContaFixa & { centros_custo: { nome: string } | null };

// Centros são resolvidos por nome no runtime (evita hardcode de UUIDs)
const CENTRO_NOMES = {
  escritorio: "Escritório",
  trato: "Trato Feito",
  casa: "Casa/Sócios",
} as const;

type TabKey = "tudo" | "escritorio" | "trato" | "casa";

export default function Dashboard() {
  const { role } = useAuth();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoComCentro[]>([]);
  const [contasFixas, setContasFixas] = useState<ContaFixaComCentro[]>([]);
  const [saldosBancarios, setSaldosBancarios] = useState<{ nome: string; saldo: number }[]>([]);
  const [centros, setCentros] = useState<{ id: string; nome: string }[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("tudo");
  const [loading, setLoading] = useState(true);

  const { now, mesInicio, mesFim } = useMemo(() => {
    const now = new Date();
    return {
      now,
      mesInicio: startOfMonth(now).toISOString().split("T")[0],
      mesFim: endOfMonth(now).toISOString().split("T")[0],
    };
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [txRes, veicRes, fixasRes, contasRes, txAllRes, centrosRes] = await Promise.all([
      supabase.from("transacoes").select("*").order("data_vencimento", { ascending: true }),
      supabase.from("veiculos").select("*, centros_custo(nome)").eq("status", "Em Estoque"),
      supabase.from("contas_fixas").select("*, centros_custo(nome)").eq("ativo", true),
      supabase.from("contas_bancarias").select("*"),
      supabase.from("transacoes").select("valor, tipo, conta_bancaria_id").eq("status", "Pago").not("conta_bancaria_id", "is", null),
      supabase.from("centros_custo").select("id, nome"),
    ]);

    const errors = [txRes, veicRes, fixasRes, contasRes, txAllRes, centrosRes]
      .map((r) => r.error)
      .filter(Boolean);
    if (errors.length > 0) {
      console.error("Dashboard load errors:", errors);
      toast.error("Falha ao carregar alguns dados do dashboard");
    }

    setTransacoes(txRes.data ?? []);
    setVeiculos(veicRes.data ?? []);
    setContasFixas(fixasRes.data ?? []);
    setCentros(centrosRes.data ?? []);

    const contas = contasRes.data ?? [];
    const txAll = txAllRes.data ?? [];
    const balances = contas.map((c) => {
      const movements = txAll.filter((t) => t.conta_bancaria_id === c.id);
      const totalIn = movements.filter((t) => t.tipo === "Receita" || (t.tipo === "Transferencia_Interna" && Number(t.valor) > 0)).reduce((s, t) => s + Number(t.valor), 0);
      const totalOut = movements.filter((t) => t.tipo === "Despesa" || (t.tipo === "Transferencia_Interna" && Number(t.valor) < 0)).reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
      return { nome: c.nome, saldo: Number(c.saldo_inicial) + totalIn - totalOut };
    });
    setSaldosBancarios(balances);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filterByCentro = useCallback(
    <T extends Record<string, unknown>>(items: T[], tab: TabKey, field = "centro_custo_id"): T[] => {
      if (tab === "tudo") return items;
      const nome = CENTRO_NOMES[tab];
      const centroId = centros.find((c) => c.nome === nome)?.id;
      if (!centroId) return [];
      return items.filter((i) => i[field] === centroId);
    },
    [centros],
  );

  const filtered = useMemo(() => {
    const tx = filterByCentro(transacoes, activeTab);
    const veiculo = filterByCentro(veiculos, activeTab);
    const fixas = filterByCentro(contasFixas, activeTab);

    const txMes = tx.filter(t => t.data_vencimento >= mesInicio && t.data_vencimento <= mesFim);
    const txPagoMes = tx.filter(t => t.status === "Pago" && t.data_pagamento && t.data_pagamento >= mesInicio && t.data_pagamento <= mesFim);

    const receitasMes = txPagoMes.filter(t => t.tipo === "Receita").reduce((s, t) => s + Number(t.valor), 0);
    const despesasMes = txPagoMes.filter(t => t.tipo === "Despesa").reduce((s, t) => s + Number(t.valor), 0);
    const lucroMes = receitasMes - despesasMes;

    const pendentesReceber = tx.filter(t => t.tipo === "Receita" && t.status === "Pendente").reduce((s, t) => s + Number(t.valor), 0);
    const pendentesPagar = tx.filter(t => t.tipo === "Despesa" && t.status === "Pendente").reduce((s, t) => s + Number(t.valor), 0);

    const saldoTotal = saldosBancarios.reduce((s, b) => s + b.saldo, 0);
    const saldoProjetado = saldoTotal + pendentesReceber - pendentesPagar;

    const valorEstoque = veiculo.reduce((s, v) => s + Number(v.valor_aquisicao), 0);
    const custoFixoMes = fixas.reduce((s, f) => s + Number(f.valor), 0);

    // Weekly chart data (last 4 weeks)
    const weeks: { name: string; entradas: number; saidas: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { locale: ptBR });
      const weekEnd = endOfWeek(subWeeks(now, i), { locale: ptBR });
      const ws = format(weekStart, "dd/MM");
      const we = format(weekEnd, "dd/MM");

      const weekTx = tx.filter(t => {
        const d = t.data_pagamento || t.data_vencimento;
        return d >= format(weekStart, "yyyy-MM-dd") && d <= format(weekEnd, "yyyy-MM-dd");
      });

      weeks.push({
        name: `${ws}–${we}`,
        entradas: weekTx.filter(t => t.tipo === "Receita").reduce((s, t) => s + Number(t.valor), 0),
        saidas: weekTx.filter(t => t.tipo === "Despesa").reduce((s, t) => s + Number(t.valor), 0),
      });
    }

    // Pie chart: Expenses by Category
    const activeTx = tx.filter(t => t.status === "Pago" && t.data_pagamento && t.data_pagamento >= mesInicio && t.data_pagamento <= mesFim && t.tipo === "Despesa");
    const catMap = activeTx.reduce((acc: Record<string, number>, t) => {
      const cat = t.categoria || "Outros";
      acc[cat] = (acc[cat] || 0) + Number(t.valor);
      return acc;
    }, {});
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value: Number(value) }));

    // Bar chart: Realized vs Expenses
    const realizedData = [
      { name: format(now, "MMMM", { locale: ptBR }), receitas: receitasMes, despesas: despesasMes }
    ];

    // Upcoming & overdue
    const today = format(now, "yyyy-MM-dd");
    const pendentes = tx.filter(t => t.status === "Pendente");
    const atrasados = pendentes.filter(t => t.data_vencimento < today);
    const proximos = pendentes.filter(t => t.data_vencimento >= today).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).slice(0, 10);

    return {
      receitasMes, despesasMes, lucroMes, saldoProjetado, saldoTotal,
      pendentesReceber, pendentesPagar, valorEstoque, custoFixoMes,
      qtdEstoque: veiculo.length, weeks, atrasados, proximos,
      isCasa: activeTab === "casa", pieData, realizedData
    };
  }, [transacoes, veiculos, contasFixas, saldosBancarios, activeTab, filterByCentro, mesInicio, mesFim, now]);

  const isCasa = activeTab === "casa";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {role === "admin" && <ExportBackup />}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tudo">Tudo</TabsTrigger>
          <TabsTrigger value="escritorio">Escritório</TabsTrigger>
          <TabsTrigger value="trato">Trato Feito</TabsTrigger>
          <TabsTrigger value="casa">Casa</TabsTrigger>
        </TabsList>

        {/* All tabs share the same content structure, driven by filtered data */}
        <div className="mt-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {!isCasa && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Veículos em Estoque</CardTitle>
                  <Car className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filtered.qtdEstoque}</div>
                  <p className="text-xs text-muted-foreground">{formatBRL(filtered.valorEstoque)} investido</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receitas (Mês)</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">{formatBRL(filtered.receitasMes)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{isCasa ? "Gastos (Mês)" : "Despesas (Mês)"}</CardTitle>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatBRL(filtered.despesasMes)}</div>
                {filtered.custoFixoMes > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> {formatBRL(filtered.custoFixoMes)} fixos
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {activeTab === "tudo" ? "Saldo Projetado" : "Lucro do Mês"}
                </CardTitle>
                <DollarSign className={`h-5 w-5 ${filtered.lucroMes >= 0 ? "text-emerald-500" : "text-destructive"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${filtered.lucroMes >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {formatBRL(activeTab === "tudo" ? filtered.saldoProjetado : filtered.lucroMes)}
                </div>
                {activeTab === "tudo" && (
                  <p className="text-xs text-muted-foreground">Saldo atual: {formatBRL(filtered.saldoTotal)}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Saldos bancários (only on "Tudo") */}
          {activeTab === "tudo" && saldosBancarios.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {saldosBancarios.map(b => (
                <Card key={b.nome} className="p-3">
                  <p className="text-xs text-muted-foreground truncate">{b.nome}</p>
                  <p className={`text-sm font-bold ${b.saldo >= 0 ? "text-emerald-500" : "text-destructive"}`}>{formatBRL(b.saldo)}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Comparison and Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Realizado: Receitas vs Despesas</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filtered.realizedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas Realizadas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas Realizadas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Distribuição de Despesas por Categoria</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filtered.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {filtered.pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${(index * 45) % 360}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Entradas vs Saídas — Últimas 4 Semanas</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filtered.weeks}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Overdue + Upcoming */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Overdue */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-lg">Contas Atrasadas ({filtered.atrasados.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.atrasados.slice(0, 10).map(tx => (
                      <TableRow key={tx.id} className="text-destructive">
                        <TableCell className="text-sm font-medium">{tx.descricao}</TableCell>
                        <TableCell className="text-sm">{format(parseISO(tx.data_vencimento), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-sm font-bold">{formatBRL(Number(tx.valor))}</TableCell>
                      </TableRow>
                    ))}
                    {filtered.atrasados.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Nenhuma conta atrasada 🎉</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Upcoming */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Próximos Vencimentos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.proximos.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm font-medium">{tx.descricao}</TableCell>
                        <TableCell className="text-sm">{format(parseISO(tx.data_vencimento), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-sm font-bold">{formatBRL(Number(tx.valor))}</TableCell>
                        <TableCell>
                          <Badge variant={tx.tipo === "Receita" ? "default" : "destructive"} className="text-xs">{tx.tipo}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.proximos.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Nenhum vencimento próximo.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
