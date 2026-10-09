-- Edição de pagamentos da venda: o auxiliar_operacional precisa conseguir
-- remover uma linha de pagamento (ou parcela de saldo) que saiu da venda.
-- Sem esta política o DELETE não dá erro — só não apaga nada (RLS).
-- Escopo restrito às transações geradas pela venda de um veículo, fora de
-- Casa/Sócios. Demais exclusões continuam só para admin.
CREATE POLICY "Aux_op delete transacoes de venda" ON public.transacoes
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'auxiliar_operacional') AND
    (centro_custo_id IS NULL OR centro_custo_id != public.get_casa_socios_id()) AND
    veiculo_id IS NOT NULL AND
    tipo = 'Receita' AND
    categoria IN ('Venda de Veículo', 'Venda de Veículo (Saldo)', 'Troca de Veículo')
  );
