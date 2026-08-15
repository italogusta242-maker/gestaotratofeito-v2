import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CepInput, CpfCnpjInput, PhoneInput } from "@/components/ui/masked-input";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Cliente } from "@/lib/db-types";
import { translateError } from "@/lib/supabase-errors";
import { buscarCep, formatCep, normalizeCep } from "@/lib/cep";

export default function Clientes() {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "auxiliar_operacional";
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", rg: "", estado_civil: "", nacionalidade: "", data_nascimento: "", cep: "", bairro: "", cidade: "", uf: "", chave_pix: "", chave_pix_tipo: "" });
  const [submitting, setSubmitting] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("clientes").select("*").order("nome");
    if (error) { console.error("clientes:", error); toast.error("Falha ao carregar clientes"); }
    setClientes(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(c: Cliente) {
    setForm({
      nome: c.nome, cpf_cnpj: c.cpf_cnpj, email: c.email ?? "", telefone: c.telefone ?? "",
      endereco: c.endereco ?? "", rg: c.rg ?? "", estado_civil: c.estado_civil ?? "",
      nacionalidade: c.nacionalidade ?? "", data_nascimento: c.data_nascimento ?? "",
      cep: c.cep ?? "", bairro: c.bairro ?? "", cidade: c.cidade ?? "", uf: c.uf ?? "",
      chave_pix: c.chave_pix ?? "", chave_pix_tipo: c.chave_pix_tipo ?? "",
    });
    setEditing(c);
  }

  function openAdd() {
    setForm({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", rg: "", estado_civil: "", nacionalidade: "", data_nascimento: "", cep: "", bairro: "", cidade: "", uf: "", chave_pix: "", chave_pix_tipo: "" });
    setShowAdd(true);
  }

  async function buscaEAtualiza(cepRaw: string) {
    const clean = normalizeCep(cepRaw);
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    const endereco = await buscarCep(clean);
    setBuscandoCep(false);
    if (!endereco) {
      toast.error("CEP não encontrado ou API indisponível.");
      return;
    }
    setForm(f => ({
      ...f,
      cep: formatCep(clean),
      bairro: endereco.bairro || f.bairro,
      cidade: endereco.cidade || f.cidade,
      uf: endereco.uf || f.uf,
      endereco: f.endereco?.trim() ? f.endereco : endereco.logradouro,
    }));
    toast.success("Endereço preenchido pelo CEP.");
  }

  function handleCepChange(value: string) {
    setForm(f => ({ ...f, cep: value }));
    // Auto-busca assim que tiver 8 dígitos (independente de formatação)
    if (normalizeCep(value).length === 8) {
      buscaEAtualiza(value);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const nome = form.nome.trim();
    const cpfCnpj = form.cpf_cnpj.trim();
    if (!nome) { toast.error("Informe o nome."); return; }
    if (!cpfCnpj) { toast.error("Informe o CPF/CNPJ."); return; }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("E-mail inválido."); return; }
    const dataNasc = form.data_nascimento.trim();
    if (dataNasc && !/^\d{4}-\d{2}-\d{2}$/.test(dataNasc)) { toast.error("Data de nascimento inválida."); return; }
    const payload = {
      nome,
      cpf_cnpj: cpfCnpj,
      email: email || null,
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      rg: form.rg.trim() || null,
      estado_civil: form.estado_civil.trim() || null,
      nacionalidade: form.nacionalidade.trim() || null,
      data_nascimento: dataNasc || null,
      cep: form.cep.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim().toUpperCase() || null,
      chave_pix: form.chave_pix.trim() || null,
      chave_pix_tipo: form.chave_pix_tipo || null,
    };
    setSubmitting(true);
    if (editing) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editing.id);
      setSubmitting(false);
      if (error) { toast.error(translateError(error)); return; }
      toast.success("Cliente atualizado!");
      setEditing(null);
    } else {
      const { error } = await supabase.from("clientes").insert(payload);
      setSubmitting(false);
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
      <Accordion type="multiple" defaultValue={["pessoais", "contato", "endereco"]} className="space-y-2">

        {/* Dados Pessoais */}
        <AccordionItem value="pessoais" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">👤 Dados Pessoais</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="col-span-2"><Label>Nome / Razão Social *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div><Label>CPF/CNPJ *</Label><CpfCnpjInput value={form.cpf_cnpj} onChange={(v) => setForm({ ...form, cpf_cnpj: v })} required /></div>
              <div><Label>RG</Label><Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} /></div>
              <div><Label>Data de Nascimento</Label><Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} /></div>
              <div><Label>Nacionalidade</Label><Input value={form.nacionalidade} onChange={(e) => setForm({ ...form, nacionalidade: e.target.value })} placeholder="Ex: Brasileiro(a)" /></div>
              <div className="col-span-2"><Label>Estado Civil</Label><Input value={form.estado_civil} onChange={(e) => setForm({ ...form, estado_civil: e.target.value })} placeholder="Ex: Solteiro(a)" /></div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Contato */}
        <AccordionItem value="contato" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">📞 Contato</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div><Label>Telefone</Label><PhoneInput value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Endereço */}
        <AccordionItem value="endereco" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">📍 Endereço</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-2">
                  <Label>CEP {buscandoCep && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
                  <CepInput
                    value={form.cep}
                    onChange={(v) => { setForm({ ...form, cep: v }); if (v.replace(/\D/g, "").length === 8) buscaEAtualiza(v); }}
                    onBlur={() => buscaEAtualiza(form.cep)}
                  />
                </div>
                <div className="col-span-3"><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
                <div className="col-span-1"><Label>UF</Label><Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} maxLength={2} className="uppercase text-center" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>Endereço (Rua e nº)</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, complemento" /></div>
                <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Chave PIX */}
        <AccordionItem value="pix" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">💸 Chave PIX (para receber pagamentos)</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <Label>Tipo</Label>
                <Select value={form.chave_pix_tipo || "__none__"} onValueChange={(v) => setForm({ ...form, chave_pix_tipo: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem chave</SelectItem>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Telefone">Telefone</SelectItem>
                    <SelectItem value="Aleatória">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Chave</Label>
                {form.chave_pix_tipo === "CPF" || form.chave_pix_tipo === "CNPJ" ? (
                  <CpfCnpjInput value={form.chave_pix} onChange={(v) => setForm({ ...form, chave_pix: v })} />
                ) : form.chave_pix_tipo === "Telefone" ? (
                  <PhoneInput value={form.chave_pix} onChange={(v) => setForm({ ...form, chave_pix: v })} />
                ) : (
                  <Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} placeholder={
                    form.chave_pix_tipo === "Email" ? "email@exemplo.com" :
                    form.chave_pix_tipo === "Aleatória" ? "chave UUID" :
                    "informe o tipo primeiro"
                  } />
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>

      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        {canWrite && (
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button></DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>{formFields}</DialogContent>
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
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>{formFields}</DialogContent>
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
