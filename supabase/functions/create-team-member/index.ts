import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = new Set(["admin", "auxiliar_operacional", "auxiliar_emissao"]);

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

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();
    if (roleData?.role !== "admin") return json({ error: "Forbidden" }, 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const role = typeof body.role === "string" ? body.role : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email inválido" }, 400);
    if (!password || password.length < 6) return json({ error: "Senha deve ter no mínimo 6 caracteres" }, 400);
    if (!VALID_ROLES.has(role)) return json({ error: "Role inválida" }, 400);

    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome || email },
    });

    if (createErr) {
      console.error("createUser failed:", createErr.message);
      return json({ error: "Não foi possível criar o usuário" }, 400);
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role });

    if (roleErr) {
      console.error("insert role failed:", roleErr.message);
      // rollback: remove created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: "Não foi possível atribuir a role" }, 500);
    }

    return json({ success: true, user_id: newUser.user.id });
  } catch (err) {
    console.error("create-team-member fatal:", err instanceof Error ? err.message : String(err));
    return json({ error: "Erro interno" }, 500);
  }
});
