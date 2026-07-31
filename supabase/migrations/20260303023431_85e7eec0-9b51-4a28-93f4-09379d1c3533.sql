
-- Add ano_modelo column (separate from ano which becomes ano_fabricacao)
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS ano_modelo text;

-- Add data_entrada_patio for tracking days in yard
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS data_entrada_patio date DEFAULT CURRENT_DATE;

-- Update existing records: copy ano to ano_modelo where null
UPDATE public.veiculos SET ano_modelo = ano WHERE ano_modelo IS NULL;
