import { describe, it, expect } from "vitest";
import { translateError } from "@/lib/supabase-errors";

describe("translateError", () => {
  it("traduz mensagens conhecidas de auth", () => {
    expect(translateError({ message: "Invalid login credentials" })).toBe("Email ou senha incorretos");
    expect(translateError({ message: "Email not confirmed" })).toBe("Email ainda não confirmado");
    expect(translateError({ message: "User already registered" })).toBe("Este email já está cadastrado");
  });

  it("traduz códigos Postgres", () => {
    expect(translateError({ code: "23505", message: "duplicate key" })).toBe(
      "Este registro já existe (valor duplicado)",
    );
    expect(translateError({ code: "23503", message: "..." })).toBe(
      "Não é possível remover: existe(m) registro(s) vinculado(s)",
    );
    expect(translateError({ code: "42501", message: "..." })).toMatch(/permissão/);
  });

  it("traduz mensagem com contexto extra por prefixo", () => {
    expect(translateError({ message: "For security purposes, you can only request this after 60 seconds ..." }))
      .toMatch(/60 segundos/);
  });

  it("devolve original se desconhecido", () => {
    expect(translateError({ message: "Some unknown weird error" })).toBe("Some unknown weird error");
  });

  it("lida com Error object, string, null", () => {
    expect(translateError(new Error("Invalid credentials"))).toBe("Email ou senha incorretos");
    expect(translateError("texto direto")).toBe("texto direto");
    expect(translateError(null)).toBe("Erro desconhecido");
    expect(translateError(undefined)).toBe("Erro desconhecido");
  });

  it("prioriza código PG sobre mensagem", () => {
    expect(translateError({ code: "23505", message: "Invalid credentials" })).toMatch(/duplicado/);
  });
});
