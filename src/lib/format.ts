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

export const upperCase = (v: string): string => v.toUpperCase();
