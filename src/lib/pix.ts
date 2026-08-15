import { supabase } from "@/integrations/supabase/client";
import type { ChavePix } from "@/lib/db-types";

// Retorna a primeira chave PIX ativa da empresa, priorizando as vinculadas
// a uma conta bancária. Usada para preencher automaticamente contratos.
export async function fetchPixEmpresa(): Promise<ChavePix | null> {
  const { data } = await supabase
    .from("chaves_pix")
    .select("*")
    .eq("ativa", true)
    .order("conta_bancaria_id", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
}
