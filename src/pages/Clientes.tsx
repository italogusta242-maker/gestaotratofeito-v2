import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Cliente } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";

export default function Clientes() {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "auxiliar_operacional";
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", rg: "", estado_civil: "", nacionalidade: "", data_nascimento: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("clientes").select("*").order("nome");
    setClientes(data ?? []);
  }

  function openEdit(c: any) {
    setForm({ nome: c.nome, cpf_cnpj: c.cpf_cnpj, email: c.email ?? "", telefone: c.telefone ?? "", endereco: c.endereco ?? "", rg: c.rg ?? "", estado_civil: c.estado_civil ?? "", nacionalidade: c.nacionalidade ?? "", data_nascimento: c.data_nascimento ?? "" });
    setEditing(c);
  }

  function openAdd() {
    setForm({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", rg: "", estado_civil: "", nacionalidade: "", data_nascimento: "" });
    setShowAdd(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, email: form.email || null, telefone: form.telefone || null, endereco: form.endereco || null, rg: form.rg || null, estado_civil: form.estado_civil || null, nacionalidade: form.nacionalidade || null, data_nascimento: form.data_nascimento || null };
    if (editing) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editing.id);
      if (error) { toast.error(translateError(error)); return; }
      toast.success("Cliente atualizado!");
      setEditing(null);
    } else {
      const { error } = await supabase.from("clientes").insert(payload);
      if (error) { toast.error(translateError(error)); return; }
      toast.success("Cliente cadastrado!");
      setShowAdd(false);
    }
    load();
  }
  
  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("clientes").delete().eq("id", deleting.id);
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Cliente excluído!");
    setDeleting(null);
    load();
  }

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    return c.nome.toLowerCase().includes(q) || c.cpf_cnpj.includes(q);
  });

  const formFields = (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
        <div><Label>CPF/CNPJ *</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} required /></div>
        <div><Label>RG</Label><Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} /></div>
        <div><Label>Data de Nascimento</Label><Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} /></div>
        <div><Label>Nacionalidade</Label><Input value={form.nacionalidade} onChange={(e) => setForm({ ...form, nacionalidade: e.target.value })} placeholder="Ex: Brasileiro(a)" /></div>
        <div><Label>Estado Civil</Label><Input value={form.estado_civil} onChange={(e) => setForm({ ...form, estado_civil: e.target.value })} placeholder="Ex: Solteiro(a)" /></div>
        <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
      </div>
      <div><Label>Endereço Completo</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, Número, Bairro, CEP..." /></div>
      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        {canWrite && (
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>{formFields}</DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CPF/CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>RG</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                {canWrite && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.cpf_cnpj}</TableCell>
                  <TableCell>{c.rg ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.telefone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleting(c)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={canWrite ? 6 : 5} className="text-center text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent><DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>{formFields}</DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{deleting?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
