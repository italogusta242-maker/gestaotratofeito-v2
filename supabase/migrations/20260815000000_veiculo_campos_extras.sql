-- Campos extras no cadastro de veículo:
-- ipva, multas, licenciamento (débitos categorizados que geram transação)
-- desconto, forma_pagamento (metadados da compra)

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS ipva numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS licenciamento numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

ALTER TABLE public.veiculos
  ADD CONSTRAINT veiculos_ipva_nonneg CHECK (ipva >= 0),
  ADD CONSTRAINT veiculos_multas_nonneg CHECK (multas >= 0),
  ADD CONSTRAINT veiculos_licenciamento_nonneg CHECK (licenciamento >= 0),
  ADD CONSTRAINT veiculos_desconto_nonneg CHECK (desconto >= 0);
