-- Quilometragem no veículo (aparece em ContratoCompra e ContratoIntermediação).
-- Endereço detalhado no cliente (CEP + bairro + cidade + UF) para preencher
-- contratos e para integração com API ViaCEP.

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS quilometragem integer;

ALTER TABLE public.veiculos
  ADD CONSTRAINT veiculos_km_nonneg CHECK (quilometragem IS NULL OR quilometragem >= 0);

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text;
