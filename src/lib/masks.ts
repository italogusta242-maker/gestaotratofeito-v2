// Utilitários de máscara — recebem string livre e retornam formatada.
// Nenhum estado: puros e testáveis.

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

// Máscara CEP: 00000-000
export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// Máscara CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) adaptativa
export function maskCpfCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    // CPF
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  // CNPJ
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Máscara Telefone: (00) 0000-0000 (fixo) ou (00) 00000-0000 (celular)
export function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Máscara moeda BRL: estilo calculadora. Digita dígitos, formata como R$ X,XX.
// Value é sempre string de dígitos representando centavos.
export function maskCurrency(v: string): string {
  const d = onlyDigits(v);
  if (!d) return "";
  const cents = parseInt(d, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Converte string de dígitos (cents) em valor decimal (R$)
export function digitsToDecimal(digits: string): number {
  const d = onlyDigits(digits);
  if (!d) return 0;
  return parseInt(d, 10) / 100;
}

// Converte número decimal em string de dígitos (cents) — para inicializar CurrencyInput
export function decimalToDigits(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || n === 0) return "";
  return Math.round(n * 100).toString();
}
