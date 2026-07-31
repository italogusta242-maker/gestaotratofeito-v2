CREATE OR REPLACE FUNCTION public.get_casa_socios_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT id FROM public.centros_custo WHERE nome = 'Casa' LIMIT 1
$$;