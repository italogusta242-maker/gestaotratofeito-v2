export const formatBRL = (v: number | string | null | undefined): string => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const formatDateBR = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

// Parse ISO date-only (YYYY-MM-DD) como Date LOCAL, evitando off-by-one em fuso UTC-negativo.
// new Date("2000-01-15") é interpretado como UTC 00:00 e vira 14/01 no Brasil.
export const parseDateLocal = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const upperCase = (v: string): string => v.toUpperCase();

/**
 * Monta o endereço completo do cliente juntando as partes preenchidas no
 * cadastro. Contratos e procurações mostravam só `endereco`, deixando bairro
 * e CEP fora do documento mesmo quando estavam salvos.
 */
type EnderecoLike = {
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
};
export const enderecoCompleto = (c: EnderecoLike | null | undefined): string => {
  if (!c) return "";
  const partes: string[] = [];
  if (c.endereco?.trim()) partes.push(c.endereco.trim());
  if (c.bairro?.trim()) partes.push(c.bairro.trim());
  const local = [c.cidade?.trim(), c.uf?.trim()].filter(Boolean).join("/");
  if (local) partes.push(local);
  if (c.cep?.trim()) partes.push(`CEP ${c.cep.trim()}`);
  return partes.join(", ");
};
