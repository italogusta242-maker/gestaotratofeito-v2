import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Trash2, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";
import type { Profile } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

type AppRole = Database["public"]["Enums"]["app_role"];

type EquipeUser = Profile & { role: AppRole | null; role_id: string | null };

const roleLabels: Record<string, string> = {
  admin: "Admin",
  auxiliar_operacional: "Aux. Operacional",
  auxiliar_emissao: "Aux. Emissão",
};

export default function Equipe() {
  const { session, user } = useAuth();
  const [users, setUsers] = useState<EquipeUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", password: "", role: "auxiliar_operacional" as AppRole });
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editUser, setEditUser] = useState<EquipeUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", password: "" });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    const merged = (profiles ?? []).map(p => ({
      ...p,
      role: (roles ?? []).find(r => r.user_id === p.id)?.role ?? null,
      role_id: (roles ?? []).find(r => r.user_id === p.id)?.id ?? null,
    }));
    setUsers(merged);
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("create-team-member", {
        body: { email: form.email, password: form.password, nome: form.nome, role: form.role },
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
      toast.success("Membro criado com sucesso!");
      setShowAdd(false);
      setForm({ nome: "", email: "", password: "", role: "auxiliar_operacional" });
      load();
    } catch (err) {
      toast.error(translateError(err as { message?: string }));
    } finally {
      setLoading(false);
    }
  }

  function openEdit(u: any) {
    setEditUser(u);
    setEditForm({ nome: u.nome ?? "", email: u.email ?? "", password: "" });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true);
    try {
      const body: Record<string, string> = { user_id: editUser.id };
      if (editForm.nome && editForm.nome !== editUser.nome) body.nome = editForm.nome;
      if (editForm.email && editForm.email !== editUser.email) body.email = editForm.email;
      if (editForm.password) body.password = editForm.password;

      if (Object.keys(body).length <= 1) {
        toast.info("Nenhuma alteração detectada.");
        setEditUser(null);
        return;
      }

      const res = await supabase.functions.invoke("reset-user-password", { body });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário atualizado com sucesso!");
      setEditUser(null);
      load();
    } catch (err) {
      toast.error(translateError(err as { message?: string }));
    } finally {
      setEditLoading(false);
    }
  }

  async function changeRole(userId: string, existingRoleId: string | null, newRole: AppRole) {
    if (existingRoleId) {
      const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("id", existingRoleId);
      if (error) { toast.error(translateError(error)); return; }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) { toast.error(translateError(error)); return; }
    }
    toast.success("Perfil atualizado!");
    load();
  }

  async function deleteMember(userId: string) {
    setDeleting(userId);
    try {
      const res = await supabase.functions.invoke("delete-team-member", {
        body: { user_id: userId },
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
      toast.success("Membro excluído com sucesso!");
      load();
    } catch (err) {
      toast.error(translateError(err as { message?: string }));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Equipe</h1>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-1" /> Novo Membro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Membro da Equipe</DialogTitle>
              <DialogDescription>Preencha os dados do novo membro.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createMember} className="space-y-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div><Label>Senha</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
              <div><Label>Perfil</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auxiliar_operacional">Aux. Operacional</SelectItem>
                    <SelectItem value="auxiliar_emissao">Aux. Emissão</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>Criar Membro</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere nome, e-mail ou senha. Deixe a senha em branco para manter a atual.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Nova Senha</Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Deixe em branco para manter" minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={editLoading}>
              {editLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Alterar Perfil</TableHead>
                <TableHead className="w-24"></TableHead>
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
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {u.id !== user?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir membro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir <strong>{u.nome ?? u.email}</strong>? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMember(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {deleting === u.id ? "Excluindo..." : "Excluir"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum membro.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
