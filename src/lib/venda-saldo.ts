import { addMonths, format } from "date-fns";
import { parseDateLocal } from "@/lib/format";

/** Categorias das transações geradas por uma venda (pagamentos, saldo e troca). */
export const CATEGORIAS_VENDA = ["Venda de Veículo", "Venda de Veículo (Saldo)", "Troca de Veículo"];

export interface ParcelaSaldo {
  numero: number;
  total: number;
  valor: number;
  data_vencimento: string; // yyyy-MM-dd
}

/**
 * Divide o saldo devedor de uma venda em N parcelas mensais a partir do
 * primeiro vencimento. Centavos de arredondamento vão pra última parcela,
 * então a soma sempre bate exatamente com o saldo.
 */
export function gerarParcelasSaldo(saldo: number, numParcelas: number, primeiroVencimento: string): ParcelaSaldo[] {
  const n = Math.max(1, Math.floor(numParcelas) || 1);
  const totalCentavos = Math.round(saldo * 100);
  if (totalCentavos <= 0) return [];
  const base = Math.floor(totalCentavos / n);
  const inicio = parseDateLocal(primeiroVencimento) ?? new Date();
  return Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    total: n,
    valor: (i === n - 1 ? totalCentavos - base * (n - 1) : base) / 100,
    data_vencimento: format(addMonths(inicio, i), "yyyy-MM-dd"),
  }));
}

export interface ResumoPagamentos {
  total: number;
  pago: number;
  devedor: number;
}

/** Totais do quadro de pagamento do contrato: o que já foi pago e o que falta. */
export function resumoPagamentos(pagamentos: { valor: number | string; status?: string | null }[]): ResumoPagamentos {
  let pago = 0;
  let devedor = 0;
  for (const p of pagamentos) {
    const v = Number(p.valor) || 0;
    if (p.status && p.status !== "Pago") devedor += v;
    else pago += v;
  }
  return { total: pago + devedor, pago, devedor };
}

/**
 * Rótulo limpo pra coluna "Forma de Pagamento" do contrato. As descrições das
 * transações carregam a placa e a contagem ("Venda ABC1D23 — PIX (1/3)"), que
 * só poluem o documento.
 */
export function rotuloPagamento(descricao: string): string {
  const limpo = descricao
    .replace(/^Saldo Restante Venda\s*-\s*\S+/i, "Saldo devedor")
    .replace(/^Venda\s+\S+\s+—\s+/i, "")
    .replace(/^Venda\s+\S+\s+\(troca\)$/i, "Veículo na Troca")
    .replace(/\s+\(\d+\/\d+\)$/, "")
    .trim();
  return /^Venda\s+\S+$/i.test(limpo) ? "À vista" : limpo || descricao;
}
