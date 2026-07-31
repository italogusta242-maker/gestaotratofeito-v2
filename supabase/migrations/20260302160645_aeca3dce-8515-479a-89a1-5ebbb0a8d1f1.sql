
-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'auxiliar_operacional', 'auxiliar_emissao');

-- 2. User roles table (RBAC)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Centros de Custo
CREATE TABLE public.centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

-- 5. Contas Bancárias
CREATE TABLE public.contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Corrente', 'Cartão', 'Espécie')),
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;

-- 6. Veículos
CREATE TABLE public.veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa TEXT NOT NULL UNIQUE,
  marca_modelo TEXT NOT NULL,
  ano TEXT NOT NULL,
  cor TEXT,
  renavam TEXT,
  valor_aquisicao NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Em Estoque' CHECK (status IN ('Em Estoque', 'Vendido', 'Preparação')),
  centro_custo_id UUID REFERENCES public.centros_custo(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

-- 7. Transações
CREATE TABLE public.transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_vencimento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento DATE,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Receita', 'Despesa', 'Transferência')),
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pago', 'Pendente')),
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  centro_custo_id UUID REFERENCES public.centros_custo(id),
  veiculo_id UUID REFERENCES public.veiculos(id),
  categoria TEXT,
  parcela_atual INT,
  total_parcelas INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- 8. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 9. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_veiculos_updated_at
  BEFORE UPDATE ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Helper: get user's centro_custo_id for Casa/Sócios
CREATE OR REPLACE FUNCTION public.get_casa_socios_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.centros_custo WHERE nome = 'Casa/Sócios' LIMIT 1
$$;

-- =====================
-- RLS POLICIES
-- =====================

-- user_roles: admin can manage, users can read their own
CREATE POLICY "Admin full access user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- profiles: users read own, admin reads all
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- centros_custo: all authenticated can read
CREATE POLICY "Authenticated read centros_custo" ON public.centros_custo
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manage centros_custo" ON public.centros_custo
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- contas_bancarias: admin only
CREATE POLICY "Admin full access contas_bancarias" ON public.contas_bancarias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- veiculos: all authenticated can read, admin+aux_op can write
CREATE POLICY "Authenticated read veiculos" ON public.veiculos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin and aux_op manage veiculos" ON public.veiculos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'auxiliar_operacional')
  );

-- transacoes: role-based access
CREATE POLICY "Admin full access transacoes" ON public.transacoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Aux_op access transacoes excluding Casa" ON public.transacoes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'auxiliar_operacional') AND
    (centro_custo_id IS NULL OR centro_custo_id != public.get_casa_socios_id())
  );

CREATE POLICY "Aux_op insert transacoes excluding Casa" ON public.transacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'auxiliar_operacional') AND
    (centro_custo_id IS NULL OR centro_custo_id != public.get_casa_socios_id())
  );

CREATE POLICY "Aux_op update transacoes excluding Casa" ON public.transacoes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'auxiliar_operacional') AND
    (centro_custo_id IS NULL OR centro_custo_id != public.get_casa_socios_id())
  );
