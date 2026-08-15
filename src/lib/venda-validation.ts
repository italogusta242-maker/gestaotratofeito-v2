export interface PagamentoLinha {
  valor: string;
  forma: string;
  contaId: string;
}

export interface VendaValidationResult {
  ok: boolean;
  error?: string;
  totalPagamentos?: number;
  restante?: number;
}

export function validateVenda(valorVenda: string, pagamentos: PagamentoLinha[]): VendaValidationResult {
  const vendaNum = parseFloat(valorVenda) || 0;

  if (vendaNum <= 0) {
    return { ok: false, error: "Informe o valor da venda." };
  }

  if (pagamentos.length === 0) {
    return { ok: false, error: "Adicione ao menos uma forma de pagamento." };
  }

  const totalPagamentos = pagamentos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
  const restante = vendaNum - totalPagamentos;

  if (restante < -0.01) {
    return {
      ok: false,
      error: `A soma dos pagamentos (${totalPagamentos.toFixed(2)}) é maior que o valor de venda (${vendaNum.toFixed(2)}).`,
      totalPagamentos,
      restante,
    };
  }

  for (const p of pagamentos) {
    const valorLinha = parseFloat(p.valor);
    if (!(valorLinha > 0)) {
      return { ok: false, error: "Toda linha de pagamento precisa ter um valor maior que zero." };
    }
    if (p.forma !== "Veículo na Troca" && !p.contaId) {
      return { ok: false, error: `Selecione a conta de destino para o pagamento em ${p.forma}. Se não houver contas cadastradas, cadastre uma em "Contas Bancárias".` };
    }
  }

  return { ok: true, totalPagamentos, restante };
}
