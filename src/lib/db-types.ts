import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type Veiculo = Tables["veiculos"]["Row"];
export type VeiculoInsert = Tables["veiculos"]["Insert"];
export type VeiculoUpdate = Tables["veiculos"]["Update"];

export type Transacao = Tables["transacoes"]["Row"];
export type TransacaoInsert = Tables["transacoes"]["Insert"];
export type TransacaoUpdate = Tables["transacoes"]["Update"];

export type Cliente = Tables["clientes"]["Row"];
export type ClienteInsert = Tables["clientes"]["Insert"];

export type CentroCusto = Tables["centros_custo"]["Row"];
export type ContaBancaria = Tables["contas_bancarias"]["Row"];
export type Cartao = Tables["cartoes"]["Row"];
export type Financiamento = Tables["financiamentos"]["Row"];
export type ContaFixa = Tables["contas_fixas"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type UserRole = Tables["user_roles"]["Row"];

// Veiculo com relação centros_custo(nome) — padrão em várias queries
export type VeiculoComCentro = Veiculo & { centros_custo: { nome: string } | null };
