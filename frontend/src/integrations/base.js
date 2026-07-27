const SIGNAL_RENDERER = "integrationSignal";

function apiAction(id, label, endpoint, options = {}) {
  return {
    id,
    label,
    type: "apiAction",
    method: "POST",
    endpoint,
    refresh: ["self", "all"],
    ...options,
  };
}

function historyCollection(providerLabel) {
  return {
    model: "IntegrationExecution",
    mode: "dynamic",
    path: "/integracoes/historico",
    label: "Histórico de Integrações",
    section: "Integrações",
    create: { enabled: false },
    form: [
      { field: "provider", label: "Provedor", readonly: true, readOnly: true },
      { field: "resource", label: "Recurso", readonly: true, readOnly: true },
      { field: "operation", label: "Operação", readonly: true, readOnly: true },
      { field: "title", label: "Execução", readonly: true, readOnly: true },
      { field: "status", label: "Status", readonly: true, readOnly: true },
      { field: "startedAt", label: "Iniciado em", readonly: true, readOnly: true },
      { field: "concludedAt", label: "Concluído em", readonly: true, readOnly: true },
      { field: "durationMs", label: "Duração (ms)", readonly: true, readOnly: true },
      { field: "message", label: "Mensagem", readonly: true, readOnly: true },
      { field: "error", label: "Erro", readonly: true, readOnly: true },
    ],
    list: {
      filters: [
        { field: "provider", label: "Provedor", type: "text" },
        { field: "resource", label: "Recurso", type: "text" },
        { field: "status", label: "Status", type: "select" },
      ],
      columns: [
        { field: "status", label: "Integração", renderer: SIGNAL_RENDERER },
        "provider",
        "resource",
        "operation",
        "title",
        "itemCount",
        "startedAt",
        "durationMs",
        "error",
      ],
    },
    detailModal: {
      enabled: true,
      titleField: "title",
      size: "xl",
      defaultTab: "resumo",
      tabs: [
        {
          id: "resumo",
          label: "Resumo",
          type: "summary",
          cards: [
            { label: "Provedor", source: "field", field: "provider", format: "text" },
            { label: "Recurso", source: "field", field: "resource", format: "text" },
            { label: "Status", source: "field", field: "status", format: "badge" },
            { label: "Itens", source: "field", field: "itemCount", format: "number" },
            { label: "Início", source: "field", field: "startedAt", format: "datetime" },
            { label: "Duração (ms)", source: "field", field: "durationMs", format: "number" },
          ],
        },
        {
          id: "detalhes",
          label: "Detalhes",
          type: "form",
          groups: [
            { label: `Execução ${providerLabel}`, fields: ["provider", "resource", "operation", "title", "status"], columns: 2 },
            { label: "Resultado", fields: ["message", "error", "startedAt", "concludedAt", "durationMs"], columns: 2 },
          ],
        },
      ],
    },
  };
}

function queuePipeline(providerLabel) {
  return {
    name: "Integracoes",
    model: "IntegrationOutbox",
    stageField: "status",
    path: "/integracoes/esteira",
    label: "Integrações",
    section: "Integrações",
    defaultActions: false,
    viewModes: ["board", "list"],
    defaultView: "list",
    titleField: "tipo",
    filters: [
      { field: "provider", label: "Provedor", type: "text" },
      { field: "resource", label: "Recurso", type: "text" },
      { field: "tipo", label: "Tipo", type: "text" },
      { field: "aggregateType", label: "Entidade", type: "text" },
      { field: "status", label: "Status", type: "select" },
    ],
    list: {
      columns: [
        { field: "status", label: "Integração", renderer: SIGNAL_RENDERER },
        "provider",
        "resource",
        "tipo",
        "aggregateType",
        "aggregateId",
        "tentativas",
        "proximaTentativaEm",
        "ultimoErro",
        "updatedAt",
      ],
    },
    cardFields: [
      { field: "status", label: "🚦 Integração", format: "badge" },
      { field: "provider", label: "Provedor" },
      { field: "resource", label: "Recurso" },
      { field: "aggregateType", label: "Entidade" },
      { field: "tentativas", label: "Tentativas" },
      { field: "ultimoErro", label: "Erro" },
    ],
    ticketActions: [
      apiAction("arquivar", "Arquivar erro", "/integracoes/fila/:id/arquivar", {
        visibleWhen: { field: "status", in: ["Erro temporário", "Erro definitivo"] },
        confirm: {
          title: "Arquivar este erro?",
          description: "O ticket continuará no histórico e deixará de contar como erro ativo.",
        },
      }),
      apiAction("reprocessar", "Reprocessar", "/integracoes/fila/:id/reprocessar", {
        visibleWhen: { field: "status", in: ["Erro temporário", "Erro definitivo", "Arquivado"] },
      }),
    ],
    ticketModal: {
      enabled: true,
      titleField: "tipo",
      size: "xl",
      defaultTab: "resumo",
      tabs: [
        {
          id: "resumo",
          label: "Resumo",
          type: "summary",
          cards: [
            { label: "Provedor", source: "field", field: "provider", format: "text" },
            { label: "Recurso", source: "field", field: "resource", format: "text" },
            { label: "Status", source: "field", field: "status", format: "badge" },
            { label: "Operação", source: "field", field: "operation", format: "text" },
            { label: "Tentativas", source: "field", field: "tentativas", format: "number" },
          ],
        },
        {
          id: "detalhes",
          label: "Detalhes",
          type: "form",
          groups: [
            { label: `Rastreabilidade ${providerLabel}`, fields: ["provider", "resource", "handler", "idempotencyKey", "aggregateType", "aggregateId"], columns: 2 },
            { label: "Execução", fields: ["status", "tentativas", "proximaTentativaEm", "concluidoEm"], columns: 2 },
            { label: "Erro", fields: ["ultimoErro"], columns: 1 },
            { label: "Arquivamento", fields: ["arquivadoEm", "motivoArquivamento", "statusAnterior"], columns: 1 },
          ],
        },
      ],
    },
  };
}

function webhookPipeline() {
  return {
    name: "EventosIntegracao",
    model: "WebhookInbox",
    stageField: "status",
    path: "/integracoes/eventos",
    label: "Eventos Recebidos",
    section: "Integrações",
    defaultActions: false,
    viewModes: ["board", "list"],
    defaultView: "list",
    titleField: "eventType",
    filters: [
      { field: "provider", label: "Provedor", type: "text" },
      { field: "resource", label: "Recurso", type: "text" },
      { field: "eventType", label: "Evento", type: "text" },
      { field: "status", label: "Status", type: "select" },
    ],
    list: {
      columns: [
        { field: "status", label: "Integração", renderer: SIGNAL_RENDERER },
        "provider",
        "resource",
        "eventType",
        "externalEventId",
        "receivedAt",
        "attempts",
        "processedAt",
        "lastError",
      ],
    },
    cardFields: [
      { field: "status", label: "🚦 Evento", format: "badge" },
      { field: "provider", label: "Provedor" },
      { field: "resource", label: "Recurso" },
      { field: "externalEventId", label: "ID externo" },
      { field: "receivedAt", label: "Recebido em", format: "datetime" },
      { field: "lastError", label: "Erro" },
    ],
  };
}

export function aplicarComponentesIntegracao(manifest, options = {}) {
  const providerLabel = options.providerLabel || "do provedor";
  const collections = [...(manifest.collections ?? [])];
  const collectionModels = new Set(collections.map((collection) => collection.model));
  if (!collectionModels.has("IntegrationExecution")) {
    collections.push(historyCollection(providerLabel));
  }

  const pipelines = [...(manifest.pipelines ?? [])];
  const pipelineModels = new Set(pipelines.map((pipeline) => pipeline.model));
  if (!pipelineModels.has("IntegrationOutbox")) pipelines.push(queuePipeline(providerLabel));
  if (!pipelineModels.has("WebhookInbox")) pipelines.push(webhookPipeline());

  return { ...manifest, collections, pipelines };
}
