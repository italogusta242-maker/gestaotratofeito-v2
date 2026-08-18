import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { enderecoCompleto, formatBRL, parseDateLocal } from "@/lib/format";
import { EMPRESA } from "@/lib/empresa";
import { fetchPixEmpresa } from "@/lib/pix";
import logoTratoFeito from "@/assets/logo-trato-feito.png";
import type { Veiculo, Cliente, Transacao, ChavePix } from "@/lib/db-types";

export default function ContratoRepasse() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [comprador, setComprador] = useState<Cliente | null>(null);
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
        setComprador(c);
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

  if (loading) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  if (!veiculo) return <div className="flex items-center justify-center min-h-screen">Veículo não encontrado.</div>;

  const hoje = new Date();
  const dia = format(hoje, "dd");
  const mesExtenso = format(hoje, "MMMM", { locale: ptBR });
  const ano = format(hoje, "yyyy");
  const anoDisplay = veiculo.ano_modelo && veiculo.ano_modelo !== veiculo.ano ? `${veiculo.ano}/${veiculo.ano_modelo}` : veiculo.ano;

  const totalNegociacao = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  // Sempre exibe pelo menos 3 linhas no quadro de pagamentos, mesmo se não houver.
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
          <p className="text-xs font-semibold uppercase">{EMPRESA.razaoSocial}</p>
          <p className="text-[10px] text-gray-600">CNPJ: {EMPRESA.cnpj} — {EMPRESA.enderecoCompleto}</p>
          <hr className="my-3 border-black" />
          <h1 className="text-base font-bold uppercase tracking-wide">CONTRATO PARTICULAR DE VENDA/REPASSE DE VEÍCULO</h1>
          <p className="text-xs italic mt-1">(MODELO DE ADESÃO — REPASSE COMERCIAL ENTRE AS PARTES)</p>
        </div>

        {/* 1. Partes Contratantes */}
        <section className="mb-4">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">1. Partes Contratantes</h3>

          <div className="mb-4 text-justify">
            <p><strong>CONTRATADA / REPASSADORA:</strong> {EMPRESA.razaoSocial}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {EMPRESA.cnpj}, com sede na {EMPRESA.endereco}, CEP {EMPRESA.cep}, doravante denominada simplesmente "CONTRATADA".</p>
          </div>

          <div className="mb-4 text-justify">
            <p><strong>CONTRATANTE / COMPRADORA:</strong> adiante qualificada, adquirente do(s) veículo(s) objeto deste instrumento para fins de revenda comercial, doravante denominada simplesmente "CONTRATANTE".</p>
          </div>

          <div className="border border-black p-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="col-span-2"><span className="font-semibold">Nome / Razão Social:</span> {comprador?.nome ?? "____________________________________________"}</div>
            <div><span className="font-semibold">CNPJ/CPF:</span> {comprador?.cpf_cnpj ?? "____________________"}</div>
            <div><span className="font-semibold">Telefone:</span> {comprador?.telefone ?? "____________________"}</div>
            <div className="col-span-2"><span className="font-semibold">Endereço:</span> {enderecoCompleto(comprador) || "________________________________________________________________"}</div>
            <div className="col-span-2"><span className="font-semibold">E-mail:</span> {comprador?.email ?? "________________________________________"}</div>
          </div>

          <p className="mt-3 text-justify">As partes acima qualificadas têm entre si justo e acordado o presente <strong>CONTRATO PARTICULAR DE VENDA/REPASSE DE VEÍCULO</strong> ("Contrato"), que se regerá pelas cláusulas seguintes.</p>
        </section>

        {/* Dados do Veículo */}
        <section className="mb-4">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-3">Dados do Veículo Objeto do Repasse</h3>
          <div className="border border-black p-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <div><span className="font-semibold">Marca/Modelo:</span> {veiculo.marca_modelo}</div>
            <div><span className="font-semibold">Ano/Mod:</span> {anoDisplay}</div>
            <div><span className="font-semibold">Placa:</span> {veiculo.placa}</div>
            <div><span className="font-semibold">Renavam:</span> {veiculo.renavam ?? "_______________"}</div>
            <div className="col-span-2"><span className="font-semibold">Chassi:</span> {veiculo.chassi ?? "_______________________________"}</div>
            <div><span className="font-semibold">Cor:</span> {veiculo.cor ?? "_______________"}</div>
            <div><span className="font-semibold">Combustível:</span> {veiculo.combustivel ?? "_______________"}</div>
            <div><span className="font-semibold">KM:</span> {veiculo.quilometragem != null ? `${veiculo.quilometragem.toLocaleString("pt-BR")}` : "_______________"}</div>
            <div><span className="font-semibold">Espécie:</span> {veiculo.especie ?? "_______________"}</div>
          </div>
        </section>

        {/* Cláusula 1 - Objeto */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 1 – Do Objeto</h4>
          <p>1.1. O presente Contrato tem por objeto a venda/repasse, pela CONTRATADA à CONTRATANTE, do veículo acima identificado, nas condições de preço, prazo e responsabilidades fixadas neste instrumento.</p>
        </section>

        {/* Cláusula 2 - Preço e Forma de Pagamento */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 2 – Do Preço e Forma de Pagamento</h4>
          <p className="mb-2">2.1. O preço do veículo e a forma de pagamento estão descritos no quadro abaixo, o qual integra este Contrato para todos os fins.</p>

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

          <p className="mb-2">2.2. O pagamento poderá ser realizado mediante <strong>PIX</strong>, em conta de titularidade da CONTRATADA, <strong>CHAVE ({pixEmpresa?.tipo ?? "____"}): {pixEmpresa?.chave ?? "_______________________________"}</strong>, sendo obrigatória a apresentação do respectivo comprovante pela CONTRATANTE.</p>
          <p className="mb-2">2.3. É expressamente vedada a realização de qualquer pagamento diretamente a colaboradores, prepostos ou terceiros não indicados formalmente pela CONTRATADA, sob pena de o pagamento não ser reconhecido como quitação da obrigação.</p>
          <p className="mb-2">2.4. O inadimplemento, pela CONTRATANTE, de qualquer obrigação financeira prevista neste Contrato ou em contratos anteriores firmados entre as partes constituirá, de pleno direito, imediata resilição contratual, sujeitando o CONTRATANTE INADIMPLENTE ao pagamento das despesas e prejuízos que essa mora deu causa, autorizando a CONTRATADA INOCENTE a retenção de parte dos valores recebidos para liquidação dos débitos.</p>
        </section>

        {/* Cláusula 3 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 3 – Da Venda Condicionada, Reserva de Domínio e Transferência de Propriedade</h4>
          <p className="mb-2">3.1. A venda de que trata este Contrato é realizada de forma expressamente <strong>CONDICIONADA</strong> à comprovação do integral pagamento do preço, nos termos, forma e prazos indicados na Cláusula 2.</p>
          <p className="mb-2">3.2. Cumpridas as obrigações de pagamento, a CONTRATADA entregará à CONTRATANTE o Documento Único de Transferência (DUT/CRV), devidamente preenchido e assinado, ou procuração para fins de transferência, restando ao CONTRATANTE efetivar a transferência do automotor no prazo máximo de 10 (dez) dias úteis contados da comprovação do pagamento integral.</p>
          <p className="mb-2">3.3. Caso o CONTRATANTE não promova a transferência do automotor, de modo a retirar o veículo adquirido da titularidade anterior, a CONTRATADA resta desde já autorizada a ajuizar demanda judicial – às expensas do CONTRATANTE (o que inclui custas processuais e honorários advocatícios que desde já se arbitra no valor equivalente a 20% do valor da causa) para promover a transferência forçada do automotor.</p>
        </section>

        {/* Cláusula 4 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 4 – Da Condição do Veículo, Ausência de Garantia e Aceite Irretratável</h4>
          <p className="mb-2">4.1. A CONTRATANTE declara que examinou previamente o veículo, aceitando-o de maneira irretratável e irrevogável, no estado em que se encontra, pelo preço avençado, com pleno conhecimento de que se trata de veículo usado, nos termos das fotos, vídeos e/ou vistoria disponibilizados, nada podendo reclamar posteriormente quanto às condições estéticas ou mecânicas do bem.</p>
          <p className="mb-2">4.2. A venda é realizada sem garantia de qualquer espécie e sem direito de arrependimento, não respondendo a CONTRATADA por vícios aparentes ou ocultos, ressalvada a hipótese de a CONTRATADA ter silenciado, de má-fé, sobre defeito grave e comprovadamente de seu conhecimento prévio, que deveria ter sido informado à CONTRATANTE.</p>
          <p className="mb-2">4.3. A CONTRATANTE reconhece que a presente contratação tem finalidade exclusivamente comercial — repasse do veículo a terceiros, empresários ou comerciantes do ramo automotivo —, o que afasta, para todos os fins, a incidência do Código de Defesa do Consumidor, regendo-se a relação entre as partes pela legislação civil e comercial. A CONTRATADA manifesta desde já que não teria interesse em contratar caso o veículo fosse destinado a uso particular/consumidor final, hipótese que, se verificada, será interpretada como quebra contratual por culpa exclusiva da CONTRATANTE, sujeitando-a às penalidades da Cláusula 10.</p>
        </section>

        {/* Cláusula 5 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 5 – Da Proteção Financeira (Chargeback e Contestações)</h4>
          <p className="mb-2">5.1. Em caso de contestação bancária, chargeback, sustação, bloqueio ou estorno de qualquer valor pago após a entrega do veículo, a CONTRATANTE reconhece a dívida correspondente como líquida, certa e exigível, autorizando desde já a cobrança judicial imediata, acrescida de multa de 10% (dez por cento) e honorários advocatícios de 20% (vinte por cento).</p>
        </section>

        {/* Cláusula 6 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 6 – Das Obrigações da Contratante</h4>
          <p className="mb-1">Sem prejuízo de outras obrigações previstas neste Contrato, a CONTRATANTE obriga-se a:</p>
          <p className="mb-1">6.1. (a) retirar o veículo no prazo acordado com a CONTRATADA, assumindo, a partir da data da retirada/entrega, integral responsabilidade civil, penal, ambiental, administrativa e tributária sobre o bem, inclusive multas de trânsito, IPVA, DPVAT, licenciamento, seguros e demais encargos incidentes a partir dessa data;</p>
          <p className="mb-1">6.2. (b) providenciar, às suas expensas, a transferência da propriedade do veículo perante o órgão de trânsito competente no prazo máximo de 10 dias úteis contados da entrega, sob pena de multa pecuniária de 10% (dez por cento) sobre o valor do veículo, sem prejuízo da obrigação de concluir a transferência;</p>
          <p className="mb-1">6.3. (c) não inserir, solicitar, facilitar ou promover, por quaisquer meios, gravames, financiamentos, alienações ou a transferência da posse ou propriedade do veículo a terceiros, a qualquer título, enquanto pendente qualquer obrigação financeira perante a CONTRATADA, sob pena de multa de 20% (vinte por cento) do valor do Contrato, sem prejuízo do vencimento antecipado das obrigações e das perdas e danos cabíveis;</p>
          <p className="mb-1">6.4. (d) manter atualizadas suas informações de contato (e-mail, endereço, telefone) junto à CONTRATADA, para fins de recebimento de comunicações de infrações e demais notificações relacionadas ao veículo;</p>
          <p className="mb-1">6.5. (e) assumir a responsabilidade civil e criminal sobre a utilização do veículo, e por infrações de trânsito, débitos e bloqueios identificados após a retirada do veículo, ainda que a transferência não tenha sido concluída, isentando a CONTRATADA de qualquer responsabilidade e/ou pagamento decorrente de inconsistência de dados para preenchimento do CRV/DUT ou de atraso na sua retirada.</p>
        </section>

        {/* Cláusula 7 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 7 – Das Obrigações da Contratada</h4>
          <p className="mb-1">Sem prejuízo de outras obrigações previstas neste Contrato, a CONTRATADA obriga-se a:</p>
          <p className="mb-1">7.1. (a) informar à CONTRATANTE, previamente à contratação, eventuais débitos, gravames ou restrições de que tenha conhecimento e que recaiam sobre o veículo;</p>
          <p className="mb-1">7.2. (b) entregar à CONTRATANTE o Documento Único de Transferência (DUT/CRV) devidamente preenchido e assinado, no prazo previsto na Cláusula 3.3, condicionado à comprovação do pagamento integral do preço.</p>
        </section>

        {/* Cláusula 8 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 8 – Do Inadimplemento, Mora e Rescisão Contratual</h4>
          <p className="mb-1">8.1. O descumprimento de qualquer obrigação, pecuniária ou não pecuniária, pela CONTRATANTE, implicará o encerramento imediato deste Contrato, de pleno direito, independentemente de notificação, interpelação, protesto judicial ou extrajudicial, obrigando a CONTRATANTE a restituir o veículo (ou seu valor equivalente de mercado) à CONTRATADA no prazo de 2 (dois) dias contados da rescisão, sob pena de multa compensatória de 10% (dez por cento) do valor total do preço, caso o veículo não seja restituído em até 10 (dez) dias da rescisão.</p>
          <p className="mb-1">8.2. Em caso de rescisão com descumprimento voluntário da restituição, a posse do veículo pela CONTRATANTE será considerada injusta e ilegítima, caracterizando apropriação indébita, sujeitando-a às penalidades legais cabíveis, inclusive de natureza penal, autorizando a CONTRATADA a proceder à imediata retomada do bem, sem prejuízo de multa compensatória de 10% (dez por cento) do valor do Contrato, calculada pro rata die até a efetiva devolução.</p>
          <p className="mb-1">8.3. O inadimplemento de qualquer obrigação contratual poderá, a critério da CONTRATADA, tornar antecipada e imediatamente exigível qualquer outra obrigação pendente entre as partes, inclusive relativa a outros contratos vigentes entre elas.</p>
        </section>

        {/* Cláusula 9 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 9 – Da Irrevogabilidade e da Multa Contratual</h4>
          <p className="mb-1">9.1. O presente Contrato é firmado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e sucessores a qualquer título.</p>
          <p className="mb-1">9.2. O descumprimento de qualquer cláusula deste Contrato, que der causa à sua resilição, implicará, à parte que deu causa, multa contratual de 10% (dez por cento) sobre o valor total da negociação, sem prejuízo de perdas e danos e do ressarcimento de despesas comprovadamente incorridas (reparo, transporte, armazenagem do veículo, entre outras).</p>
        </section>

        {/* Cláusula 10 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 10 – Da Validade da Contratação Eletrônica</h4>
          <p className="mb-1">10.1. As partes reconhecem a validade jurídica da contratação por meio eletrônico, incluindo a autenticidade das respectivas assinaturas e a integridade deste instrumento, ainda que firmado por meio de certificação eletrônica fora do padrão ICP-Brasil (ex.: DocuSign, ZapSign, ClickSign ou similar), nos termos do art. 10, §2º, da Medida Provisória nº 2.200-2/2001, constituindo este Contrato título executivo extrajudicial para todos os fins de direito.</p>
        </section>

        {/* Cláusula 11 */}
        <section className="mb-4 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 11 – Das Disposições Gerais</h4>
          <p className="mb-1">11.1. A tolerância de qualquer das partes quanto ao descumprimento de obrigações aqui previstas não importará novação, precedente ou alteração deste Contrato, sendo considerada mera liberalidade.</p>
          <p className="mb-1">11.2. Qualquer alteração, modificação ou aditamento a este Contrato somente será válido se formalizado por escrito e assinado por ambas as partes.</p>
          <p className="mb-1">11.3. Este instrumento representa a integralidade do entendimento entre as partes quanto ao seu objeto, substituindo quaisquer entendimentos verbais ou escritos anteriores sobre a mesma matéria.</p>
          <p className="mb-1">11.4. As partes declaram ter lido e compreendido integralmente este Contrato, dele tendo pleno conhecimento e concordância, inexistindo qualquer vício de consentimento, coação, estado de perigo ou lesão, nos termos dos arts. 151, 156 e 157 do Código Civil.</p>
        </section>

        {/* Cláusula 12 */}
        <section className="mb-6 text-justify">
          <h4 className="font-bold text-sm uppercase mb-2">Cláusula 12 – Do Foro</h4>
          <p className="mb-1">12.1. Fica eleito o foro da comarca de {EMPRESA.cidade}/{EMPRESA.uf} para dirimir quaisquer controvérsias oriundas deste Contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
          <p className="mt-3">E por estarem assim justas e contratadas, as partes firmam o presente instrumento, em formato físico ou eletrônico, para que produza seus jurídicos e legais efeitos.</p>
        </section>

        {/* Assinaturas */}
        <section className="mt-12">
          <p className="text-center mb-10">{EMPRESA.cidade}/{EMPRESA.uf}, {dia} de {mesExtenso} de {ano}.</p>

          <div className="grid grid-cols-1 gap-10">
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-32">
                <p className="font-bold text-xs">CONTRATADA — {EMPRESA.razaoSocial}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-32">
                <p className="font-bold text-xs">CONTRATANTE {comprador?.nome ? `— ${comprador.nome.toUpperCase()}` : ""}</p>
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
