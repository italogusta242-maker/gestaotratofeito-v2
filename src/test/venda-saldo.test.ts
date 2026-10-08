import { describe, it, expect } from "vitest";
import { gerarParcelasSaldo, resumoPagamentos, rotuloPagamento } from "@/lib/venda-saldo";

describe("gerarParcelasSaldo", () => {
  it("parcela única no vencimento informado", () => {
    expect(gerarParcelasSaldo(2000, 1, "2026-11-10")).toEqual([
      { numero: 1, total: 1, valor: 2000, data_vencimento: "2026-11-10" },
    ]);
  });

  it("divide em parcelas mensais e joga os centavos na última", () => {
    const p = gerarParcelasSaldo(1000, 3, "2026-11-10");
    expect(p.map((x) => x.valor)).toEqual([333.33, 333.33, 333.34]);
    expect(p.map((x) => x.data_vencimento)).toEqual(["2026-11-10", "2026-12-10", "2027-01-10"]);
    expect(p.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(1000);
  });

  it("sem saldo não gera parcela", () => {
    expect(gerarParcelasSaldo(0, 2, "2026-11-10")).toEqual([]);
  });

  it("número de parcelas inválido vira 1", () => {
    expect(gerarParcelasSaldo(500, 0, "2026-11-10")).toHaveLength(1);
  });
});

describe("resumoPagamentos", () => {
  it("caso do cliente: 17 mil = 5 mil PIX + moto 10 mil + 2 mil devendo", () => {
    const r = resumoPagamentos([
      { valor: 5000, status: "Pago" },
      { valor: 10000, status: "Pago" },
      { valor: 2000, status: "Pendente" },
    ]);
    expect(r).toEqual({ total: 17000, pago: 15000, devedor: 2000 });
  });

  it("sem status conta como pago (linha sintética do cadastro)", () => {
    expect(resumoPagamentos([{ valor: "17000" }])).toEqual({ total: 17000, pago: 17000, devedor: 0 });
  });
});

describe("rotuloPagamento", () => {
  it.each([
    ["Venda ABC1D23 — PIX (1/3)", "PIX"],
    ["Venda ABC1D23 — Veículo na Troca (2/3)", "Veículo na Troca"],
    ["Venda ABC1D23 — Veículo na Troca: HONDA CG 160 (QWE1A23)", "Veículo na Troca: HONDA CG 160 (QWE1A23)"],
    ["Venda ABC1D23 — Saldo devedor (parcela 1/2)", "Saldo devedor (parcela 1/2)"],
    ["Saldo Restante Venda - ABC1D23", "Saldo devedor"],
    ["Venda ABC1D23 (troca)", "Veículo na Troca"],
    ["Venda ABC1D23", "À vista"],
    ["Financiamento", "Financiamento"],
  ])("%s → %s", (entrada, esperado) => {
    expect(rotuloPagamento(entrada)).toBe(esperado);
  });
});
