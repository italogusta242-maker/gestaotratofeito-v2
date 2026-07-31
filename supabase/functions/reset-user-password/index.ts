import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const user_id = typeof body.user_id === "string" ? body.user_id : "";
    if (!UUID_RE.test(user_id)) return json({ error: "user_id inválido" }, 400);

    const password = typeof body.password === "string" ? body.password : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";

    const authUpdate: Record<string, string> = {};
    if (password) {
      if (password.length < 6) return json({ error: "Senha deve ter no mínimo 6 caracteres" }, 400);
      authUpdate.password = password;
    }
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email inválido" }, 400);
      authUpdate.email = email;
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate);
      if (updateErr) {
        console.error("updateUserById failed:", updateErr.message);
        return json({ error: "Não foi possível atualizar o usuário" }, 400);
      }
    }

    const profileUpdate: Record<string, string> = {};
    if (nome) profileUpdate.nome = nome;
    if (email) profileUpdate.email = email;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", user_id);
      if (profileErr) {
        console.error("profile update failed:", profileErr.message);
        return json({ error: "Usuário atualizado, mas houve erro ao gravar o perfil" }, 500);
      }
    }

    return json({ success: true });
  } catch (err) {
    console.error("reset-user-password fatal:", err instanceof Error ? err.message : String(err));
    return json({ error: "Erro interno" }, 500);
  }
});
