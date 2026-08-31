-- ============================================================
-- Auditoria global — registra quem alterou o quê e quando
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  table_name   TEXT        NOT NULL,
  row_id       TEXT,
  action       TEXT        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  user_id      UUID,
  user_email   TEXT,
  user_name    TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_data     JSONB,
  new_data     JSONB,
  changes      JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_row ON public.audit_logs(table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS audit_logs_no_direct_write ON public.audit_logs;
CREATE POLICY audit_logs_no_direct_write ON public.audit_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_email     TEXT;
  v_name      TEXT;
  v_row_id    TEXT;
  v_old       JSONB;
  v_new       JSONB;
  v_changes   JSONB := '{}'::jsonb;
  v_key       TEXT;
  v_old_val   JSONB;
  v_new_val   JSONB;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT p.email, p.nome INTO v_email, v_name
      FROM public.profiles p
      WHERE p.id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_row_id := (v_old->>'id');
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_row_id := (v_new->>'id');
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_row_id := (v_new->>'id');

    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key IN ('updated_at','created_at') THEN
        CONTINUE;
      END IF;
      v_old_val := v_old->v_key;
      v_new_val := v_new->v_key;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old_val, 'new', v_new_val)
        );
      END IF;
    END LOOP;

    IF v_changes = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (table_name, row_id, action, user_id, user_email, user_name, old_data, new_data, changes)
  VALUES (TG_TABLE_NAME, v_row_id, TG_OP, v_user_id, v_email, v_name, v_old, v_new, NULLIF(v_changes, '{}'::jsonb));

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'veiculos','clientes','transacoes','contas_bancarias','chaves_pix',
    'centros_custo','cartoes','financiamentos','contas_fixas','user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();',
      t, t
    );
  END LOOP;
END $$;
