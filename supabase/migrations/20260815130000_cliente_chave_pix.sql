-- Cada cliente tem sua própria chave PIX (é como a empresa paga o cliente
-- quando compra veículo dele). Sempre PIX.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS chave_pix_tipo text CHECK (chave_pix_tipo IS NULL OR chave_pix_tipo IN ('CPF', 'CNPJ', 'Email', 'Telefone', 'Aleatória'));
