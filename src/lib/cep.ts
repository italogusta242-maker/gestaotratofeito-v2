// Integração com ViaCEP (API pública gratuita, sem chave).
// Retorna null se não achou / CEP inválido / rede falhou.

export interface EnderecoViaCep {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(cep: string): string {
  const n = normalizeCep(cep);
  if (n.length !== 8) return n;
  return `${n.slice(0, 5)}-${n.slice(5)}`;
}

export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const clean = normalizeCep(cep);
  if (clean.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!r.ok) return null;
    const data = await r.json();
    if (data?.erro) return null;
    return {
      cep: data.cep ?? formatCep(clean),
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
