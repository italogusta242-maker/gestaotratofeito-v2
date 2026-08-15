import { describe, it, expect } from "vitest";
import { maskCep, maskCpfCnpj, maskPhone, maskCurrency, digitsToDecimal, decimalToDigits, onlyDigits } from "@/lib/masks";

describe("onlyDigits", () => {
  it("remove tudo que não é dígito", () => {
    expect(onlyDigits("abc 123 xyz")).toBe("123");
    expect(onlyDigits("(61) 90000-0000")).toBe("61900000000");
    expect(onlyDigits("")).toBe("");
  });
});

describe("maskCep", () => {
  it("formata parcialmente enquanto digita", () => {
    expect(maskCep("")).toBe("");
    expect(maskCep("7")).toBe("7");
    expect(maskCep("71950")).toBe("71950");
    expect(maskCep("719507")).toBe("71950-7");
    expect(maskCep("71950770")).toBe("71950-770");
  });

  it("limita a 8 dígitos", () => {
    expect(maskCep("7195077099999")).toBe("71950-770");
  });

  it("aceita já formatado", () => {
    expect(maskCep("71950-770")).toBe("71950-770");
  });
});

describe("maskCpfCnpj", () => {
  it("formata como CPF até 11 dígitos", () => {
    expect(maskCpfCnpj("123")).toBe("123");
    expect(maskCpfCnpj("12345")).toBe("123.45");
    expect(maskCpfCnpj("12345678")).toBe("123.456.78");
    expect(maskCpfCnpj("12345678901")).toBe("123.456.789-01");
  });

  it("formata como CNPJ a partir de 12 dígitos", () => {
    expect(maskCpfCnpj("123456780001")).toBe("12.345.678/0001");
    expect(maskCpfCnpj("58728871000106")).toBe("58.728.871/0001-06");
  });

  it("limita a 14 dígitos", () => {
    expect(maskCpfCnpj("587288710001069999")).toBe("58.728.871/0001-06");
  });
});

describe("maskPhone", () => {
  it("formata celular (11 dígitos)", () => {
    expect(maskPhone("61900000000")).toBe("(61) 90000-0000");
  });

  it("formata fixo (10 dígitos)", () => {
    expect(maskPhone("6133330000")).toBe("(61) 3333-0000");
  });

  it("progressivo", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("6")).toBe("(6");
    expect(maskPhone("61")).toBe("(61");
    expect(maskPhone("6190")).toBe("(61) 90");
    expect(maskPhone("619000")).toBe("(61) 9000");
    expect(maskPhone("6190000")).toBe("(61) 9000-0");
  });
});

describe("maskCurrency", () => {
  it("estilo calculadora", () => {
    expect(maskCurrency("")).toBe("");
    expect(maskCurrency("1")).toMatch(/R\$\s*0,01/);
    expect(maskCurrency("15")).toMatch(/R\$\s*0,15/);
    expect(maskCurrency("150")).toMatch(/R\$\s*1,50/);
    expect(maskCurrency("15000")).toMatch(/R\$\s*150,00/);
    expect(maskCurrency("123456")).toMatch(/R\$\s*1\.234,56/);
  });

  it("aceita mixed input (ignora tudo que não é dígito)", () => {
    expect(maskCurrency("R$ 1.234,56")).toMatch(/R\$\s*1\.234,56/);
  });
});

describe("digitsToDecimal / decimalToDigits", () => {
  it("digits -> decimal", () => {
    expect(digitsToDecimal("")).toBe(0);
    expect(digitsToDecimal("1")).toBe(0.01);
    expect(digitsToDecimal("123456")).toBe(1234.56);
  });

  it("decimal -> digits", () => {
    expect(decimalToDigits(0)).toBe("");
    expect(decimalToDigits(null)).toBe("");
    expect(decimalToDigits(1.5)).toBe("150");
    expect(decimalToDigits(1234.56)).toBe("123456");
    expect(decimalToDigits("999.99")).toBe("99999");
  });

  it("é ida e volta consistente", () => {
    expect(digitsToDecimal(decimalToDigits(1234.56))).toBe(1234.56);
    expect(digitsToDecimal(decimalToDigits(0.05))).toBe(0.05);
  });
});
