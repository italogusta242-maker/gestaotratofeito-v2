-- Campos de classificação do veículo usados em ContratoIntermediação.
-- Todos opcionais.

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS especie text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS alienacao_fiduciaria text;
