
-- 1. Add localizacao column to veiculos
ALTER TABLE public.veiculos ADD COLUMN localizacao text NOT NULL DEFAULT 'Pátio';

-- 2. Create storage bucket for vehicle documents
INSERT INTO storage.buckets (id, name, public) VALUES ('veiculos-docs', 'veiculos-docs', true);

-- 3. Storage policies - authenticated users can view
CREATE POLICY "Authenticated users can view vehicle docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'veiculos-docs');

-- 4. Admin and aux_op can upload
CREATE POLICY "Admin and aux_op can upload vehicle docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'veiculos-docs' 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'auxiliar_operacional'))
);

-- 5. Admin and aux_op can delete
CREATE POLICY "Admin and aux_op can delete vehicle docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'veiculos-docs' 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'auxiliar_operacional'))
);
