const ETAPA_ENVIO_AUTOMATICO = "Enviado para Omie";
const ETAPA_PAGAMENTO_OK = "Pagamento Ok";
const ETAPAS_MANUAIS = ["Solicitado", "Aprovado", "Aguardando NF"];

function acaoTransicao(id, label, etapaAtual, proximaEtapa, tone) {
  return {
    id,
    label,
    type: "transition",
    field: "etapa",
    value: proximaEtapa,
    hiddenWhen: { field: "etapa", notEquals: etapaAtual },
    confirm: {
      description: `${label} este pagamento e alterar a etapa para ${proximaEtapa}?`,
    },
    refresh: ["all"],
    group: "approval",
    tone,
    operationalKind: "approval",
  };
}

function acaoStatus(etapa, valor, label, tone) {
  const slugEtapa = etapa.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const slugValor = valor.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `status-${slugEtapa}-${slugValor}`,
    label,
    type: "setField",
    field: "statusTrabalho",
    value: valor,
    hiddenWhen: { field: "etapa", notEquals: etapa },
    disabledWhen: { field: "statusTrabalho", equals: valor },
    refresh: ["all"],
    group: "workStatus",
    tone,
    operationalKind: "work-status",
  };
}

function acoesStatusManuais() {
  return ETAPAS_MANUAIS.flatMap((etapa) => [
    acaoStatus(etapa, "Aguardando início", "Aguardando início", "warning"),
    acaoStatus(etapa, "Trabalhando", "Trabalhando", "success"),
    acaoStatus(etapa, "Revisar", "Revisão", "danger"),
  ]);
}

function acoesPagamentoAutomatico() {
  return [
    acaoTransicao(
      "aprovar-solicitado",
      "Aprovar",
      "Solicitado",
      "Aprovado",
      "success",
    ),
    acaoTransicao(
      "aprovar-aprovado",
      "Aprovar",
      "Aprovado",
      "Aguardando NF",
      "success",
    ),
    acaoTransicao(
      "aprovar-aguardando-nf",
      "Aprovar",
      "Aguardando NF",
      ETAPA_ENVIO_AUTOMATICO,
      "success",
    ),
    acaoTransicao(
      "recusar-aprovado",
      "Recusar",
      "Aprovado",
      "Solicitado",
      "danger",
    ),
    acaoTransicao(
      "recusar-aguardando-nf",
      "Recusar",
      "Aguardando NF",
      "Aprovado",
      "danger",
    ),
    ...acoesStatusManuais(),
    {
      id: "reconciliar-omie",
      label: "Atualizar do Omie",
      type: "apiAction",
      method: "POST",
      endpoint: "/integracoes/omie/automatico/pagamentos/:id/conciliar",
      hiddenWhen: { field: "etapa", notEquals: ETAPA_ENVIO_AUTOMATICO },
      refresh: ["self", "parent", "all"],
      group: "custom",
      tone: "neutral",
      operationalKind: "business",
    },
  ];
}

function ajustarPipeline(pipeline) {
  if (pipeline.model !== "Pagamento" && pipeline.name !== "Pagamentos") {
    return pipeline;
  }

  return {
    ...pipeline,
    // As ações automáticas do Core são substituídas para que Enviado para Omie
    // e Pagamento Ok não herdem Aprovar, Recusar ou status manuais.
    defaultActions: false,
    ticketActions: acoesPagamentoAutomatico(),
    automaticStages: [ETAPA_ENVIO_AUTOMATICO, ETAPA_PAGAMENTO_OK],
  };
}

export function aplicarFluxoAutomaticoPagamentos(manifest) {
  return {
    ...manifest,
    pipelines: (manifest.pipelines ?? []).map(ajustarPipeline),
  };
}

export {
  ETAPA_ENVIO_AUTOMATICO,
  ETAPA_PAGAMENTO_OK,
  ETAPAS_MANUAIS,
  acoesPagamentoAutomatico,
};
