import { describe, it, expect } from "vitest";
import { validateDespesa } from "@/lib/despesa-validation";

const base = (over: Partial<Parameters<typeof validateDespesa>[0]> = {}) => ({
  descricao: "Oficina do João",
  valor: "150",
  data_ocorrencia: "2026-07-30",
  ...over,
});

describe("validateDespesa", () => {
  it("aceita despesa válida", () => {
    const r = validateDespesa(base());
    expect(r.ok).toBe(true);
    expect(r.valorNum).toBe(150);
  });

  it("rejeita descrição vazia", () => {
    const r = validateDespesa(base({ descricao: "" }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/fornecedor|local/i);
  });

  it("rejeita descrição só com espaços", () => {
    const r = validateDespesa(base({ descricao: "   " }));
    expect(r.ok).toBe(false);
  });

  it("rejeita valor zero", () => {
    const r = validateDespesa(base({ valor: "0" }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/maior que zero/i);
  });

  it("rejeita valor negativo", () => {
    const r = validateDespesa(base({ valor: "-10" }));
    expect(r.ok).toBe(false);
  });

  it("rejeita valor não numérico", () => {
    const r = validateDespesa(base({ valor: "abc" }));
    expect(r.ok).toBe(false);
  });

  it("rejeita valor vazio", () => {
    const r = validateDespesa(base({ valor: "" }));
    expect(r.ok).toBe(false);
  });

  it("rejeita data vazia", () => {
    const r = validateDespesa(base({ data_ocorrencia: "" }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/data/i);
  });

  it("rejeita data em formato inválido", () => {
    const r = validateDespesa(base({ data_ocorrencia: "30/07/2026" }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/data inválida/i);
  });

  it("aceita valor decimal", () => {
    const r = validateDespesa(base({ valor: "150.50" }));
    expect(r.ok).toBe(true);
    expect(r.valorNum).toBe(150.5);
  });
});
