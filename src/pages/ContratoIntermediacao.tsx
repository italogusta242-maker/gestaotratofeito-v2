import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logo from "@/assets/logo-trato-feito.png";
import { EMPRESA } from "@/lib/empresa";
import { fetchPixEmpresa } from "@/lib/pix";
import { formatBRL } from "@/lib/format";
import type { Veiculo, Cliente, ChavePix, Transacao } from "@/lib/db-types";

/**
 * Reconhece se uma dedução é "Saldo de Quitação" (que vai numa linha
 * específica da tabela do contrato — não entra em Débitos).
 */
function ehQuitacao(t: Transacao): boolean {
  return /quita/i.test(t.descricao ?? "");
}

/**
 * Reconhece débito de órgão público (IPVA, multas, licenciamento) —
 * pode vir tanto pela categoria antiga quanto pela descrição da dedução
 * unificada nova.
 */
function ehDebitoOrgao(t: Transacao): boolean {
  const cat = t.categoria ?? "";
  if (cat === "IPVA" || cat === "Multas" || cat === "Licenciamento") return true;
  return /ipva|multa|licenciam/i.test(t.descricao ?? "");
}

export default function ContratoIntermediacao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pixEmpresa, setPixEmpresa] = useState<ChavePix | null>(null);
  const [despesas, setDespesas] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: v } = await supabase.from("veiculos").select("*").eq("id", id).single();
      setVeiculo(v);
      if (v?.cliente_compra_id) {
        const { data: c } = await supabase.from("clientes").select("*").eq("id", v.cliente_compra_id).single();
        setCliente(c);
      }
      const { data: txs } = await supabase
        .from("transacoes")
        .select("*")
        .eq("veiculo_id", id)
        .eq("tipo", "Despesa")
        .in("categoria", ["Dedução", "IPVA", "Multas", "Licenciamento", "Despesa de Veículo"]);
      setDespesas(txs ?? []);
      setPixEmpresa(await fetchPixEmpresa());
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  if (!veiculo) return <div className="flex items-center justify-center min-h-screen">Veículo não encontrado.</div>;

  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const anoDisplay = veiculo.ano_modelo && veiculo.ano_modelo !== veiculo.ano ? `${veiculo.ano}/${veiculo.ano_modelo}` : veiculo.ano;

  // Cálculo dos valores da tabela de negociação. Segue o mesmo modelo do
  // Contrato de Compra pra não divergir de significado entre documentos:
  //   1. Valor bruto = valor de aquisição cadastrado no veículo.
  //   2. Quitação = deduções com descrição "Saldo de Quitação".
  //   3. Débitos = IPVA + Multas + Licenciamento (categoria antiga ou descrição).
  //   4. Total de deduções = soma de tudo que abate o valor bruto.
  //   5. Líquido = bruto − total de deduções.
  const valorBruto = Number(veiculo.valor_aquisicao ?? 0);
  const totalQuitacao = despesas.filter(ehQuitacao).reduce((s, d) => s + Number(d.valor), 0);
  const totalDebitos = despesas.filter((d) => !ehQuitacao(d) && ehDebitoOrgao(d)).reduce((s, d) => s + Number(d.valor), 0);
  const totalDeducoes = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const valorLiquido = valorBruto - totalDeducoes;

  const nome = cliente?.nome ?? "___________________________________";
  const cpfCnpj = cliente?.cpf_cnpj ?? "___________________";
  const rg = cliente?.rg ?? "___________________";
  const endereco = cliente?.endereco ?? "___________________________________________________";
  const telefone = cliente?.telefone ?? "___________________";
  const email = cliente?.email ?? "___________________";
  const cidade = (cliente?.cidade ?? EMPRESA.cidade).toUpperCase();
  const estado = (cliente?.uf ?? EMPRESA.uf).toUpperCase();
  const bairro = cliente?.bairro ?? "_______________";
  const cep = cliente?.cep ?? "_______________";

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

      <div className="max-w-[210mm] mx-auto px-10 py-8 print:px-[15mm] print:py-[10mm] print:max-w-none" style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "11px", lineHeight: 1.5 }}>

        {/* Cabeçalho com logo */}
        <div className="text-center mb-6">
          <img src={logo} alt="Trato Feito Seminovos" className="mx-auto h-16 mb-2" />
          <h1 className="text-sm font-bold uppercase tracking-wide mt-4">INSTRUMENTO PARTICULAR DE INTERMEDIAÇÃO DE VEÍCULOS</h1>
        </div>

        {/* CONTRATANTE */}
        <section className="mb-4">
          <h3 className="font-bold text-xs uppercase mb-2">CONTRATANTE:</h3>
          <table className="w-full border-collapse border border-black text-[10px]">
            <tbody>
              <tr>
                <td className="border border-black p-1" colSpan={3}><strong>Nome ou razão social:</strong> {nome}</td>
              </tr>
              <tr>
                <td className="border border-black p-1"><strong>Cidade:</strong> {cidade}</td>
                <td className="border border-black p-1"><strong>Estado:</strong> {estado}</td>
                <td className="border border-black p-1"><strong>CEP:</strong> {cep}</td>
              </tr>
              <tr>
                <td className="border border-black p-1" colSpan={2}><strong>Endereço:</strong> {endereco}</td>
                <td className="border border-black p-1"><strong>Bairro:</strong> {bairro}</td>
              </tr>
              <tr>
                <td className="border border-black p-1" colSpan={2}><strong>CPF ou CNPJ:</strong> {cpfCnpj}</td>
                <td className="border border-black p-1"><strong>RG ou Inscrição:</strong> {rg}</td>
              </tr>
              <tr>
                <td className="border border-black p-1"><strong>Contato:</strong> {telefone}</td>
                <td className="border border-black p-1" colSpan={2}><strong>E-mail:</strong> {email}</td>
              </tr>
              <tr>
                <td className="border border-black p-1" rowSpan={2}>
                  <strong>Representante Legal:</strong><br />
                  [ &nbsp; ] Sim<br />
                  [ &nbsp; ] Não se aplica
                </td>
                <td className="border border-black p-1" colSpan={2}>
                  <strong>Espécie de representante:</strong><br />
                  [ &nbsp; ] Administrador &nbsp;&nbsp; [ &nbsp; ] Procurador<br />
                  [ &nbsp; ] Curador &nbsp;&nbsp; [ &nbsp; ] Inventariante<br />
                  [ &nbsp; ] Outros: _______________
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1" colSpan={2}><strong>Nome do representante legal:</strong> ___________________________________</td>
              </tr>
              <tr>
                <td className="border border-black p-1"><strong>Cidade:</strong></td>
                <td className="border border-black p-1"><strong>Estado:</strong></td>
                <td className="border border-black p-1"><strong>CEP:</strong></td>
              </tr>
              <tr>
                <td className="border border-black p-1" colSpan={2}><strong>Endereço:</strong></td>
                <td className="border border-black p-1"><strong>Bairro:</strong></td>
              </tr>
              <tr>
                <td className="border border-black p-1"><strong>CPF:</strong></td>
                <td className="border border-black p-1"><strong>RG:</strong></td>
                <td className="border border-black p-1"><strong>E-mail:</strong></td>
              </tr>
              <tr>
                <td className="border border-black p-1" colSpan={3}><strong>Contato:</strong></td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* CONTRATADA */}
        <section className="mb-4">
          <h3 className="font-bold text-xs uppercase mb-2">CONTRATADA:</h3>
          <p>{EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}, {EMPRESA.enderecoCompleto}.</p>
        </section>

        {/* DADOS DO VEÍCULO */}
        <section className="mb-4">
          <h3 className="font-bold text-xs uppercase mb-2">DADOS DO VEÍCULO:</h3>
          <table className="w-full border-collapse border border-black text-[10px]">
            <tbody>
              <tr><td className="border border-black p-1"><strong>RENAVAM:</strong> {veiculo.renavam ?? "_______________"}</td></tr>
              <tr><td className="border border-black p-1"><strong>NOME:</strong> {nome}</td></tr>
              <tr><td className="border border-black p-1"><strong>CPF/CNPJ:</strong> {cpfCnpj}</td></tr>
              <tr><td className="border border-black p-1"><strong>PLACA:</strong> {veiculo.placa}</td></tr>
              <tr><td className="border border-black p-1"><strong>CHASSI:</strong> {veiculo.chassi ?? "_______________"}</td></tr>
              <tr><td className="border border-black p-1"><strong>ESPÉCIE/TIPO:</strong> {veiculo.especie ?? "_______________"}</td></tr>
              <tr><td className="border border-black p-1"><strong>MARCA/MODELO:</strong> {veiculo.marca_modelo}</td></tr>
              <tr><td className="border border-black p-1"><strong>ANO/MODELO:</strong> {anoDisplay}</td></tr>
              <tr><td className="border border-black p-1"><strong>KM:</strong> {veiculo.quilometragem != null ? veiculo.quilometragem.toLocaleString("pt-BR") : "_______________"}</td></tr>
              <tr><td className="border border-black p-1"><strong>CATEGORIA:</strong> {veiculo.categoria ?? "_______________"}</td></tr>
              <tr><td className="border border-black p-1"><strong>COR PREDOMINANTE:</strong> {veiculo.cor ?? "_______________"}</td></tr>
              <tr><td className="border border-black p-1"><strong>COMBUSTÍVEL:</strong> {veiculo.combustivel ?? "_______________"}</td></tr>
              <tr><td className="border border-black p-1"><strong>ALIENAÇÃO FIDUCIÁRIA:</strong> {veiculo.alienacao_fiduciaria ?? "_______________"}</td></tr>
              <tr><td className="border border-black p-1"><strong>SITUAÇÃO:</strong> {veiculo.status}</td></tr>
              <tr><td className="border border-black p-1"><strong>CIDADE/UF:</strong> BRASÍLIA/DF</td></tr>
            </tbody>
          </table>
        </section>

        {/* Corpo do contrato */}
        <div className="text-justify space-y-3 text-[11px]">
          <p>Pelo presente instrumento particular de contrato de intermediação de negócios as partes acima qualificadas têm entre si justo e acertado o seguinte.</p>

          <h3 className="font-bold text-xs uppercase mt-4">Das Declarações Iniciais</h3>
          <p>1. A parte CONTRATANTE declara, sob as penas da lei, que é legalmente a proprietária e responsável pelo veículo, sendo de sua inteira responsabilidade as informações repassadas a CONTRATADA, detendo todas as autorizações necessárias para realizar sua venda.</p>
          <p>1.2. A parte CONTRATANTE declara, sob sua responsabilidade, que o veículo objeto deste contrato encontra-se livre de quaisquer ônus, seja judicial ou extrajudicial, com exceção de eventuais débitos expressamente ressalvados abaixo.</p>

          <h3 className="font-bold text-xs uppercase mt-4">Da Negociação</h3>
          <p>2. Pelo presente instrumento, a parte CONTRATANTE aceita, em caráter irrevogável e irretratável, a proposta de compra do seu veículo, intermediado pela CONTRATADA, no VALOR LÍQUIDO DE PROPOSTA DE COMPRA a seguir descrito, declarando estar ciente e de acordo de todas as deduções incidentes sobre o aludido preço, conforme demonstrativo abaixo:</p>

          <table className="w-full border-collapse border border-black text-[10px] my-2">
            <tbody>
              <tr>
                <td className="border border-black p-1">1. VALOR BRUTO DO VEÍCULO:</td>
                <td className="border border-black p-1 w-32">{formatBRL(valorBruto)}</td>
              </tr>
              <tr>
                <td className="border border-black p-1">2. VALOR DEVIDO PARA QUITAÇÃO:</td>
                <td className="border border-black p-1">{formatBRL(totalQuitacao)}</td>
              </tr>
              <tr>
                <td className="border border-black p-1">3. DÉBITOS (IPVA/MULTA/LICENCIAMENTO):</td>
                <td className="border border-black p-1">{formatBRL(totalDebitos)}</td>
              </tr>
              <tr>
                <td className="border border-black p-1">4. VALOR TOTAL DAS DEDUÇÕES:</td>
                <td className="border border-black p-1">{formatBRL(totalDeducoes)}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">5. VALOR LÍQUIDO DE PROPOSTA DE COMPRA:</td>
                <td className="border border-black p-1 font-bold">{formatBRL(valorLiquido)}</td>
              </tr>
            </tbody>
          </table>

          {/* Detalhamento das deduções — quando existem, o comprador enxerga
              linha a linha o que compõe o total. Sem isso a tabela acima
              mostra só o agregado e o CONTRATANTE fica sem transparência. */}
          {despesas.length > 0 && (
            <table className="w-full border-collapse border border-black text-[10px] my-2">
              <tbody>
                <tr>
                  <td className="border border-black p-1 font-bold bg-gray-100" colSpan={2}>
                    DETALHAMENTO DAS DEDUÇÕES
                  </td>
                </tr>
                {despesas.map((d, i) => (
                  <tr key={d.id}>
                    <td className="border border-black p-1">
                      {String(i + 1).padStart(2, "0")}. {d.descricao || "Dedução"}
                    </td>
                    <td className="border border-black p-1 w-32">{formatBRL(Number(d.valor))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="font-bold text-xs uppercase mt-4">Do Pagamento</h3>
          <p>3. A parte CONTRATANTE autoriza e solicita o pagamento do VALOR LÍQUIDO DE PROPOSTA DE COMPRA para a conta bancária abaixo indicada, sendo de sua exclusiva responsabilidade os dados informados:</p>

          <table className="w-full border-collapse border border-black text-[10px] my-2">
            <tbody>
              <tr><td className="border border-black p-1 font-bold" colSpan={2}>DADOS PARA PAGAMENTO (PIX)</td></tr>
              <tr><td className="border border-black p-1 w-40">BENEFICIÁRIO(A):</td><td className="border border-black p-1">{cliente?.nome ?? ""}</td></tr>
              <tr><td className="border border-black p-1">CPF/CNPJ:</td><td className="border border-black p-1">{cliente?.cpf_cnpj ?? ""}</td></tr>
              <tr><td className="border border-black p-1">TIPO DA CHAVE PIX:</td><td className="border border-black p-1">{cliente?.chave_pix_tipo ?? ""}</td></tr>
              <tr><td className="border border-black p-1">CHAVE PIX:</td><td className="border border-black p-1">{cliente?.chave_pix ?? ""}</td></tr>
              <tr><td className="border border-black p-1">OBSERVAÇÃO:</td><td className="border border-black p-1">Pagamento realizado exclusivamente via PIX.</td></tr>
              <tr><td className="border border-black p-1 font-bold">VALOR TOTAL:</td><td className="border border-black p-1 font-bold">{formatBRL(valorLiquido)}</td></tr>
            </tbody>
          </table>

          <h3 className="font-bold text-xs uppercase mt-4">Das Obrigações da Contratada</h3>
          <p><strong>4. A CONTRATADA obriga-se a:</strong></p>
          <p>a) receber do comprador o valor correspondente à negociação do bem, assim como realizar o repasse do valor à parte CONTRATANTE, nos moldes deste contrato, por meio de um único depósito na conta bancária de titularidade da parte CONTRATANTE ou de terceiro por ela indicada acima;</p>
          <p>b) entregar, após o respectivo preenchimento e a assinatura, a cópia documento único de transferência – DUT, para que a parte CONTRATANTE possa realizar, se desejar, a comunicação de venda, bem como para fins contábeis, estando ciente de que o valor constante daquele documento corresponderá ao valor negociado pelo adquirente ao seu consumidor final. O envio do referido documento dar-se-á por meio de correspondência eletrônica (e-mail) ou por uso de sistema mensageiro eletrônico (WhatsApp, Telegram, Signal, etc.) vinculado ao telefone indicado no preâmbulo;</p>
          <p>c) efetuar a entrega do bem ao respectivo comprador.</p>
          <p><strong>4.1.</strong> A parte CONTRATANTE está ciente de que, na hipótese de o veículo conter quaisquer gravames, o pagamento será realizado somente após a(s) baixa(s) do(s) gravame(s) no órgão de trânsito.</p>
          <p><strong>4.2.</strong> Em caráter excepcional, poderá a CONTRATADA antecipar total ou parcialmente o repasse do preço, mediante o pagamento direto ao credor fiduciário, ao arrendador mercantil, ao consórcio ou a qualquer outro credor que conste do registro do veículo junto ao órgão de trânsito ou em processo judicial que tenha gerado bloqueio RENAJUD, inclusive multas de trânsito, impostos, taxas, seguros obrigatórios e demais despesas propter rem.</p>

          <h3 className="font-bold text-xs uppercase mt-4">Das Obrigações da CONTRATANTE</h3>
          <p><strong>5. A parte CONTRATANTE obriga-se a:</strong></p>
          <p>a) informar a existência de qualquer falha, defeito ou desgaste existente no veículo, ainda que não aparente, sob pena de responsabilização futura pelos defeitos presentes ou futuros, visíveis ou ocultos. Abaixo seguem as falha, defeitos ou desgastes existentes no veículo:</p>

          <table className="w-full border-collapse border border-black text-[10px] my-2">
            <tbody>
              {[1,2,3,4,5,6,7,8].map(i => (
                <tr key={i}><td className="border border-black p-1">{i}.</td></tr>
              ))}
            </tbody>
          </table>

          <p>b) responsabilizar-se pelos reparos/consertos dos defeitos ou vícios não informados acima, visíveis ou ocultos. A CONTRATADA, identificando problemas no veículo não informados acima, poderá repará-los na oficina de sua confiança que serão pagos ou indenizados pelo CONTRATANTE;</p>
          <p>c) não retirar o veículo do estabelecimento da CONTRATADA, após a realização da perícia cautelar;</p>
          <p>d) apresentar os documentos necessários para circulação e transferência do veículo;</p>
          <p>e) outorgar procuração, por instrumento público ou particular com firma reconhecida, conforme exigido pelo Detran local, aos prepostos da CONTRATADA, às suas expensas, ciente que o veículo será vendido a um lojista, o qual poderá fazer a transferência do bem diretamente para o seu cliente final, sem prazo específico para tanto;</p>
          <p>f) arcar com o custo de perícia cautelar por empresa indicada pela CONTRATADA, no valor constante da tabela prevista neste instrumento, que poderá ser deduzido do valor a ser recebido pela venda do veículo caso concluído do negócio e aprovado o veículo perante a referida empresa;</p>
          <p>g) responsabilizar-se por quaisquer danos, inclusive, contra terceiros, multas, infrações, tributos, taxas, seguros contratuais e obrigatórios, além de outros encargos incidentes sobre o veículo, cujo fato gerador tenha ocorrido até a momento exato da entrega, os quais poderão ser pagos pela CONTRATADA e deduzidos do valor a ser recebido pela venda do veículo; Caso a CONTRATADA e/ou o comprador venham a ser responsabilizados ou demandados judicialmente por fatos jurídicos de responsabilidade da CONTRATANTE, ficam autorizado a proceder à denunciação da lide desta.</p>
          <p>h) caso a CONTRATADA ou o comprador do veículo venha a ser compelido a pagar qualquer despesa relacionada na alínea anterior, reserva-se no direito de pagar diretamente aos credores, sub-rogando-se no direito de compensar com os valores devidos ou cobrar da parte CONTRATANTE todos os valores eventualmente pagos, inclusive encargos moratórios, remuneratórios, custas processuais, honorários advocatícios e qualquer outra despesa que decorra do inadimplemento, com acréscimo de correção monetária pelo IPCA-E/IBGE, juros de mora de 1% (um por cento) ao mês desde o efetivo pagamento, multa de 2% (dois por cento) e honorários de 10% (dez por cento) sem prejuízo de promover a negativação e/ou protesto do título a ser emitido e encaminhado à CONTRATANTE, com vencimento em até 5 (cinco) dias úteis após a ciência do débito;</p>
          <p>i) a parte CONTRATANTE suportará também as infrações de trânsito que estiverem com defesa ou recurso pendente de julgamento, as quais serão reembolsadas pela CONTRATADA em caso de se obter êxito no julgamento do processo administrativo, em até 15 (quinze) dias úteis após a solicitação de reembolso, devidamente instruída com a comprovação do resultado favorável.</p>
          <p>j) fornecer à CONTRATADA todas as informações, condições e documentos para que a esta possa consultar junto às instituições financeiras acerca de possíveis financiamentos e alienações do veículo, responsabilizando-se pessoalmente pela regular emissão dos boletos de quitação junto à instituição credora.</p>
          <p>l) a entregar todos os documentos necessários para a transferência veicular, nos moldes exigidos pela CONTRATADA, conforme check-list recebido nesta ocasião, no prazo máximo de 24h, sob pena de caracterizar desistência do negócio e incidir multa prevista no item 8.</p>

          <p><strong>5.1.</strong> Para os fins acima, na hipótese de o veículo ter sido adquirido com os benefícios fiscais, a parte CONTRATANTE deverá suportar adicionalmente todos os tributos incidentes, incluindo o IPVA do exercício corrente, se o veículo for excluído do programa de benefícios quando da sua transferência de propriedade.</p>
          <p><strong>5.2.</strong> Se este contrato for celebrado no início do ano, antes do lançamento do IPVA, será deduzido o valor do tributo, calculado segundo os critérios estabelecidos pela respectiva legislação estadual. Caso não se saiba exatamente o valor, o abatimento levará em consideração o valor do tributo no ano anterior, admitindo-se o posterior reembolso, caso seja demonstrado que o desconto foi superior ao devido.</p>
          <p><strong>5.3.</strong> A CONTRATANTE declara estar ciente de que, considerando a natureza do presente contrato, qual seja, de intermediação, não recai sobre a CONTRATADA qualquer responsabilidade em relação à comunicação de venda e futura transferência do veículo aqui transacionado, sendo que, uma vez efetuada a venda do referido bem, caberá à CONTRATADA tão somente informar à CONTRATANTE os dados da pessoa física ou jurídica para quem houve o repasse, cumprindo à CONTRATANTE, portanto, tomar as medidas cabíveis para concretizar a tradição do bem objeto da venda diretamente contra o comprador.</p>
          <p><strong>5.4.</strong> A CONTRATANTE declara expressamente estar ciente de que o recibo de venda do veículo (CRV – Certificado de Registro de Veículo) não poderá ser preenchido em nome da CONTRATADA em qualquer hipótese, uma vez que, como consta no "caput" dessa cláusula, a natureza jurídica contratada é de intermediação. Caso a CONTRATANTE preencha o CRV em nome da CONTRATADA, assumirá integralmente todos os impostos, taxas e valores decorrentes dessa transação, a exemplo, mas não apenas, PIS, COFINS e demais taxas/impostos incidentes sobre o valor de transferência, reconhecendo o caráter executivo deste instrumento neste tocante, podendo referidos valores serem considerados confessos e executados nos moldes do art. 784, III, do Código de Processo Civil, integrante deste instrumento.</p>

          <h3 className="font-bold text-xs uppercase mt-4">Da Cessão do Direito de Voz e Imagem</h3>
          <p><strong>6.</strong> A parte CONTRATANTE autoriza a CONTRATADA, a título universal, em caráter total, definitivo, irrevogável e irretratável, a utilização da sua imagem e voz, para a fixação em sítios eletrônicos, redes sociais, materiais publicitários e promocionais em qualquer tipo de mídia, inclusive impressa, para fins de divulgação da empresa e seus serviços, sem limitação de tempo ou de número de inserções, podendo ocorrer no Brasil e/ou no exterior.</p>

          <h3 className="font-bold text-xs uppercase mt-4">Da Proteção de Dados</h3>
          <p><strong>7.</strong> As partes se comprometem em respeitar a privacidade e a confidencialidade das informações que tomou conhecimento em razão do presente contrato, não divulgando a terceiros, com exceção das hipóteses previstas na lei.</p>
          <p><strong>7.1.</strong> As partes se comprometem a adotar todas as boas práticas de proteção de dados e segurança da informação, tomando as medidas necessárias para prevenção de todos os tipos de ameaças, como perda, vazamento, divulgação ou acessos não autorizados.</p>
          <p><strong>7.2.</strong> A CONTRATADA poderá utilizar os dados pessoais coletados para os seguintes fins: (i) previstos no contrato - Base legal: cumprimento de contrato (art. 7ª, inciso V da LGPD); (ii) apoio estratégico e promoção de sua atividade - Base legal: Legítimo interesse (art. 7º, inciso IX da LGPD); (iii) sua própria defesa em processos judiciais ou administrativos - Base legal: Exercício regular de direitos (art. 7ª, inciso VI da LGPD).</p>
          <p><strong>7.3.</strong> A CONTRATADA poderá compartilhar os dados pessoais coletados com: (i) instituições financeiras, seguradoras, empresas de perícias veiculares, comprador do veículo e entre a rede de franquias da qual faz parte, desde que envolvidas na operação para os fins previstos no contrato; (ii) os agentes comerciais e de marketing subcontratados, para fins de apoio e promoção de sua atividade; (iii) as autoridades competentes e com a justiça, para fins de defesa de seus direitos.</p>

          <h3 className="font-bold text-xs uppercase mt-4">Das Disposições Finais</h3>
          <p><strong>8.</strong> Em caso de impossibilidade presente ou superveniente da transferência do veículo junto ao órgão de trânsito, a CONTRATADA poderá exigir a resolução do negócio, o que ocorrerá de pleno direito, independentemente de decisão judicial, nos termos do artigo 474, do Código Civil, exigindo o pagamento da cláusula penal no importe de 10% (dez por cento) sobre o valor bruto da negociação do veículo, devidamente corrigido monetariamente, sem prejuízo dos pedidos de indenização por eventuais perdas e danos complementares, comprovadamente suportados, neles incluídos reparos e substituições de peças e despesas operacionais.</p>
          <p><strong>8.1.</strong> Na hipótese acima, a CONTRATANTE deverá restituir integralmente os valores pagos pela CONTRATADA, incluindo pagamentos indiretos feitos nos moldes da cláusula 4.2, no prazo de até 10 (dez) dias após sua interpelação acerca da impossibilidade de transferência do veículo, sendo-lhe facultado, dentro do referido prazo, adotar medidas para a realização da transferência. Enquanto não realizada a restituição dos valores, será lícito à CONTRATADA reter a entrega do veículo até o efetivo recebimento, sendo que, nestes casos, não será devida qualquer tipo de indenização à CONTRATANTE pelo uso do veículo.</p>
          <p><strong>9.</strong> Este contrato é firmado em caráter irrevogável e irretratável unilateralmente.</p>
          <p><strong>9.1.</strong> O presente contrato vincula as partes e seus sucessores a qualquer título, ao fiel cumprimento.</p>
          <p><strong>9.2.</strong> Todas as notificações e comunicações exigidas ou permitidas neste contrato deverão ser enviadas por escrito e entregues a cada parte nos endereços físicos, em atenção aos respectivos representantes legais ou por meio de correio eletrônico, no endereço descrito neste contrato, desde que a parte contrária acuse o recebimento.</p>
          <p><strong>9.3.</strong> Constitui obrigação das PARTES encaminharem uma à outra todas as notificações, avisos ou intimações dos Poderes Públicos e/ou de particulares, referentes ao veículo em apreço, que lhes forem entregues, sob pena de responder pelas multas, correção monetária e penalidades decorrentes do atraso no pagamento ou satisfação no cumprimento de determinações por aqueles Poderes ou particulares.</p>
          <p><strong>9.4.</strong> Qualquer tolerância das partes no cumprimento das obrigações assumidas não importará em precedente, novação ou alteração do presente contrato, sendo considerada ato de mera liberalidade.</p>
          <p><strong>9.5.</strong> Qualquer alteração, modificação ou aditamento deste contrato somente será admitido se celebrado por documento escrito, assinado pelas partes.</p>
          <p><strong>9.6.</strong> As partes estão cientes de que este instrumento cancela e substitui integralmente qualquer acordo escrito ou verbal, desta natureza, firmado anteriormente, representando todo o entendimento havido entre as PARTES sobre seu objeto, sobrepondo-se a todo e qualquer ajuste anterior, e nada será a ele incorporado, se não por escrito;</p>
          <p><strong>9.7.</strong> As partes declaram que (i) leram este instrumento em sua íntegra e que a elas foi dada a oportunidade de esclarecer qualquer dispositivo e informação que não tivessem entendido, bem como a possibilidade de consultar um advogado ou outro consultor; (ii) entendem os termos, condições e obrigações deste instrumento, e concordam em estar legalmente submetidas por meio dele; (iii) não se verifica, na presente contratação, qualquer fato ou obrigação que possa vir a ser caracterizada como coação, estado de perigo ou lesão, conforme os arts. 151, 156 e 157 do Código Civil, respectivamente; e (iv) estão cientes de todas as circunstâncias e regras que norteiam o presente Negócio jurídico, e detêm experiência nas atividades que lhe competem por força deste instrumento, para os efeitos do art. 157 do Código Civil Brasileiro; (v) reconhecem a veracidade, autenticidade, integridade, validade e eficácia deste instrumento e seus termos, em formato eletrônico e assinado por meio de certificados eletrônicos, ainda que sejam certificados eletrônicos não emitidos pela ICP-Brasil, conforme o disposto no artigo 10, parágrafo 2º da Medida Provisória nº 2.220-2/2001, como, por exemplo, por meio de upload e existência deste, em plataformas como a DocuSign, AdobeSign, CertiSign, ZapSign ou similar.</p>
          <p><strong>9.8.</strong> E por estarem de acordo com o conteúdo contratual, elegem o foro da comarca do endereço da CONTRATADA qualificado no preâmbulo, para dirimir quaisquer dúvidas, renunciando as partes a qualquer outro, por mais privilegiado que seja.</p>
        </div>

        {/* Assinaturas — bloco inteiro protegido de quebra de página pra
            evitar linha numa folha e rótulo na outra (bug do "legenda ao lado,
            nome acima" reportado). Também protege cada assinatura individual. */}
        <section className="mt-16 assinaturas-bloco">
          <p className="text-center mb-16">BRASÍLIA-DF, {hoje}.</p>
          <div className="grid grid-cols-1 gap-16 mt-12">
            <div className="text-center assinatura-item">
              <div className="border-t border-black pt-2 mx-16">
                <p className="font-bold">CONTRATADA</p>
              </div>
            </div>
            <div className="text-center assinatura-item">
              <div className="border-t border-black pt-2 mx-16">
                <p className="font-bold">CONTRATANTE</p>
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
            @page { margin: 10mm 15mm; }
          }
        `
      }} />
    </div>
  );
}
