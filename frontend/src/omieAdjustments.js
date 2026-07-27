const RENDERER_FAROL = "farolIntegracao";
const RENDERER_COPIAR = "copiarTexto";

const CAMPO_CATEGORIA_OMIE = {
  field: "omieCategoriaId",
  label: "Categoria financeira Omie",
  kind: "ref",
  ref: "OmieCategoria",
  referenceFilters: {
    status: "Ativo",
    contaInativa: false,
    totalizadora: false,
    transferencia: false,
    naoExibir: false,
  },
};

function somenteLeitura(field, label, kind = "string", extras = {}) {
  return {
    field,
    label,
    kind,
    readonly: true,
    readOnly: true,
    disabled: true,
    ...extras,
  };
}

function acaoApi(id, label, endpoint, opcoes = {}) {
  return {
    id,
    label,
    type: "apiAction",
    method: "POST",
    endpoint,
    refresh: ["self", "all"],
    ...opcoes,
  };
}

function colecaoConfiguracao() {
  const camposCredenciais = [
    { field: "nome", label: "Nome", group: "Identificação", groupLabel: "Identificação", inline: true },
    { field: "ativo", label: "Ativo", widget: "checkbox", group: "Identificação", inline: true },
    { field: "ambiente", label: "Ambiente", group: "Identificação", inline: true },
    { field: "urlPublica", label: "URL pública da Central", group: "Conectividade", groupLabel: "Conectividade" },
    { field: "appKey", label: "App Key", widget: "password", group: "Credenciais", groupLabel: "Credenciais", inline: true },
    { field: "appSecret", label: "App Secret", widget: "password", group: "Credenciais", inline: true },
    { field: "contaCorrenteId", label: "Conta corrente Omie", kind: "number", group: "Financeiro", groupLabel: "Financeiro" },
  ];

  const camposSomenteLeitura = [
    somenteLeitura("appKeyMascarada", "App Key configurada"),
    somenteLeitura("credenciaisConfiguradas", "Credenciais configuradas", "boolean"),
    somenteLeitura("statusConexao", "Status da conexão"),
    somenteLeitura("ultimoErroConexao", "Último erro"),
    somenteLeitura("webhookUrl", "URL do webhook", "string", { renderer: RENDERER_COPIAR }),
  ];

  return {
    model: "OmieConfiguracao",
    mode: "dynamic",
    path: "/configuracoes",
    label: "Configurações",
    section: "Configurações",
    form: [...camposCredenciais, ...camposSomenteLeitura],
    list: {
      columns: [
        "nome",
        "ambiente",
        { field: "statusConexao", label: "Conexão", renderer: RENDERER_FAROL },
        "appKeyMascarada",
        { field: "integracoesPendentes", label: "Pendentes", kind: "number" },
        { field: "integracoesComErro", label: "Erros ativos", kind: "number" },
        { field: "integracoesArquivadas", label: "Arquivados", kind: "number" },
        { field: "webhookUrl", label: "Webhook", renderer: RENDERER_COPIAR },
      ],
      rowActions: [
        { type: "openDetailModal", label: "Abrir configurações", icon: "edit", initialTab: "dashboard" },
        acaoApi("testar-conexao", "Testar integração", "/integracoes/omie/testar-conexao"),
        acaoApi("sincronizar-formas", "Sincronizar meios de pagamento", "/integracoes/omie/sincronizar/formas-pagamento"),
        acaoApi("sincronizar-categorias", "Sincronizar categorias", "/integracoes/omie/sincronizar/categorias"),
        acaoApi("sincronizar-clientes", "Sincronizar clientes/prestadores", "/integracoes/omie/sincronizar/clientes"),
        acaoApi("processar-fila", "Processar fila", "/integracoes/omie/fila/processar"),
        acaoApi("reconciliar-financeiro", "Reconciliar pagamentos", "/integracoes/omie/reconciliar"),
      ],
    },
    detailModal: {
      enabled: true,
      titleField: "nome",
      size: "full",
      defaultTab: "dashboard",
      tabs: [
        {
          id: "dashboard",
          label: "Dashboard",
          type: "summary",
          cards: [
            { label: "Conexão", source: "field", field: "statusConexao", format: "badge" },
            { label: "Pendentes", source: "field", field: "integracoesPendentes", format: "number" },
            { label: "Processando", source: "field", field: "integracoesProcessando", format: "number" },
            { label: "Erros ativos", source: "field", field: "integracoesComErro", format: "number" },
            { label: "Arquivados", source: "field", field: "integracoesArquivadas", format: "number" },
            { label: "Concluídos", source: "field", field: "integracoesConcluidas", format: "number" },
            { label: "Webhooks pendentes", source: "field", field: "webhooksPendentes", format: "number" },
            { label: "Clientes sincronizados", source: "field", field: "clientesSincronizados", format: "number" },
            { label: "Clientes pendentes", source: "field", field: "clientesPendentes", format: "number" },
            { label: "Clientes com erro", source: "field", field: "clientesComErro", format: "number" },
            { label: "Pagamentos enviados", source: "field", field: "pagamentosEnviados", format: "number" },
            { label: "Pagamentos com erro", source: "field", field: "pagamentosComErro", format: "number" },
          ],
        },
        {
          id: "credenciais",
          label: "Credenciais",
          type: "form",
          groups: [
            { label: "Identificação", fields: ["nome", "ativo", "ambiente"], columns: 3 },
            { label: "Conectividade", fields: ["urlPublica", "contaCorrenteId"], columns: 2 },
            { label: "Credenciais", fields: ["appKey", "appSecret"], columns: 2 },
            { label: "Situação", fields: ["appKeyMascarada", "credenciaisConfiguradas", "statusConexao", "ultimoErroConexao"], columns: 2 },
          ],
        },
        {
          id: "sincronizacoes",
          label: "Sincronizações",
          type: "summary",
          cards: [
            { label: "Clientes/prestadores", source: "field", field: "ultimaSincronizacaoClientesEm", format: "datetime" },
            { label: "Categorias", source: "field", field: "ultimaSincronizacaoCategoriasEm", format: "datetime" },
            { label: "Meios de pagamento", source: "field", field: "ultimaSincronizacaoFormasPagamentoEm", format: "datetime" },
            { label: "Reconciliação financeira", source: "field", field: "ultimaReconciliacaoFinanceiraEm", format: "datetime" },
            { label: "Dashboard atualizado", source: "field", field: "ultimaAtualizacaoDashboardEm", format: "datetime" },
          ],
        },
        {
          id: "webhook",
          label: "Webhook",
          type: "form",
          groups: [
            { label: "Configuração no Omie", fields: ["webhookUrl"], columns: 1 },
          ],
        },
      ],
    },
  };
}

function colecaoCategoriaOmie() {
  return {
    model: "OmieCategoria",
    mode: "dynamic",
    path: "/integracoes/categorias-omie",
    label: "Categorias Omie",
    section: "Integrações",
    create: { enabled: false },
    form: [
      somenteLeitura("codigo", "Código Omie"),
      somenteLeitura("descricao", "Descrição"),
      somenteLeitura("natureza", "Natureza"),
      somenteLeitura("tipoCategoria", "Tipo"),
      somenteLeitura("categoriaSuperiorCodigo", "Categoria superior"),
      somenteLeitura("totalizadora", "Totalizadora", "boolean"),
      somenteLeitura("transferencia", "Transferência", "boolean"),
      somenteLeitura("contaInativa", "Inativa", "boolean"),
      somenteLeitura("contaDespesa", "Despesa", "boolean"),
      somenteLeitura("status", "Status"),
    ],
    list: {
      filters: [
        {
          field: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Todos", value: "" },
            { label: "Ativo", value: "Ativo" },
            { label: "Inativo", value: "Inativo" },
          ],
        },
        { field: "contaDespesa", label: "Despesa", type: "boolean" },
        { field: "totalizadora", label: "Totalizadora", type: "boolean" },
      ],
      columns: [
        { field: "status", label: "Integração", renderer: RENDERER_FAROL },
        "codigo",
        "descricao",
        "natureza",
        "tipoCategoria",
        "contaDespesa",
        "totalizadora",
        "transferencia",
        "sincronizadoEm",
      ],
    },
  };
}

function pipelineIntegracoes() {
  return {
    name: "IntegracoesOmie",
    model: "IntegrationOutbox",
    stageField: "status",
    path: "/integracoes/esteira",
    label: "Integrações Omie",
    section: "Integrações",
    defaultActions: false,
    viewModes: ["board", "list"],
    defaultView: "list",
    titleField: "tipo",
    filters: [
      { field: "tipo", label: "Tipo", type: "select" },
      { field: "aggregateType", label: "Entidade", type: "text" },
      { field: "status", label: "Status", type: "select" },
    ],
    list: {
      columns: [
        { field: "status", label: "Integração", renderer: RENDERER_FAROL },
        "tipo",
        "aggregateType",
        "aggregateId",
        "tentativas",
        "proximaTentativaEm",
        "ultimoErro",
        "arquivadoEm",
        "updatedAt",
      ],
    },
    cardFields: [
      { field: "status", label: "🚦 Integração", format: "badge" },
      { field: "aggregateType", label: "Entidade" },
      { field: "aggregateId", label: "Registro" },
      { field: "tentativas", label: "Tentativas" },
      { field: "ultimoErro", label: "Erro" },
    ],
    ticketActions: [
      acaoApi("arquivar", "Arquivar erro", "/integracoes/omie/fila/:id/arquivar", {
        visibleWhen: { field: "status", in: ["Erro temporário", "Erro definitivo"] },
        confirm: {
          title: "Arquivar este erro?",
          description: "O ticket continuará disponível no histórico, mas deixará de contar nos indicadores de erro.",
        },
      }),
      acaoApi("reprocessar", "Reprocessar", "/integracoes/omie/fila/:id/reprocessar", {
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
            { label: "Status", source: "field", field: "status", format: "badge" },
            { label: "Tipo", source: "field", field: "tipo", format: "text" },
            { label: "Entidade", source: "field", field: "aggregateType", format: "text" },
            { label: "Registro", source: "field", field: "aggregateId", format: "text" },
            { label: "Tentativas", source: "field", field: "tentativas", format: "number" },
            { label: "Próxima tentativa", source: "field", field: "proximaTentativaEm", format: "datetime" },
          ],
        },
        {
          id: "detalhes",
          label: "Detalhes",
          type: "form",
          groups: [
            { label: "Rastreabilidade", fields: ["idempotencyKey", "aggregateType", "aggregateId", "tipo"], columns: 2 },
            { label: "Execução", fields: ["status", "tentativas", "proximaTentativaEm", "concluidoEm"], columns: 2 },
            { label: "Erro", fields: ["ultimoErro"], columns: 1 },
            { label: "Arquivamento", fields: ["arquivadoEm", "motivoArquivamento", "statusAnterior"], columns: 1 },
          ],
        },
      ],
    },
  };
}

function pipelineWebhooks() {
  return {
    name: "EventosOmie",
    model: "WebhookInbox",
    stageField: "status",
    path: "/integracoes/eventos",
    label: "Eventos do Omie",
    section: "Integrações",
    defaultActions: false,
    viewModes: ["board", "list"],
    defaultView: "list",
    titleField: "eventType",
    filters: [
      { field: "eventType", label: "Evento", type: "text" },
      { field: "status", label: "Status", type: "select" },
    ],
    list: {
      columns: [
        { field: "status", label: "Integração", renderer: RENDERER_FAROL },
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
      { field: "externalEventId", label: "ID externo" },
      { field: "receivedAt", label: "Recebido em", format: "datetime" },
      { field: "lastError", label: "Erro" },
    ],
  };
}

function adicionarCamposFormulario(form = [], campos = []) {
  const existentes = new Set(form.map((campo) => campo.field));
  return [...form, ...campos.filter((campo) => !existentes.has(campo.field))];
}

function semDuplicarColunas(colunas = [], novas = []) {
  const nomes = new Set(colunas.map((coluna) => (typeof coluna === "string" ? coluna : coluna.field)));
  return [...colunas, ...novas.filter((coluna) => !nomes.has(typeof coluna === "string" ? coluna : coluna.field))];
}

function substituirColuna(colunas = [], field, novaColuna) {
  let encontrou = false;
  const resultado = colunas.map((coluna) => {
    const nome = typeof coluna === "string" ? coluna : coluna.field;
    if (nome !== field) return coluna;
    encontrou = true;
    return { ...(typeof coluna === "object" ? coluna : { field }), ...novaColuna };
  });
  if (!encontrou) resultado.push({ field, ...novaColuna });
  return resultado;
}

function ajustarClienteFornecedor(collection) {
  const campos = [
    somenteLeitura("codigoClienteOmie", "Código Omie", "number"),
    somenteLeitura("codigoClienteIntegracao", "Código de integração"),
    somenteLeitura("omieStatusIntegracao", "Status Omie"),
    somenteLeitura("omieSincronizadoEm", "Sincronizado em", "datetime"),
    somenteLeitura("omieUltimoErro", "Último erro"),
  ];
  const colunas = substituirColuna(
    semDuplicarColunas(collection.list?.columns, ["omieStatusIntegracao", "codigoClienteOmie"]),
    "omieStatusIntegracao",
    { label: "Integração", renderer: RENDERER_FAROL },
  );
  return {
    ...collection,
    list: { ...collection.list, columns: colunas },
    detailModal: collection.detailModal
      ? {
        ...collection.detailModal,
        tabs: [
          ...(collection.detailModal.tabs ?? []),
          {
            id: "omie",
            label: "Integração Omie",
            type: "form",
            groups: [{ label: "Sincronização", fields: campos.map((campo) => campo.field), columns: 2 }],
          },
        ],
      }
      : collection.detailModal,
    form: adicionarCamposFormulario(collection.form, campos),
  };
}

function ajustarCategoria(collection) {
  const campos = [
    { ...CAMPO_CATEGORIA_OMIE, group: "Integração Omie", groupLabel: "Integração Omie", inline: true },
    { field: "exigirCategoriaOmie", label: "Exigir categoria Omie", widget: "checkbox", group: "Integração Omie", inline: true },
  ];
  return {
    ...collection,
    form: adicionarCamposFormulario(collection.form, campos),
    list: {
      ...collection.list,
      columns: semDuplicarColunas(collection.list?.columns, [
        { field: "omieCategoriaId", label: "🚦 Categoria Omie", renderer: RENDERER_FAROL },
        "exigirCategoriaOmie",
      ]),
    },
  };
}

function ajustarFormaPagamento(collection) {
  return {
    ...collection,
    label: "Meios de pagamento Omie",
    section: "Integrações",
    create: { enabled: false },
    form: [
      somenteLeitura("codigoOmie", "Código Omie"),
      somenteLeitura("nome", "Nome"),
      somenteLeitura("quantidadeParcelas", "Parcelas", "number"),
      somenteLeitura("listaParcelas", "Lista de parcelas"),
      somenteLeitura("diasParcela", "Dias da parcela", "number"),
      somenteLeitura("origem", "Origem"),
      somenteLeitura("status", "Status"),
      { field: "padrao", label: "Forma padrão da Central", widget: "checkbox" },
    ],
    list: {
      ...collection.list,
      columns: [
        { field: "status", label: "Integração", renderer: RENDERER_FAROL },
        "codigoOmie",
        "nome",
        "quantidadeParcelas",
        "listaParcelas",
        "diasParcela",
        "padrao",
        "sincronizadoEm",
      ],
    },
  };
}

const CAMPOS_CARD_PAGAMENTO = [
  { field: "pagamentoStatus", label: "🚦 Pagamento", format: "badge" },
  { field: "pagamentoTotalPago", label: "Pago", format: "currency" },
  { field: "pagamentoValorPendente", label: "Pendente", format: "currency" },
];

function ajustarEsteiraItens(pipeline) {
  const tabs = pipeline.ticketModal?.tabs ?? [];
  const possui = tabs.some((tab) => tab.id === "financeiro-omie");
  return {
    ...pipeline,
    list: {
      ...pipeline.list,
      columns: semDuplicarColunas(pipeline.list?.columns, [
        { field: "pagamentoStatus", label: "Pagamento", kind: "badge" },
        { field: "pagamentoTotalPago", label: "Pago", kind: "currency" },
        { field: "pagamentoValorPendente", label: "Pendente", kind: "currency" },
      ]),
    },
    cardFields: CAMPOS_CARD_PAGAMENTO,
    card: { ...(pipeline.card ?? {}), fields: CAMPOS_CARD_PAGAMENTO },
    ticketModal: pipeline.ticketModal
      ? {
        ...pipeline.ticketModal,
        tabs: possui
          ? tabs
          : [
            ...tabs,
            {
              id: "financeiro-omie",
              label: "Financeiro Omie",
              type: "summary",
              cards: [
                { label: "Contratado", source: "field", field: "contratacaoTotal", format: "currency" },
                { label: "Planejado", source: "field", field: "pagamentoTotalPlanejado", format: "currency" },
                { label: "Pago no Omie", source: "field", field: "pagamentoTotalPago", format: "currency" },
                { label: "Pendente", source: "field", field: "pagamentoValorPendente", format: "currency" },
                { label: "Situação", source: "field", field: "pagamentoStatus", format: "badge" },
              ],
            },
          ],
      }
      : pipeline.ticketModal,
  };
}

function ajustarEsteiraPagamentos(pipeline) {
  const tabs = pipeline.ticketModal?.tabs ?? [];
  const possui = tabs.some((tab) => tab.id === "omie");
  const actions = pipeline.ticketActions ?? [];
  const colunas = substituirColuna(
    semDuplicarColunas(pipeline.list?.columns, [
      "omieStatusIntegracao",
      { field: "omieValorPago", label: "Pago", kind: "currency" },
      { field: "omieValorPendente", label: "Pendente", kind: "currency" },
    ]),
    "omieStatusIntegracao",
    { label: "Integração", renderer: RENDERER_FAROL },
  );
  return {
    ...pipeline,
    list: { ...pipeline.list, columns: colunas },
    cardFields: semDuplicarColunas(pipeline.cardFields, [
      { field: "omieStatusIntegracao", label: "🚦 Integração", format: "badge" },
      { field: "omieValorPago", label: "Pago", format: "currency" },
      { field: "omieValorPendente", label: "Pendente", format: "currency" },
    ]),
    ticketActions: [
      ...actions,
      acaoApi("enviar-omie", "Enviar ao Omie", "/integracoes/omie/pagamentos/:id/enviar", {
        visibleWhen: { field: "etapa", equals: "Aprovado" },
        refresh: ["self", "parent", "all"],
      }),
      acaoApi("reconciliar-omie", "Atualizar do Omie", "/integracoes/omie/pagamentos/:id/reconciliar", {
        visibleWhen: { field: "codigoLancamentoIntegracao", exists: true },
        refresh: ["self", "parent", "all"],
      }),
    ],
    ticketModal: pipeline.ticketModal
      ? {
        ...pipeline.ticketModal,
        tabs: possui
          ? tabs
          : [
            ...tabs,
            {
              id: "omie",
              label: "Integração Omie",
              type: "summary",
              cards: [
                { label: "Status", source: "field", field: "omieStatusIntegracao", format: "badge" },
                { label: "Título Omie", source: "field", field: "codigoLancamentoOmie", format: "number" },
                { label: "Valor do título", source: "field", field: "omieValorTitulo", format: "currency" },
                { label: "Valor pago", source: "field", field: "omieValorPago", format: "currency" },
                { label: "Valor pendente", source: "field", field: "omieValorPendente", format: "currency" },
                { label: "Última baixa", source: "field", field: "omieDataUltimaBaixa", format: "date" },
                { label: "Liquidado", source: "field", field: "omieLiquidado", format: "badge" },
                { label: "Última sincronização", source: "field", field: "omieUltimaSincronizacaoEm", format: "datetime" },
                { label: "Último erro", source: "field", field: "omieUltimoErro", format: "text" },
              ],
            },
          ],
      }
      : pipeline.ticketModal,
  };
}

function ajustarCollection(collection) {
  if (collection.model === "ClienteFornecedor") return ajustarClienteFornecedor(collection);
  if (collection.model === "Categoria") return ajustarCategoria(collection);
  if (collection.model === "FormaPagamento") return ajustarFormaPagamento(collection);
  return collection;
}

function ajustarPipeline(pipeline) {
  if (pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto") return ajustarEsteiraItens(pipeline);
  if (pipeline.model === "Pagamento" || pipeline.name === "Pagamentos") return ajustarEsteiraPagamentos(pipeline);
  return pipeline;
}

export function aplicarIntegracaoOmie(manifest) {
  const collections = (manifest.collections ?? []).map(ajustarCollection);
  const existentes = new Set(collections.map((collection) => collection.model));
  for (const collection of [colecaoConfiguracao(), colecaoCategoriaOmie()]) {
    if (!existentes.has(collection.model)) collections.push(collection);
  }

  const pipelines = (manifest.pipelines ?? []).map(ajustarPipeline);
  const pipelinesExistentes = new Set(pipelines.map((pipeline) => pipeline.model));
  for (const pipeline of [pipelineIntegracoes(), pipelineWebhooks()]) {
    if (!pipelinesExistentes.has(pipeline.model)) pipelines.push(pipeline);
  }

  return { ...manifest, collections, pipelines };
}
