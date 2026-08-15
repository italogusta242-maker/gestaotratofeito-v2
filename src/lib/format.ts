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
