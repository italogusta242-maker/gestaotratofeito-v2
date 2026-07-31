import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function ExportBackup() {
  const [loading, setLoading] = useState(false);

  async function exportar() {
    setLoading(true);
    try {
      const [veicRes, txRes, clientesRes, contasRes] = await Promise.all([
        supabase.from("veiculos").select("*, centros_custo(nome)").order("created_at", { ascending: false }),
        supabase.from("transacoes").select("*, centros_custo(nome), contas_bancarias(nome)").order("data_vencimento", { ascending: false }),
        supabase.from("clientes").select("*").order("nome"),
        supabase.from("contas_bancarias").select("*"),
      ]);

      const wb = XLSX.utils.book_new();

      // Veículos
      const veicData = (veicRes.data ?? []).map(v => ({
        Placa: v.placa,
        "Marca/Modelo": v.marca_modelo,
        Ano: v.ano,
        Cor: v.cor,
        Renavam: v.renavam,
        Status: v.status,
        Localização: v.localizacao,
        "Valor Aquisição": Number(v.valor_aquisicao),
        "Centro Custo": v.centros_custo?.nome ?? "",
        Consignado: v.is_consignment ? "Sim" : "Não",
        "Data Cadastro": v.created_at?.split("T")[0],
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(veicData), "Veículos");

      // Transações
      const txData = (txRes.data ?? []).map(t => ({
        Descrição: t.descricao,
        Tipo: t.tipo,
        Valor: Number(t.valor),
        Status: t.status,
        Vencimento: t.data_vencimento,
        Pagamento: t.data_pagamento ?? "",
        Categoria: t.categoria ?? "",
        "Centro Custo": t.centros_custo?.nome ?? "",
        "Conta Bancária": t.contas_bancarias?.nome ?? "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txData), "Transações");

      // Clientes
      const cliData = (clientesRes.data ?? []).map(c => ({
        Nome: c.nome,
        "CPF/CNPJ": c.cpf_cnpj,
        Telefone: c.telefone ?? "",
        Email: c.email ?? "",
        Endereço: c.endereco ?? "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cliData), "Clientes");

      // Contas Bancárias
      const contData = (contasRes.data ?? []).map(c => ({
        Nome: c.nome,
        Tipo: c.tipo,
        "Saldo Inicial": Number(c.saldo_inicial),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contData), "Contas Bancárias");

      const hoje = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `backup_meu_carro_online_${hoje}.xlsx`);
      toast.success("Backup exportado com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="gap-1" onClick={exportar} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Exportar Backup Excel
    </Button>
  );
}
