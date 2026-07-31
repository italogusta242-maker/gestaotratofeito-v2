export interface DespesaInput {
  descricao: string;
  valor: string;
  data_ocorrencia: string;
}

export interface DespesaValidationResult {
  ok: boolean;
  error?: string;
  valorNum?: number;
}

export function validateDespesa(input: DespesaInput): DespesaValidationResult {
  const descricao = input.descricao.trim();
  if (!descricao) return { ok: false, error: "Informe o fornecedor/local." };

  const valorNum = parseFloat(input.valor);
  if (!Number.isFinite(valorNum) || valorNum <= 0) {
    return { ok: false, error: "Informe um valor maior que zero." };
  }

  if (!input.data_ocorrencia) {
    return { ok: false, error: "Informe a data." };
  }

  // Data no formato ISO YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data_ocorrencia)) {
    return { ok: false, error: "Data inválida." };
  }

  return { ok: true, valorNum };
}
