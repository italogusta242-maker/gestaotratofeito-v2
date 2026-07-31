import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Check } from "lucide-react";

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
}

interface Props {
  label: string;
  value: string | null;
  onChange: (clienteId: string | null) => void;
}

export default function ClienteSelector({ label, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Cliente[]>([]);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newCliente, setNewCliente] = useState({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", rg: "", estado_civil: "", nacionalidade: "", data_nascimento: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (value) {
      supabase.from("clientes").select("*").eq("id", value).single().then(({ data }) => {
        if (data) setSelected(data);
      });
    }
  }, [value]);

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .or(`nome.ilike.%${q}%,cpf_cnpj.ilike.%${q}%`)
      .limit(8);
    setResults(data ?? []);
  }

  function pick(c: Cliente) {
    setSelected(c);
    onChange(c.id);
    setQuery("");
    setResults([]);
    setShowNew(false);
  }

  async function createAndPick() {
    if (!newCliente.nome || !newCliente.cpf_cnpj) return;
    setSaving(true);
    const { data, error } = await supabase.from("clientes").insert({
      nome: newCliente.nome,
      cpf_cnpj: newCliente.cpf_cnpj,
      email: newCliente.email || null,
      telefone: newCliente.telefone || null,
      endereco: newCliente.endereco || null,
      rg: newCliente.rg || null,
      estado_civil: newCliente.estado_civil || null,
      nacionalidade: newCliente.nacionalidade || null,
      data_nascimento: newCliente.data_nascimento || null,
    }).select().single();
    setSaving(false);
    if (error) { return; }
    if (data) pick(data);
  }

  function clear() {
    setSelected(null);
    onChange(null);
    setShowNew(false);
    setNewCliente({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", rg: "", estado_civil: "", nacionalidade: "", data_nascimento: "" });
  }

  if (selected) {
    return (
      <div>
        <Label>{label}</Label>
        <div className="flex items-center gap-2 mt-1 p-2 border rounded-md bg-muted/50">
          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selected.nome}</p>
            <p className="text-xs text-muted-foreground">{selected.cpf_cnpj}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>Trocar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF/CNPJ..."
          value={query}
          onChange={(e) => search(e.target.value)}
          className="pl-8"
        />
      </div>

      {results.length > 0 && (
        <div className="border rounded-md max-h-36 overflow-y-auto">
          {results.map((c) => (
            <button
              type="button"
              key={c.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 border-b last:border-0"
              onClick={() => pick(c)}
            >
              <span className="font-medium">{c.nome}</span>
              <span className="ml-2 text-muted-foreground">{c.cpf_cnpj}</span>
            </button>
          ))}
        </div>
      )}

      {!showNew ? (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowNew(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Cadastrar novo cliente
        </Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <h4 className="text-sm font-semibold">Novo Cliente</h4>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Nome *</Label><Input value={newCliente.nome} onChange={(e) => setNewCliente({ ...newCliente, nome: e.target.value })} required /></div>
            <div><Label className="text-xs">CPF/CNPJ *</Label><Input value={newCliente.cpf_cnpj} onChange={(e) => setNewCliente({ ...newCliente, cpf_cnpj: e.target.value })} required /></div>
            <div><Label className="text-xs">RG</Label><Input value={newCliente.rg} onChange={(e) => setNewCliente({ ...newCliente, rg: e.target.value })} /></div>
            <div><Label className="text-xs">E-mail</Label><Input value={newCliente.email} onChange={(e) => setNewCliente({ ...newCliente, email: e.target.value })} /></div>
            <div><Label className="text-xs">Telefone</Label><Input value={newCliente.telefone} onChange={(e) => setNewCliente({ ...newCliente, telefone: e.target.value })} /></div>
            <div><Label className="text-xs">Estado Civil</Label><Input value={newCliente.estado_civil} onChange={(e) => setNewCliente({ ...newCliente, estado_civil: e.target.value })} placeholder="Solteiro, Casado..." /></div>
            <div><Label className="text-xs">Nacionalidade</Label><Input value={newCliente.nacionalidade} onChange={(e) => setNewCliente({ ...newCliente, nacionalidade: e.target.value })} placeholder="Brasileiro(a)" /></div>
            <div><Label className="text-xs">Data Nascimento</Label><Input type="date" value={newCliente.data_nascimento} onChange={(e) => setNewCliente({ ...newCliente, data_nascimento: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Endereço</Label><Input value={newCliente.endereco} onChange={(e) => setNewCliente({ ...newCliente, endereco: e.target.value })} /></div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={createAndPick} disabled={saving || !newCliente.nome || !newCliente.cpf_cnpj}>
              Salvar e Selecionar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
