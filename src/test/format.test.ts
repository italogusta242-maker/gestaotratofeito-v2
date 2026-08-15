import { describe, it, expect } from "vitest";
import { formatBRL, formatDateBR, parseDateLocal, upperCase } from "@/lib/format";
import { formatPlaca, cleanPlaca } from "@/lib/format-placa";

describe("formatBRL", () => {
  it("formata número inteiro como moeda BRL", () => {
    expect(formatBRL(1500)).toMatch(/R\$\s*1\.500,00/);
  });

  it("formata decimal", () => {
    expect(formatBRL(1234.56)).toMatch(/R\$\s*1\.234,56/);
  });

  it("aceita string", () => {
    expect(formatBRL("2000")).toMatch(/R\$\s*2\.000,00/);
  });

  it("trata null/undefined como zero", () => {
    expect(formatBRL(null)).toMatch(/R\$\s*0,00/);
    expect(formatBRL(undefined)).toMatch(/R\$\s*0,00/);
  });

  it("trata valor não numérico como zero", () => {
    expect(formatBRL("abc")).toMatch(/R\$\s*0,00/);
  });
});

describe("formatDateBR", () => {
  it("converte ISO para dd/mm/yyyy", () => {
    expect(formatDateBR("2026-07-30")).toBe("30/07/2026");
  });

  it("suporta timestamp ISO", () => {
    expect(formatDateBR("2026-07-30T12:00:00Z")).toBe("30/07/2026");
  });

  it("retorna vazio para null/undefined", () => {
    expect(formatDateBR(null)).toBe("");
    expect(formatDateBR(undefined)).toBe("");
  });

  it("retorna original se não for formato esperado", () => {
    expect(formatDateBR("2026-07")).toBe("2026-07");
  });
});

describe("parseDateLocal", () => {
  it("retorna Date local sem off-by-one em fuso UTC-negativo", () => {
    const d = parseDateLocal("2000-01-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2000);
    expect(d!.getMonth()).toBe(0); // janeiro = 0
    expect(d!.getDate()).toBe(15);
  });

  it("aceita timestamp ISO (ignora hora)", () => {
    const d = parseDateLocal("2026-07-30T12:00:00Z");
    expect(d!.getDate()).toBe(30);
    expect(d!.getMonth()).toBe(6);
  });

  it("retorna null para vazio", () => {
    expect(parseDateLocal(null)).toBeNull();
    expect(parseDateLocal(undefined)).toBeNull();
    expect(parseDateLocal("")).toBeNull();
  });

  it("retorna null para formato inválido", () => {
    expect(parseDateLocal("2026-07")).toBeNull();
    expect(parseDateLocal("qualquer coisa")).toBeNull();
  });
});

describe("upperCase", () => {
  it("converte para maiúsculo", () => {
    expect(upperCase("teste")).toBe("TESTE");
  });
});

describe("formatPlaca", () => {
  it("formata placa Mercosul com hífen", () => {
    expect(formatPlaca("ABC1D23")).toBe("ABC-1D23");
  });

  it("formata placa antiga com hífen", () => {
    expect(formatPlaca("ABC1234")).toBe("ABC-1234");
  });

  it("aceita minúsculas e converte", () => {
    expect(formatPlaca("abc1d23")).toBe("ABC-1D23");
  });

  it("remove caracteres inválidos", () => {
    expect(formatPlaca("AB C-1D23!")).toBe("ABC-1D23");
  });

  it("não adiciona hífen se menos de 4 caracteres", () => {
    expect(formatPlaca("ABC")).toBe("ABC");
  });
});

describe("cleanPlaca", () => {
  it("remove hífen e espaços", () => {
    expect(cleanPlaca("ABC-1D23")).toBe("ABC1D23");
  });

  it("uppercase", () => {
    expect(cleanPlaca("abc1d23")).toBe("ABC1D23");
  });
});
