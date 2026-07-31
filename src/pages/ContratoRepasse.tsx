import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ContratoRepasse() {
  const { id } = useParams<{ id: string }>();
  const [veiculo, setVeiculo] = useState<any>(null);
  const [clienteCompra, setClienteCompra] = useState<any>(null);
  const [clienteVenda, setClienteVenda] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: v } = await supabase.from("veiculos").select("*").eq("id", id).single();
      setVeiculo(v);
      if (v?.cliente_compra_id) {
        const { data: c } = await supabase.from("clientes").select("*").eq("id", v.cliente_compra_id).single();
        setClienteCompra(c);
      }
      if (v?.cliente_venda_id) {
        const { data: c } = await supabase.from("clientes").select("*").eq("id", v.cliente_venda_id).single();
        setClienteVenda(c);
      }
      setLoading(false);
    })();
  }, [id]);

  const navigate = useNavigate();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  if (!veiculo) return <div className="flex items-center justify-center min-h-screen">Veículo não encontrado.</div>;

  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const anoDisplay = veiculo.ano_modelo && veiculo.ano_modelo !== veiculo.ano ? `${veiculo.ano}/${veiculo.ano_modelo}` : veiculo.ano;

  return (
    <div className="bg-white min-h-screen text-black">
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2">
        <Button onClick={() => navigate(`/veiculos/${id}/detalhe`)} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={() => window.print()} className="gap-2 bg-black text-white hover:bg-gray-800">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto px-12 py-10 print:px-0 print:py-0 print:max-w-none text-[13px] leading-relaxed font-serif">
        <div className="text-center mb-8">
          <h1 className="text-lg font-bold uppercase tracking-wide">MEU CARRO ON-LINE LIMITADA</h1>
          <p className="text-xs text-gray-600">CNPJ: 58.728.871/0001-06</p>
          <p className="text-xs text-gray-600">QS 1 RUA 210 LOTES 34/36, SALA 1106 ED. LED OFFICE – ÁGUAS CLARAS – BRASÍLIA/DF – CEP 71950-770</p>
          <hr className="mt-4 border-black" />
          <h2 className="text-sm font-bold mt-4 uppercase">Contrato de Repasse de Veículo</h2>
        </div>

        <section className="mb-6">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Identificação das Partes</h3>
          <div className="mb-4">
            <p className="font-bold">REPASSADORA:</p>
            <p>MEU CARRO ON-LINE LIMITADA, CNPJ 58.728.871/0001-06, QS 1 RUA 210 LOTES 34/36, SALA 1106 ED. LED OFFICE, ÁGUAS CLARAS – BRASÍLIA/DF, CEP 71950-770.</p>
          </div>
          <div className="mb-4">
            <p className="font-bold">CEDENTE (Proprietário Original):</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 border border-black p-3">
              <div><span className="font-semibold">Nome:</span> {clienteCompra?.nome ?? "___________________________"}</div>
              <div><span className="font-semibold">CPF/CNPJ:</span> {clienteCompra?.cpf_cnpj ?? "___________________________"}</div>
              <div className="col-span-2"><span className="font-semibold">Endereço:</span> {clienteCompra?.endereco ?? "___________________________"}</div>
              <div><span className="font-semibold">Contato:</span> {clienteCompra?.telefone ?? "___________________________"}</div>
            </div>
          </div>
          <div>
            <p className="font-bold">CESSIONÁRIO(A) (Novo Comprador):</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 border border-black p-3">
              <div><span className="font-semibold">Nome:</span> {clienteVenda?.nome ?? "___________________________"}</div>
              <div><span className="font-semibold">CPF/CNPJ:</span> {clienteVenda?.cpf_cnpj ?? "___________________________"}</div>
              <div className="col-span-2"><span className="font-semibold">Endereço:</span> {clienteVenda?.endereco ?? "___________________________"}</div>
              <div><span className="font-semibold">Contato:</span> {clienteVenda?.telefone ?? "___________________________"}</div>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Dados do Veículo</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 border border-black p-3">
            <div><span className="font-semibold">Placa:</span> {veiculo.placa}</div>
            <div><span className="font-semibold">Renavam:</span> {veiculo.renavam ?? "_______________"}</div>
            <div><span className="font-semibold">Marca/Modelo:</span> {veiculo.marca_modelo}</div>
            <div><span className="font-semibold">Ano Fab/Modelo:</span> {anoDisplay}</div>
            <div><span className="font-semibold">Cor:</span> {veiculo.cor ?? "_______________"}</div>
            <div><span className="font-semibold">Chassi:</span> {veiculo.chassi ?? "_______________"}</div>
            <div><span className="font-semibold">Combustível:</span> {veiculo.combustivel ?? "_______________"}</div>
          </div>
        </section>

        <section className="mb-6 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Cláusulas</h3>
          <p className="mb-2"><strong>CLÁUSULA 1ª — DO OBJETO:</strong> O presente contrato tem por objeto o repasse do veículo acima descrito, do CEDENTE para o(a) CESSIONÁRIO(A), com a intermediação da REPASSADORA.</p>
          <p className="mb-2"><strong>CLÁUSULA 2ª — DO VALOR:</strong> O valor total do repasse é de R$ _______________, a ser pago da seguinte forma: _______________.</p>
          <p className="mb-2"><strong>CLÁUSULA 3ª — DA TRANSFERÊNCIA:</strong> O(A) CESSIONÁRIO(A) se compromete a realizar a transferência da documentação do veículo junto ao DETRAN no prazo de 30 dias.</p>
          <p className="mb-2"><strong>CLÁUSULA 4ª — DAS RESPONSABILIDADES:</strong> A partir da assinatura, o(a) CESSIONÁRIO(A) assume todas as responsabilidades sobre o veículo, incluindo multas, tributos e encargos.</p>
          <p className="mb-2"><strong>CLÁUSULA 5ª — DA GARANTIA:</strong> O CEDENTE declara que o veículo está livre de ônus e que as informações prestadas são verdadeiras.</p>
          <p className="mb-2"><strong>CLÁUSULA 6ª — DO FORO:</strong> Fica eleito o foro da comarca de Brasília/DF para dirimir quaisquer dúvidas.</p>
        </section>

        <section className="mt-16">
          <p className="text-center mb-12">Brasília-DF, {hoje}.</p>
          <div className="grid grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-2">
                <p className="font-bold text-xs">REPASSADORA</p>
                <p className="text-xs text-gray-600">MEU CARRO ONLINE LTDA</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-2">
                <p className="font-bold text-xs">CEDENTE</p>
                <p className="text-xs text-gray-600">{clienteCompra?.nome ?? "________________________"}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-2">
                <p className="font-bold text-xs">CESSIONÁRIO(A)</p>
                <p className="text-xs text-gray-600">{clienteVenda?.nome ?? "________________________"}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
