-- Permite que auxiliar_operacional e auxiliar_emissao LEIAM contas bancárias.
-- Necessário para poderem selecionar a "conta destino" ao registrar uma venda.
-- Não concede INSERT/UPDATE/DELETE — apenas leitura.

CREATE POLICY "Auxiliares podem ler contas_bancarias"
  ON public.contas_bancarias
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'auxiliar_operacional'::app_role)
    OR has_role(auth.uid(), 'auxiliar_emissao'::app_role)
  );
