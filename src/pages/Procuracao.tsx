import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Procuracao() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const tipo = searchParams.get("tipo") || "Autenticidade";

    const [veiculo, setVeiculo] = useState<any>(null);
    const [outorgante, setOutorgante] = useState<any>(null);

    useEffect(() => {
        if (!id) return;
        supabase.from("veiculos").select("*").eq("id", id).single().then(({ data }) => {
            setVeiculo(data);
            if (data?.cliente_compra_id) {
                supabase.from("clientes").select("*").eq("id", data.cliente_compra_id).single().then(({ data: c }) => setOutorgante(c));
            }
        });
    }, [id]);

    if (!veiculo || outorgante === undefined) return <div className="p-8 text-center text-muted-foreground">Carregando dados da procuração...</div>;

    const nome = outorgante?.nome || "_________________________________";
    const nacionalidade = outorgante?.nacionalidade || "brasileira";
    const estadoCivil = outorgante?.estado_civil || "___________________";
    const dataNasc = outorgante?.data_nascimento ? format(new Date(outorgante.data_nascimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "___/___/_____";
    const rg = outorgante?.rg || "___________________";
    const cpfCnpj = outorgante?.cpf_cnpj || "___________________";
    const endereco = outorgante?.endereco || "______________________________________________________";

    const hoje = new Date();
    const dataExtenso = format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const diaSemana = format(hoje, "dd");
    const mesAno = format(hoje, "MMMM 'de' yyyy", { locale: ptBR });

    const anoVeiculo = veiculo.ano_modelo && veiculo.ano_modelo !== veiculo.ano
        ? `${veiculo.ano}/${veiculo.ano_modelo}`
        : veiculo.ano;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 bg-white min-h-screen printable-area">
            <div className="no-print mb-8 flex gap-2">
                <Button onClick={() => navigate(`/veiculos/${id}/detalhe`)} variant="outline" className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir Procuração</Button>
            </div>

            <div className="text-black bg-white" style={{ fontFamily: "Times New Roman, serif", lineHeight: 1.8, fontSize: "16px" }}>
                <h1 className="text-2xl font-bold text-center mb-2 uppercase">INSTRUMENTO DE PROCURAÇÃO</h1>
                <p className="text-center mb-10 text-lg">PROCURAÇÃO bastante que faz: <strong>{nome.toUpperCase()}</strong></p>

                <div className="text-justify space-y-6">
                    <p>
                        SAIBAM, os que este instrumento de procuração bastante virem que, no dia {diaSemana} de {mesAno}, nesta cidade de BRASÍLIA-DISTRITO FEDERAL, Compareceu como <strong>OUTORGANTE: {nome.toUpperCase()}</strong>, {estadoCivil.toLowerCase()}, nascido(a) em {dataNasc}, residente e domiciliado(a) na {endereco}, portador(a) do CPF {cpfCnpj}, e RG {rg}.
                    </p>

                    <p>
                        Por ele(a) me foi dito que, por este instrumento, nomeia e constitui sua bastante <strong>PROCURADORA: ELEN PEREIRA RODRIGUES</strong>, brasileira, solteira, maior, administradora, portadora do RG nº 2.401.930 SSP/DF e do CPF nº 734.586.431-68, residente e domiciliada na QR 120, Conjunto 10, Casa 06, Samambaia Sul, Brasília-DF, a quem confere específicos poderes para tratar de todos e quaisquer assuntos relacionados com o veículo: <strong>{veiculo.marca_modelo}</strong>, ano fabricação/modelo: <strong>{anoVeiculo}</strong>, cor: <strong>{veiculo.cor || "__________________"}</strong>, combustível: <strong>{veiculo.combustivel || "__________________"}</strong>, placa <strong>{veiculo.placa}</strong>, chassi nº <strong>{veiculo.chassi || "__________________"}</strong>, RENAVAM nº <strong>{veiculo.renavam || "__________________"}</strong>, podendo, para tanto, representá-lo(a) perante Órgãos Públicos, Federais Estaduais, Municipais, Autarquias, Empresas Privadas, Cartórios em geral, Seguradoras em geral, DNER/DNIT, DER, especialmente junto ao DETRAN, CONTRAN, DPE, Delegacias em geral, DFTRANS, Delegacia de Roubos e Furtos de Veículos-DRFV, Polícia Rodoviária Federal, DVA-Depósito de Veículos Apreendidos, Inspetorias de Trânsito, Secretaria da Fazenda, Instância, Foro ou Tribunal, em Juízo ou fora dele, e onde com esta se apresentar e necessário for, assinando e requerendo o que for preciso, preencher e assinar guias, formulários, requerimentos, regularizar o veículo, se for necessário, registrar a propriedade ou transferir o referido veículo para nome do outorgante, e ainda, <strong>VENDER, CEDER, TRANSFERIR OU DE QUALQUER FORMA ALIENAR A QUEM QUISER, INCLUSIVE PARA O SEU PRÓPRIO NOME</strong>, receber o produto da venda, passar recibos, dar quitação, transmitir domínio, direito, ação e posse, fazer vistorias, requerer emplacamentos licenciamentos, liberações, Certidões, nada consta, requerer baixa de roubos e furtos, retirar o veículo do depósito, de Veículos Apreendidos, requerer e receber 1ª ou 2ª Via do CRV (DUT)/ATPV-e, CRLV (IPVA)/CRLV-e, carnê de IPVA, comunicar acidentes, promover registros de ocorrências periciais, tomar ciência de laudos periciais, receber seguros em caso de sinistro, dirigir o veículo em todo o território nacional e autorizar a terceiros a dirigi-lo, requerer parcelamento de multas e/ou IPVA, efetuar pagamentos, recorrer de multas em geral, emitir multas sub Júdice ressarcir quantias pagas indevidamente, efetuar e/ou dar baixa em restrições administrativas, requerer bloqueios e desbloqueios de veículo e/ou documentos, solicitar mudança de endereço, mudança de UF, categoria, juntar e retirar documentos, prestar declarações, apresentar provas, cumprir exigências, requerer e/ou quitar saldo devedor, mesmo por antecipação, promover e efetuar a baixa de alienação fiduciária e/ou gravame, requerer e receber carta de quitação, requerer, efetuar, retirar, baixar e assinar autorização para comunicado de venda, assinar os competentes termos de transferência - CRV (DUT)/ATPV-e, constituir advogados com os poderes da cláusula AD-JUDITIA, enfim, praticar todos os demais atos necessários aos fins deste mandato, PODENDO INCLUSIVE SUBSTABELECER.
                    </p>

                    <p>
                        Que pelo outorgante me foi dito que os outorgados ao aceitar o presente instrumento, assume total responsabilidade civil, criminal e administrativa, por todos os atos que por ele ou por terceiros por ele autorizado praticar na condução do referido veículo a partir desta data, inclusive multas. O presente mandato é outorgado em caráter <strong>irrevogável, irretratável, SEM PRAZO DE VALIDADE</strong> e isento de prestação de contas. A parte outorgante declara ter fornecido todos os elementos necessários para a elaboração do presente instrumento particular de procuração, conferindo-lhes veracidade, tendo lido todo o conteúdo e assumindo inteira responsabilidade, civil e criminal, por eventuais erros ou inexatidões. Dessa forma, declara-se de acordo e assina abaixo.
                    </p>
                </div>

                <div className="mt-16 text-center text-lg">
                    <p className="mb-20">BRASÍLIA-DF: {dataExtenso}.</p>

                    <div className="w-3/5 mx-auto border-t border-black pt-2">
                        <p className="font-bold">{nome.toUpperCase()}</p>
                        <p className="text-sm mt-4 font-semibold">Reconhecimento por {tipo}</p>
                    </div>
                </div>
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
            padding: 20mm 15mm;
            margin: 0;
            font-size: 14px;
          }
          .no-print { display: none !important; }
        }
      `}} />
        </div>
    );
}
