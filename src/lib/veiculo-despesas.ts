import { supabase } from "@/integrations/supabase/client";

// Sincroniza uma despesa de categoria única (ex: IPVA, Multas) com o valor
// desejado. Se valor > 0: cria ou atualiza. Se valor == 0: apaga.
// Retorna erro se falhar.
export async function syncDespesaCategoria(params: {
  veiculoId: string;
  categoria: string;
  descricaoBase: string; // ex: "IPVA - ABC1D23"
  novoValor: number;
  centroId: string | null;
  dataVencimento: string;
  userId: string | undefined;
}) {
  const { veiculoId, categoria, descricaoBase, novoValor, centroId, dataVencimento, userId } = params;

  const { data: existing } = await supabase
    .from("transacoes")
    .select("id")
    .eq("veiculo_id", veiculoId)
    .eq("categoria", categoria)
    .eq("tipo", "Despesa")
    .limit(1);

  const existingId = existing?.[0]?.id;

  if (novoValor <= 0) {
    if (existingId) {
      await supabase.from("transacoes").delete().eq("id", existingId);
    }
    return;
  }

  if (existingId) {
    await supabase.from("transacoes").update({ valor: novoValor, descricao: descricaoBase }).eq("id", existingId);
  } else {
    await supabase.from("transacoes").insert({
      descricao: descricaoBase,
      valor: novoValor,
      tipo: "Despesa",
      status: "Pendente",
      data_vencimento: dataVencimento,
      centro_custo_id: centroId,
      veiculo_id: veiculoId,
      categoria,
      user_id: userId,
    });
  }
}
