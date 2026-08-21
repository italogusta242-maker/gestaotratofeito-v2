-- Adiciona coluna data_venda em veiculos.
-- Motivação: Recibo e ContratoVenda/Repasse hoje só conseguem exibir a data
-- da venda se existir uma transação de Receita lançada. Quando o usuário
-- preenche valor_venda + forma_pagamento no cadastro do veículo sem passar
-- pelo financeiro, não há data disponível. Este campo dá um lugar único
-- pra informar a data da venda direto no cadastro do veículo.
alter table public.veiculos
  add column if not exists data_venda date;

comment on column public.veiculos.data_venda is
  'Data em que a venda foi realizada (usada em Recibo e Contratos quando não há transação de Receita lançada).';
