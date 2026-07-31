import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const callerUserId = userData.user.id;

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .single();
    if (roleData?.role !== "admin") return json({ error: "Forbidden" }, 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const user_id = typeof body.user_id === "string" ? body.user_id : "";
    if (!UUID_RE.test(user_id)) return json({ error: "user_id inválido" }, 400);
    if (user_id === callerUserId) return json({ error: "Você não pode excluir a si mesmo" }, 400);

    // Deleta auth primeiro; FK ON DELETE CASCADE em user_roles/profiles cuida do resto.
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteErr) {
      console.error("deleteUser failed:", deleteErr.message);
      return json({ error: "Não foi possível excluir o usuário" }, 400);
    }

    // Garantia extra caso alguma FK não seja CASCADE
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", user_id);

    return json({ success: true });
  } catch (err) {
    console.error("delete-team-member fatal:", err instanceof Error ? err.message : String(err));
    return json({ error: "Erro interno" }, 500);
  }
});
