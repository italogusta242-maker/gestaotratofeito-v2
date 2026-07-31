import { describe, it, expect } from "vitest";
import { validateVenda, type PagamentoLinha } from "@/lib/venda-validation";

const linha = (over: Partial<PagamentoLinha> = {}): PagamentoLinha => ({
  valor: "1000",
  forma: "PIX",
  contaId: "conta-1",
  ...over,
});

describe("validateVenda", () => {
  it("rejeita venda sem valor", () => {
    const r = validateVenda("", [linha()]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/valor da venda/i);
  });

  it("rejeita venda com valor zero", () => {
    const r = validateVenda("0", [linha()]);
    expect(r.ok).toBe(false);
  });

  it("rejeita quando não há pagamentos", () => {
    const r = validateVenda("1000", []);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/forma de pagamento/i);
  });

  it("rejeita soma de pagamentos maior que valor total", () => {
    const r = validateVenda("1000", [linha({ valor: "600" }), linha({ valor: "500" })]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/maior que o valor/i);
    expect(r.totalPagamentos).toBe(1100);
    expect(r.restante).toBeCloseTo(-100);
  });

  it("rejeita quando alguma linha tem valor zero", () => {
    const r = validateVenda("1000", [linha({ valor: "1000" }), linha({ valor: "0" })]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/maior que zero/i);
  });

  it("rejeita quando forma diferente de 'Veículo na Troca' não tem conta", () => {
    const r = validateVenda("1000", [linha({ contaId: "" })]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/conta de destino/i);
  });

  it("permite 'Veículo na Troca' sem conta", () => {
    const r = validateVenda("1000", [linha({ forma: "Veículo na Troca", contaId: "" })]);
    expect(r.ok).toBe(true);
  });

  it("aceita venda fechada (soma == valor)", () => {
    const r = validateVenda("1000", [linha({ valor: "500" }), linha({ valor: "500" })]);
    expect(r.ok).toBe(true);
    expect(r.totalPagamentos).toBe(1000);
    expect(r.restante).toBeCloseTo(0);
  });

  it("aceita venda parcial (soma < valor) — permite saldo restante", () => {
    const r = validateVenda("1000", [linha({ valor: "600" })]);
    expect(r.ok).toBe(true);
    expect(r.restante).toBeCloseTo(400);
  });

  it("tolera diferenças por arredondamento (<0.01)", () => {
    // 50.003 + 50.003 = 100.006 (excesso de 0.006, dentro da tolerância)
    const r = validateVenda("100.00", [linha({ valor: "50.003" }), linha({ valor: "50.003" })]);
    expect(r.ok).toBe(true);
  });

  it("aceita mix de formas incluindo troca", () => {
    const r = validateVenda("50000", [
      linha({ valor: "20000", forma: "PIX", contaId: "c1" }),
      linha({ valor: "30000", forma: "Veículo na Troca", contaId: "" }),
    ]);
    expect(r.ok).toBe(true);
  });
});
