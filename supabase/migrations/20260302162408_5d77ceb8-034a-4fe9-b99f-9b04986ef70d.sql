
-- Create clientes table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT UNIQUE NOT NULL,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Admin and aux_op: full CRUD
CREATE POLICY "Admin and aux_op manage clientes"
ON public.clientes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'auxiliar_operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'auxiliar_operacional'::app_role));

-- Aux emissão: read only
CREATE POLICY "Aux emissao read clientes"
ON public.clientes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auxiliar_emissao'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add FK columns to veiculos
ALTER TABLE public.veiculos
  ADD COLUMN cliente_compra_id UUID REFERENCES public.clientes(id),
  ADD COLUMN cliente_venda_id UUID REFERENCES public.clientes(id);
