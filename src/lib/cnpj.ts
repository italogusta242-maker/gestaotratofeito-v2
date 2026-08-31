// Integração com BrasilAPI para consulta de CNPJ (pública, sem chave).
// Retorna null se CNPJ inválido / não achou / rede falhou.

export interface EmpresaBrasilApi {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
}

export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "").slice(0, 14);
}

export async function buscarCnpj(cnpj: string): Promise<EmpresaBrasilApi | null> {
  const clean = normalizeCnpj(cnpj);
  if (clean.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.cnpj) return null;
    return {
      cnpj: d.cnpj,
      razaoSocial: d.razao_social ?? "",
      nomeFantasia: d.nome_fantasia ?? "",
      cep: d.cep ?? "",
      logradouro: d.logradouro ?? "",
      numero: d.numero ?? "",
      complemento: d.complemento ?? "",
      bairro: d.bairro ?? "",
      cidade: d.municipio ?? "",
      uf: d.uf ?? "",
      telefone: d.ddd_telefone_1 ?? "",
      email: d.email ?? "",
    };
  } catch {
    return null;
  }
}
