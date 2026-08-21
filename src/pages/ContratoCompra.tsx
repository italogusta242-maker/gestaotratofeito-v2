import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { enderecoCompleto, formatBRL } from "@/lib/format";
import { EMPRESA } from "@/lib/empresa";
import { saveElementAsPdf } from "@/lib/pdf";
import logoTratoFeito from "@/assets/logo-trato-feito.png";
import type { Veiculo, Cliente, Transacao } from "@/lib/db-types";

export default function ContratoCompra() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [despesas, setDespesas] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const conteudoRef = useRef<HTMLDivElement>(null);

  async function handleSalvarPdf() {
    if (!conteudoRef.current || !veiculo) return;
    setSalvando(true);
    try {
      const nomeArquivo = `ContratoCompra_${veiculo.placa}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      await saveElementAsPdf(conteudoRef.current, nomeArquivo);
      toast.success("PDF salvo!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Não foi possível gerar o PDF");
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: v } = await supabase
        .from("veiculos")
        .select("*")
        .eq("id", id)
        .single();
      setVeiculo(v);

      if (v?.cliente_compra_id) {
        const { data: c } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", v.cliente_compra_id)
          .single();
        setCliente(c);
      }

      const { data: txs } = await supabase
        .from("transacoes")
        .select("*")
        .eq("veiculo_id", id)
        .eq("tipo", "Despesa")
        .in("categoria", ["Dedução", "IPVA", "Multas", "Licenciamento", "Despesa de Veículo"]);
      setDespesas(txs ?? []);

      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  if (!veiculo) return <div className="flex items-center justify-center min-h-screen">Veículo não encontrado.</div>;

  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const valorBruto = Number(veiculo.valor_aquisicao);
  const valorLiquido = valorBruto - totalDespesas;

  return (
    <div className="bg-white min-h-screen text-black printable-area">
      {/* Print button - hidden on print */}
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2 no-print">
        <Button onClick={() => navigate(`/veiculos/${id}/detalhe`)} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={() => window.print()} className="gap-2 bg-black text-white hover:bg-gray-800">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
        <Button onClick={handleSalvarPdf} disabled={salvando} variant="secondary" className="gap-2">
          <Download className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar PDF"}
        </Button>
      </div>

      <div ref={conteudoRef} className="max-w-[210mm] mx-auto px-12 py-10 print:px-0 print:py-0 print:max-w-none text-[13px] leading-relaxed font-serif">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              /* Isola o contrato do resto do app (sidebar, topbar do menu,
                 header do usuário). Sem isso o print vinha com a UI toda. */
              body * { visibility: hidden; }
              .printable-area, .printable-area * { visibility: visible; }
              .printable-area {
                position: absolute;
                left: 0; top: 0;
                width: 100%;
                margin: 0;
              }
              .no-print { display: none !important; }
              @page { margin: 15mm 15mm; }
            }
          `
        }} />
        {/* Header */}
        <div className="text-center mb-6">
          <img src={logoTratoFeito} alt="Trato Feito Seminovos" className="mx-auto h-20 mb-2" />
          <h1 className="text-lg font-bold uppercase tracking-wide">{EMPRESA.razaoSocial}</h1>
          <p className="text-xs text-gray-600">CNPJ: {EMPRESA.cnpj}</p>
          <p className="text-xs text-gray-600">{EMPRESA.enderecoCompleto}</p>
          <hr className="mt-4 border-black" />
          <h2 className="text-sm font-bold mt-4 uppercase">
            Instrumento Particular de Aceite de Proposta de Compra de Veículo Mediante Intermediação
          </h2>
        </div>

        {/* Bloco 1 - Identificação das Partes */}
        <section className="mb-6">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Identificação das Partes</h3>

          <div className="mb-4">
            <p className="font-bold">CONTRATADA:</p>
            <p>{EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}, {EMPRESA.enderecoCompleto}.</p>
          </div>

          <div>
            <p className="font-bold">CONTRATANTE (Dados do Cliente):</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 border border-black p-3">
              <div><span className="font-semibold">Nome/Razão Social:</span> {cliente?.nome ?? "___________________________"}</div>
              <div><span className="font-semibold">CPF/CNPJ:</span> {cliente?.cpf_cnpj ?? "___________________________"}</div>
              <div className="col-span-2"><span className="font-semibold">Endereço:</span> {enderecoCompleto(cliente) || "___________________________"}</div>
              <div><span className="font-semibold">Contato:</span> {cliente?.telefone ?? "___________________________"}</div>
              <div><span className="font-semibold">E-mail:</span> {cliente?.email ?? "___________________________"}</div>
            </div>
          </div>
        </section>

        {/* Bloco 2 - Dados do Veículo */}
        <section className="mb-6">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Dados do Veículo</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 border border-black p-3">
            <div><span className="font-semibold">Renavam:</span> {veiculo.renavam ?? "_______________"}</div>
            <div><span className="font-semibold">Placa:</span> {veiculo.placa}</div>
            <div><span className="font-semibold">Chassi:</span> {veiculo.chassi ?? "___________________________"}</div>
            <div><span className="font-semibold">Marca/Modelo:</span> {veiculo.marca_modelo}</div>
            <div><span className="font-semibold">Ano Fab/Modelo:</span> {veiculo.ano}{veiculo.ano_modelo && veiculo.ano_modelo !== veiculo.ano ? `/${veiculo.ano_modelo}` : ""}</div>
            <div><span className="font-semibold">Cor:</span> {veiculo.cor ?? "_______________"}</div>
            <div><span className="font-semibold">Combustível:</span> {veiculo.combustivel ?? "_______________"}</div>
            <div><span className="font-semibold">Quilometragem:</span> {veiculo.quilometragem != null ? `${veiculo.quilometragem.toLocaleString("pt-BR")} km` : "_______________"}</div>
          </div>
        </section>

        {/* Bloco 3 - Negociação e Valores */}
        <section className="mb-6">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Negociação e Valores</h3>
          <table className="w-full border-collapse border border-black text-sm">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black w-1/2">1. Valor Bruto Negociado:</td>
                <td className="p-2">{formatBRL(valorBruto)}</td>
              </tr>
              {despesas.map((d, i) => (
                <tr key={d.id} className="border-b border-black">
                  <td className="p-2 border-r border-black pl-6">Dedução {i + 1}: {d.descricao}</td>
                  <td className="p-2">{formatBRL(Number(d.valor))}</td>
                </tr>
              ))}
              {despesas.length === 0 && (
                <tr className="border-b border-black">
                  <td className="p-2 border-r border-black">Débitos / Deduções:</td>
                  <td className="p-2">R$ _______________</td>
                </tr>
              )}
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black">2. Total de Deduções:</td>
                <td className="p-2 font-semibold">{formatBRL(totalDespesas)}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold border-r border-black">3. Valor Líquido:</td>
                <td className="p-2 font-bold">{formatBRL(valorLiquido)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Bloco 4 - Dados de Pagamento via PIX */}
        <section className="mb-6">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Dados para Pagamento (PIX)</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 border border-black p-3">
            <div><span className="font-semibold">Beneficiário(a):</span> {cliente?.nome ?? "___________________________"}</div>
            <div><span className="font-semibold">CPF/CNPJ:</span> {cliente?.cpf_cnpj ?? "___________________________"}</div>
            <div className="col-span-2"><span className="font-semibold">Chave PIX:</span> {cliente?.chave_pix ?? "___________________________"}</div>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 italic">Pagamento realizado exclusivamente via PIX na chave informada pelo(a) CONTRATANTE.</p>
        </section>

        {/* Bloco 5 - Cláusulas */}
        <section className="mb-6 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Cláusulas Contratuais</h3>

          <p className="mb-2">Pelo presente instrumento particular de aceite de proposta de compra de veículo de intermediação, as partes acima qualificadas têm entre si justo e acertado o seguinte:</p>

          <h4 className="font-bold mt-4 mb-2">Das Declarações Iniciais</h4>
          <p className="mb-1">1.1. A parte CONTRATANTE reconhece como perfeitos os serviços até então prestados pela MEU CARRO ON-LINE LTDA, para intermediar a venda do veículo automotor, qualificado no preâmbulo, de sua propriedade.</p>
          <p className="mb-1">1.2. A parte CONTRATANTE declara, sob as penas da lei, que é legalmente a proprietária e responsável pelo veículo, sendo de sua inteira responsabilidade as informações.</p>
          <p className="mb-1">1.3. A parte CONTRATANTE declara, sob sua responsabilidade, que o veículo objeto deste contrato encontra-se livre de quaisquer ônus, seja judicial ou extrajudicial, com exceção de eventuais débitos expressamente ressalvados.</p>

          <h4 className="font-bold mt-4 mb-2">Da Negociação</h4>
          <p className="mb-1">2.1. Pelo presente instrumento, a parte CONTRATANTE aceita, em caráter irrevogável e irretratável, a proposta de compra do seu veículo, intermediada pela MEU CARRO ON-LINE LTDA, no valor bruto descrito acima, declarando estar ciente e de acordo de todas as deduções incidentes sobre o aludido preço.</p>

          <h4 className="font-bold mt-4 mb-2">Do Pagamento</h4>
          <p className="mb-1">3.1. A parte CONTRATANTE autoriza e solicita o repasse dos valores relativos à compra para a conta bancária indicada acima, sendo de sua exclusiva responsabilidade os dados informados.</p>

          <h4 className="font-bold mt-4 mb-2">Das Obrigações da Contratada</h4>
          <p className="mb-1">4.1. A MEU CARRO ON-LINE LTDA obriga-se a receber do comprador o valor correspondente à negociação do bem, assim como realizar o repasse do valor à parte CONTRATANTE, nos moldes deste contrato, por meio de um único depósito na conta bancária de titularidade da parte CONTRATANTE ou de terceiro por ela indicado.</p>
          <p className="mb-1">4.2. Entregar, após o respectivo preenchimento e a assinatura, a cópia do documento único de transferência – DUT, para que a parte CONTRATANTE possa realizar a comunicação de venda.</p>
          <p className="mb-1">4.3. Na hipótese de o veículo conter quaisquer gravames, o pagamento será realizado somente após a(s) baixa(s) do(s) gravame(s) no órgão de trânsito.</p>

          <h4 className="font-bold mt-4 mb-2">Das Obrigações da Contratante</h4>
          <p className="mb-1">5.1. Informar a existência de qualquer falha, defeito ou desgaste do veículo existente, ainda que não aparente.</p>
          <p className="mb-1">5.2. Não retirar o veículo do estabelecimento da MEU CARRO ON-LINE LTDA, após a realização da perícia cautelar.</p>
          <p className="mb-1">5.3. Apresentar os documentos necessários para circulação e transferência do veículo.</p>
          <p className="mb-1">5.4. Outorgar procuração aos prepostos da MEU CARRO ON-LINE LTDA para fins de transferência do veículo.</p>
          <p className="mb-1">5.5. Arcar com o custo de perícia cautelar por empresa indicada pela MEU CARRO ON-LINE LTDA.</p>
          <p className="mb-1">5.6. Responsabilizar-se por quaisquer danos, multas, infrações, tributos e encargos incidentes sobre o veículo cujo fato gerador tenha ocorrido até o momento da entrega.</p>

          <h4 className="font-bold mt-4 mb-2">Da Cessão do Direito de Voz e Imagem</h4>
          <p className="mb-1">6.1. A parte CONTRATANTE autoriza a MEU CARRO ON-LINE LTDA, a título universal, em caráter total, definitivo, irrevogável e irretratável, a utilização da sua imagem e voz, para fixação em sítios eletrônicos, redes sociais e materiais publicitários.</p>

          <h4 className="font-bold mt-4 mb-2">Da Proteção de Dados</h4>
          <p className="mb-1">7.1. As partes se comprometem a respeitar a privacidade e a confidencialidade das informações, não divulgando a terceiros, com exceção das hipóteses previstas na lei.</p>
          <p className="mb-1">7.2. As partes se comprometem a adotar todas as boas práticas de proteção de dados e segurança da informação, nos termos da LGPD.</p>

          <h4 className="font-bold mt-4 mb-2">Das Disposições Finais</h4>
          <p className="mb-1">8.1. Em caso de impossibilidade presente ou superveniente da transferência do veículo junto ao órgão de trânsito, a MEU CARRO ON-LINE LTDA poderá exigir a resolução do negócio, com cláusula penal no importe de 10% sobre o valor bruto da negociação.</p>
          <p className="mb-1">9.1. Este contrato é firmado em caráter irrevogável e irretratável unilateralmente.</p>
          <p className="mb-1">9.2. As partes elegem o foro da comarca do endereço da MEU CARRO ON-LINE LTDA para dirimir quaisquer dúvidas.</p>
        </section>

        {/* Bloco 6 - Assinaturas — protegido contra quebra de página. */}
        <section className="mt-16 assinaturas-bloco">
          <p className="text-center mb-12">Brasília-DF, {hoje}.</p>

          <div className="grid grid-cols-2 gap-16 mt-16">
            <div className="text-center assinatura-item">
              <div className="border-t border-black pt-2 mx-4">
                <p className="font-bold">{EMPRESA.razaoSocial}</p>
                <p className="text-xs text-gray-600">CNPJ: {EMPRESA.cnpj}</p>
              </div>
            </div>
            <div className="text-center assinatura-item">
              <div className="border-t border-black pt-2 mx-4">
                <p className="font-bold">CONTRATANTE</p>
                <p className="text-xs text-gray-600">{cliente?.nome ?? "________________________"}</p>
                <p className="text-xs text-gray-600">CPF/CNPJ: {cliente?.cpf_cnpj ?? "________________________"}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
