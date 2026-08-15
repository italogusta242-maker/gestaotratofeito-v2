import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL, parseDateLocal } from "@/lib/format";
import { EMPRESA } from "@/lib/empresa";
import { fetchPixEmpresa } from "@/lib/pix";
import logoTratoFeito from "@/assets/logo-trato-feito.png";
import type { Veiculo, Cliente, Transacao, ChavePix } from "@/lib/db-types";

export default function ContratoVenda() {
  const { id } = useParams<{ id: string }>();
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pagamentos, setPagamentos] = useState<Transacao[]>([]);
  const [pixEmpresa, setPixEmpresa] = useState<ChavePix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: v } = await supabase.from("veiculos").select("*").eq("id", id).single();
      setVeiculo(v);
      if (v?.cliente_venda_id) {
        const { data: c } = await supabase.from("clientes").select("*").eq("id", v.cliente_venda_id).single();
        setCliente(c);
      }
      const { data: txs } = await supabase
        .from("transacoes")
        .select("*")
        .eq("veiculo_id", id)
        .eq("tipo", "Receita")
        .order("data_vencimento");
      setPagamentos(txs ?? []);
      setPixEmpresa(await fetchPixEmpresa());
      setLoading(false);
    })();
  }, [id]);

  const navigate = useNavigate();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  if (!veiculo) return <div className="flex items-center justify-center min-h-screen">Veículo não encontrado.</div>;

  const hoje = new Date();
  const dia = format(hoje, "dd");
  const mesExtenso = format(hoje, "MMMM", { locale: ptBR });
  const ano = format(hoje, "yyyy");
  const anoDisplay = veiculo.ano_modelo && veiculo.ano_modelo !== veiculo.ano ? `${veiculo.ano}/${veiculo.ano_modelo}` : veiculo.ano;

  const totalNegociacao = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  const linhasPagamento = [...pagamentos];
  while (linhasPagamento.length < 3) {
    linhasPagamento.push(null as unknown as Transacao);
  }

  return (
    <div className="bg-white min-h-screen text-black printable-area">
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2 no-print">
        <Button onClick={() => navigate(`/veiculos/${id}/detalhe`)} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={() => window.print()} className="gap-2 bg-black text-white hover:bg-gray-800">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto px-12 py-10 print:px-0 print:py-0 print:max-w-none text-[12px] leading-relaxed font-serif">
        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <img src={logoTratoFeito} alt="Trato Feito Seminovos" className="mx-auto h-20 mb-2" />
          <h1 className="text-base font-bold uppercase tracking-wide">{EMPRESA.razaoSocial}</h1>
          <p className="text-xs text-gray-600">CNPJ: {EMPRESA.cnpj}</p>
          <p className="text-xs text-gray-600">{EMPRESA.enderecoCompleto}</p>
          <hr className="mt-4 border-black" />
          <h2 className="text-sm font-bold mt-4 uppercase">Contrato Particular de Compra e Venda de Veículo Automotor</h2>
        </div>

        {/* 1. Partes */}
        <section className="mb-4">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">1. Partes Contratantes</h3>

          <div className="mb-3 text-justify">
            <p><strong>VENDEDORA:</strong> {EMPRESA.razaoSocial}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {EMPRESA.cnpj}, com sede na {EMPRESA.enderecoCompleto}, doravante denominada simplesmente "VENDEDORA".</p>
          </div>

          <div className="mb-2">
            <p className="font-bold">COMPRADOR(A):</p>
            <div className="border border-black p-3 grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
              <div className="col-span-2"><span className="font-semibold">Nome/Razão Social:</span> {cliente?.nome ?? "____________________________________________"}</div>
              <div><span className="font-semibold">CPF/CNPJ:</span> {cliente?.cpf_cnpj ?? "____________________"}</div>
              <div><span className="font-semibold">RG:</span> {cliente?.rg ?? "____________________"}</div>
              <div className="col-span-2"><span className="font-semibold">Endereço:</span> {cliente?.endereco ?? "________________________________________________________________"}</div>
              <div><span className="font-semibold">Telefone:</span> {cliente?.telefone ?? "____________________"}</div>
              <div><span className="font-semibold">E-mail:</span> {cliente?.email ?? "____________________"}</div>
            </div>
          </div>
        </section>

        {/* Dados do Veículo */}
        <section className="mb-4">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">2. Objeto — Dados do Veículo</h3>
          <div className="border border-black p-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <div><span className="font-semibold">Marca/Modelo:</span> {veiculo.marca_modelo}</div>
            <div><span className="font-semibold">Ano Fab/Modelo:</span> {anoDisplay}</div>
            <div><span className="font-semibold">Placa:</span> {veiculo.placa}</div>
            <div><span className="font-semibold">Renavam:</span> {veiculo.renavam ?? "_______________"}</div>
            <div className="col-span-2"><span className="font-semibold">Chassi:</span> {veiculo.chassi ?? "_______________________________"}</div>
            <div><span className="font-semibold">Cor:</span> {veiculo.cor ?? "_______________"}</div>
            <div><span className="font-semibold">Combustível:</span> {veiculo.combustivel ?? "_______________"}</div>
            <div><span className="font-semibold">KM:</span> {veiculo.quilometragem != null ? `${veiculo.quilometragem.toLocaleString("pt-BR")}` : "_______________"}</div>
            <div><span className="font-semibold">Espécie:</span> {veiculo.especie ?? "_______________"}</div>
          </div>
        </section>

        {/* 3. Preço e Pagamento */}
        <section className="mb-4 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">3. Do Preço e Forma de Pagamento</h3>
          <p className="mb-2">3.1. O preço total do veículo e a respectiva forma de pagamento estão descritos no quadro abaixo, que integra este Contrato para todos os fins:</p>

          <table className="w-full border-collapse border border-black text-[11px] my-2">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-1 w-10">Nº</th>
                <th className="border border-black p-1">Forma de Pagamento</th>
                <th className="border border-black p-1 w-32">Vencimento</th>
                <th className="border border-black p-1 w-36">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {linhasPagamento.map((p, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">{i + 1}</td>
                  <td className="border border-black p-1">{p ? p.descricao : "________________________"}</td>
                  <td className="border border-black p-1 text-center">
                    {p ? format(parseDateLocal(p.data_vencimento) ?? new Date(), "dd/MM/yyyy") : "____/____/______"}
                  </td>
                  <td className="border border-black p-1 text-right">{p ? formatBRL(Number(p.valor)) : "R$ ________________"}</td>
                </tr>
              ))}
              <tr>
                <td className="border border-black p-1 font-bold text-right" colSpan={3}>VALOR TOTAL DA NEGOCIAÇÃO</td>
                <td className="border border-black p-1 font-bold text-right">{totalNegociacao > 0 ? formatBRL(totalNegociacao) : "R$ ______________________"}</td>
              </tr>
            </tbody>
          </table>

          <p className="mb-2">3.2. O pagamento poderá ser realizado mediante <strong>PIX</strong>, em conta de titularidade da VENDEDORA, <strong>CHAVE ({pixEmpresa?.tipo ?? "____"}): {pixEmpresa?.chave ?? "_______________________________"}</strong>, sendo obrigatória a apresentação do respectivo comprovante pelo(a) COMPRADOR(A).</p>
          <p className="mb-2">3.3. É vedada a realização de pagamentos diretamente a colaboradores, prepostos ou terceiros não indicados formalmente pela VENDEDORA, sob pena de o valor não ser reconhecido como quitação da obrigação.</p>
        </section>

        {/* 4. Transferência */}
        <section className="mb-4 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">4. Da Entrega e Transferência de Propriedade</h3>
          <p className="mb-2">4.1. Comprovado o integral pagamento do preço, a VENDEDORA entregará ao(à) COMPRADOR(A) o Documento Único de Transferência (DUT/CRV) devidamente preenchido e assinado, ou procuração para fins de transferência.</p>
          <p className="mb-2">4.2. O(A) COMPRADOR(A) se compromete a promover, às suas expensas, a transferência da propriedade do veículo junto ao órgão de trânsito competente no prazo máximo de <strong>30 (trinta) dias</strong> contados da entrega do DUT/CRV.</p>
          <p className="mb-2">4.3. A partir da entrega do veículo, o(a) COMPRADOR(A) assume integral responsabilidade civil, penal, administrativa e tributária sobre o bem, inclusive multas de trânsito, IPVA, DPVAT, licenciamento, seguros e demais encargos incidentes.</p>
        </section>

        {/* 5. Condição do Veículo */}
        <section className="mb-4 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">5. Da Condição do Veículo e Vistoria</h3>
          <p className="mb-2">5.1. O(A) COMPRADOR(A) declara que examinou previamente o veículo, tendo pleno conhecimento de que se trata de veículo usado, aceitando-o no estado em que se encontra, ressalvados os direitos legais aplicáveis quanto a vícios ocultos que comprometam a utilização normal do bem.</p>
          <p className="mb-2">5.2. A VENDEDORA declara que, na data de assinatura deste Contrato, o veículo se encontra livre e desembaraçado de quaisquer ônus, gravames, alienações fiduciárias, penhoras ou restrições judiciais que impeçam a sua transferência, salvo aqueles expressamente informados ao(à) COMPRADOR(A) no ato da negociação.</p>
        </section>

        {/* 6. Chargeback */}
        <section className="mb-4 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">6. Da Proteção Financeira (Chargeback e Contestações)</h3>
          <p className="mb-2">6.1. Em caso de contestação bancária, chargeback, sustação, bloqueio ou estorno de qualquer valor pago após a entrega do veículo, sem justa causa comprovada, o(a) COMPRADOR(A) reconhece a dívida correspondente como líquida, certa e exigível, autorizando desde já a cobrança judicial imediata, acrescida de multa de 10% (dez por cento) e honorários advocatícios de 20% (vinte por cento).</p>
        </section>

        {/* 7. Inadimplemento */}
        <section className="mb-4 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">7. Do Inadimplemento</h3>
          <p className="mb-2">7.1. O atraso no pagamento de qualquer parcela sujeitará o(a) COMPRADOR(A) ao pagamento de multa moratória de 2% (dois por cento) sobre o valor devido, acrescida de juros de mora de 1% (um por cento) ao mês, além de correção monetária pelo IPCA/IBGE.</p>
          <p className="mb-2">7.2. Nas hipóteses de venda a prazo com reserva de domínio, o inadimplemento por período superior a 30 (trinta) dias faculta à VENDEDORA a rescisão do Contrato e a retomada do bem, respeitados os procedimentos legais aplicáveis, sem prejuízo do direito à indenização por perdas e danos comprovados.</p>
        </section>

        {/* 8. Contratação eletrônica */}
        <section className="mb-4 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">8. Da Validade da Contratação Eletrônica</h3>
          <p className="mb-2">8.1. As partes reconhecem a validade jurídica da contratação por meio eletrônico, incluindo a autenticidade das assinaturas e a integridade deste instrumento, ainda que firmado por certificação eletrônica fora do padrão ICP-Brasil (ex.: DocuSign, ZapSign, ClickSign ou similar), nos termos do art. 10, §2º, da Medida Provisória nº 2.200-2/2001.</p>
        </section>

        {/* 9. Disposições Gerais */}
        <section className="mb-4 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">9. Disposições Gerais</h3>
          <p className="mb-1">9.1. A tolerância de qualquer das partes quanto ao descumprimento de obrigações não importará novação, precedente ou alteração deste Contrato.</p>
          <p className="mb-1">9.2. Qualquer alteração ou aditamento a este Contrato somente será válido se formalizado por escrito e assinado por ambas as partes.</p>
          <p className="mb-1">9.3. As partes declaram ter lido e compreendido integralmente este Contrato, dele tendo pleno conhecimento e concordância.</p>
        </section>

        {/* 10. Foro */}
        <section className="mb-6 text-justify">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">10. Do Foro</h3>
          <p className="mb-1">10.1. Fica eleito o foro da comarca de {EMPRESA.cidade}/{EMPRESA.uf} para dirimir quaisquer controvérsias oriundas deste Contrato.</p>
          <p className="mt-3">E por estarem assim justas e contratadas, as partes firmam o presente instrumento, em formato físico ou eletrônico, para que produza seus jurídicos e legais efeitos.</p>
        </section>

        {/* Assinaturas */}
        <section className="mt-12">
          <p className="text-center mb-10">{EMPRESA.cidade}/{EMPRESA.uf}, {dia} de {mesExtenso} de {ano}.</p>

          <div className="grid grid-cols-1 gap-10">
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-32">
                <p className="font-bold text-xs">VENDEDORA — {EMPRESA.razaoSocial}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-32">
                <p className="font-bold text-xs">COMPRADOR(A) {cliente?.nome ? `— ${cliente.nome.toUpperCase()}` : ""}</p>
                {cliente?.cpf_cnpj && <p className="text-[10px] text-gray-600">CPF/CNPJ: {cliente.cpf_cnpj}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-16 mt-6">
              <div className="text-center">
                <div className="border-t border-black pt-2 mx-4">
                  <p className="font-bold text-xs">TESTEMUNHA 1</p>
                  <p className="text-[10px] text-gray-600">CPF: ________________________</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-black pt-2 mx-4">
                  <p className="font-bold text-xs">TESTEMUNHA 2</p>
                  <p className="text-[10px] text-gray-600">CPF: ________________________</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
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
    </div>
  );
}
