import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { Profile } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

type AppRole = Database["public"]["Enums"]["app_role"];
type UsuarioComRole = Profile & { role: AppRole | null; role_id: string | null };

const roleLabels: Record<string, string> = {
  admin: "Admin",
  auxiliar_operacional: "Aux. Operacional",
  auxiliar_emissao: "Aux. Emissão",
};

export default function Usuarios() {
  const [users, setUsers] = useState<UsuarioComRole[]>([]);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
    ]);
    if (profilesRes.error) { console.error("profiles:", profilesRes.error); toast.error("Falha ao carregar usuários"); }
    if (rolesRes.error) console.error("user_roles:", rolesRes.error);
    const profiles = profilesRes.data ?? [];
    const roles = rolesRes.data ?? [];
    const merged = profiles.map(p => ({
      ...p,
      role: roles.find(r => r.user_id === p.id)?.role ?? null,
      role_id: roles.find(r => r.user_id === p.id)?.id ?? null,
    }));
    setUsers(merged);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(userId: string, existingRoleId: string | null, newRole: AppRole) {
    if (updating) return;
    if (!userId || !newRole) { toast.error("Dados inválidos para alteração de perfil."); return; }
    if (!window.confirm(`Confirmar alteração do perfil para "${roleLabels[newRole] ?? newRole}"?`)) return;
    setUpdating(true);
    if (existingRoleId) {
      const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("id", existingRoleId);
      if (error) { setUpdating(false); toast.error(translateError(error)); return; }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) { setUpdating(false); toast.error(translateError(error)); return; }
    }
    setUpdating(false);
    toast.success("Perfil atualizado!");
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Alterar Perfil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role ? <Badge variant="secondary">{roleLabels[u.role]}</Badge> : <Badge variant="outline">Sem perfil</Badge>}</TableCell>
                  <TableCell>
                    <Select value={u.role ?? ""} onValueChange={(v) => changeRole(u.id, u.role_id, v as AppRole)}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="auxiliar_operacional">Aux. Operacional</SelectItem>
                        <SelectItem value="auxiliar_emissao">Aux. Emissão</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum usuário.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
