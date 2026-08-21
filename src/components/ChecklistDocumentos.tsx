import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import type { Veiculo, Cliente, Transacao } from "@/lib/db-types";

/**
 * Checklist visual mostrando quais dados essenciais estão faltando pra cada
 * documento imprimir 100% preenchido. Fica logo acima dos botões de contrato
 * pra que o operador veja o que precisa cadastrar ANTES de imprimir e receber
 * o contrato em branco.
 *
 * Se todos os documentos estiverem 100%, o card fica verde/compacto. Se
 * houver pendências, expande automaticamente e mostra cada linha faltante.
 */

type Documento = {
  nome: string;
  itens: { rotulo: string; ok: boolean }[];
};

function checarDocumentos(
  veiculo: Veiculo,
  compra: Cliente | null,
  venda: Cliente | null,
  transacoes: Transacao[],
): Documento[] {
  const temReceita = transacoes.some((t) => t.tipo === "Receita");
  const temValorVenda = Number(veiculo.valor_venda ?? 0) > 0;
  const temFormaPgto = Boolean(veiculo.forma_pagamento);
  const temDataVenda = Boolean(veiculo.data_venda);

  return [
    {
      nome: "Contrato de Compra / Intermediação",
      itens: [
        { rotulo: "Cliente vendedor (aba Compra)", ok: !!compra },
        { rotulo: "Valor de aquisição preenchido", ok: Number(veiculo.valor_aquisicao ?? 0) > 0 },
        { rotulo: "Chave PIX do cliente vendedor", ok: !!compra?.chave_pix },
      ],
    },
    {
      nome: "Contrato de Venda / Repasse",
      itens: [
        { rotulo: "Cliente comprador (aba Venda)", ok: !!venda },
        {
          rotulo: "Valor + forma de pagamento (ou receita lançada)",
          ok: temReceita || (temValorVenda && temFormaPgto),
        },
        { rotulo: "Data da venda", ok: temReceita || temDataVenda },
      ],
    },
    {
      nome: "Recibo",
      itens: [
        { rotulo: "Cliente comprador", ok: !!venda },
        { rotulo: "Valor da venda", ok: temReceita || temValorVenda },
        { rotulo: "Data da venda", ok: temReceita || temDataVenda },
      ],
    },
  ];
}

export function ChecklistDocumentos({
  veiculo,
  clienteCompra,
  clienteVenda,
  transacoes,
}: {
  veiculo: Veiculo;
  clienteCompra: Cliente | null;
  clienteVenda: Cliente | null;
  transacoes: Transacao[];
}) {
  const documentos = checarDocumentos(veiculo, clienteCompra, clienteVenda, transacoes);
  const pendencias = documentos.reduce(
    (acc, d) => acc + d.itens.filter((i) => !i.ok).length,
    0,
  );
  const [aberto, setAberto] = useState(pendencias > 0);

  if (pendencias === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        <span>Todos os documentos estão prontos pra imprimir sem campos em branco.</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="flex-1 text-left font-medium">
          {pendencias} campo{pendencias > 1 ? "s" : ""} faltando pra imprimir todos os documentos completos
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-amber-500/20 px-3 py-3">
          {documentos.map((doc) => {
            const pend = doc.itens.filter((i) => !i.ok).length;
            return (
              <div key={doc.nome}>
                <p className="text-xs font-semibold text-muted-foreground">
                  {doc.nome} {pend > 0 && <span className="text-amber-700 dark:text-amber-400">({pend} pendente{pend > 1 ? "s" : ""})</span>}
                </p>
                <ul className="mt-1 space-y-1 text-xs">
                  {doc.itens.map((item) => (
                    <li key={item.rotulo} className="flex items-center gap-2">
                      {item.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      <span className={item.ok ? "text-muted-foreground line-through" : "text-foreground"}>
                        {item.rotulo}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
