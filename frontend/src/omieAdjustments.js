const RENDERER_FAROL = "farolIntegracao";

const CAMPO_CONTA_CORRENTE_OMIE = {
  field: "omieContaCorrenteId",
  label: "Conta corrente Omie",
  kind: "ref",
  ref: "OmieContaCorrente",
  required: true,
  referenceFilters: {
    status: "Ativo",
    inativa: false,
    bloqueada: false,
  },
};

function somenteLeitura(field, label, kind = "string") {
  return {
    field,
    label,
    kind,
    readonly: true,
    readOnly: true,
    disabled: true,
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

function nomeCampo(campo) {
  return typeof campo === "string" ? campo : campo?.field;
}

function adicionarSemDuplicar(atuais = [], novos = []) {
  const existentes = new Set(atuais.map(nomeCampo));
  return [
    ...atuais,
    ...novos.filter((campo) => !existentes.has(nomeCampo(campo))),
  ];
}

function substituirColuna(colunas = [], field, novaColuna) {
  let encontrou = false;
  const resultado = colunas.map((coluna) => {
    if (nomeCampo(coluna) !== field) return coluna;
    encontrou = true;
    return {
      ...(typeof coluna === "object" ? coluna : { field }),
      ...novaColuna,
    };
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
    adicionarSemDuplicar(
      collection.list?.columns,
      ["omieStatusIntegracao", "codigoClienteOmie"],
    ),
    "omieStatusIntegracao",
    { label: "Integração", renderer: RENDERER_FAROL },
  );
  const tabs = collection.detailModal?.tabs ?? [];
  const semAbaOmie = tabs.filter((tab) => tab.id !== "omie");

  return {
    ...collection,
    list: { ...collection.list, columns: colunas },
    form: adicionarSemDuplicar(collection.form, campos),
    detailModal: collection.detailModal
      ? {
        ...collection.detailModal,
        tabs: [
          ...semAbaOmie,
          {
            id: "omie",
            label: "Integração Omie",
            type: "form",
            groups: [
              {
                label: "Sincronização",
                fields: campos.map((campo) => campo.field),
                columns: 2,
              },
            ],
          },
        ],
      }
      : collection.detailModal,
  };
}

function adicionarContaEmAba(tab) {
  if (tab.type !== "form") return tab;
  if (tab.groups?.length) {
    const [primeiro, ...restante] = tab.groups;
    return {
      ...tab,
      groups: [
        {
          ...primeiro,
          fields: adicionarSemDuplicar(primeiro.fields, ["omieContaCorrenteId"]),
        },
        ...restante,
      ],
    };
  }
  return {
    ...tab,
    fields: adicionarSemDuplicar(tab.fields, ["omieContaCorrenteId"]),
  };
}

function ajustarColecaoPagamento(collection) {
  return {
    ...collection,
    form: adicionarSemDuplicar(collection.form, [CAMPO_CONTA_CORRENTE_OMIE]),
    list: {
      ...collection.list,
      columns: adicionarSemDuplicar(collection.list?.columns, [
        { field: "omieContaCorrenteId", label: "Conta corrente Omie" },
      ]),
    },
    detailModal: collection.detailModal
      ? {
        ...collection.detailModal,
        tabs: collection.detailModal.tabs?.map(adicionarContaEmAba),
      }
      : collection.detailModal,
  };
}

const CAMPOS_CARD_PAGAMENTO = [
  { field: "pagamentoStatus", label: "🚦 Pagamento", format: "badge" },
  { field: "pagamentoTotalPago", label: "Pago", format: "currency" },
  { field: "pagamentoValorPendente", label: "Pendente", format: "currency" },
];

function ajustarAcaoGerarPagamento(action) {
  if (action.id !== "gerar-pagamento") return action;
  return {
    ...action,
    fields: adicionarSemDuplicar(action.fields, [CAMPO_CONTA_CORRENTE_OMIE]),
  };
}

function ajustarAbaPagamentosItem(tab) {
  if (tab.id !== "pagamentos" || tab.type !== "relatedGrid") return tab;
  return {
    ...tab,
    columns: adicionarSemDuplicar(tab.columns, [
      {
        field: "omieContaCorrenteId",
        label: "Conta corrente Omie",
        editable: true,
        editor: "ref",
        required: true,
      },
    ]),
  };
}

function ajustarEsteiraItens(pipeline) {
  const tabs = pipeline.ticketModal?.tabs ?? [];
  const semFinanceiroOmie = tabs
    .filter((tab) => tab.id !== "financeiro-omie")
    .map(ajustarAbaPagamentosItem);

  return {
    ...pipeline,
    list: {
      ...pipeline.list,
      columns: adicionarSemDuplicar(pipeline.list?.columns, [
        { field: "pagamentoStatus", label: "Pagamento", kind: "badge" },
        { field: "pagamentoTotalPago", label: "Pago", kind: "currency" },
        { field: "pagamentoValorPendente", label: "Pendente", kind: "currency" },
      ]),
    },
    cardFields: CAMPOS_CARD_PAGAMENTO,
    card: { ...(pipeline.card ?? {}), fields: CAMPOS_CARD_PAGAMENTO },
    ticketActions: pipeline.ticketActions?.map(ajustarAcaoGerarPagamento),
    ticketModal: pipeline.ticketModal
      ? {
        ...pipeline.ticketModal,
        tabs: [
          ...semFinanceiroOmie,
          {
            id: "financeiro-omie",
            label: "Financeiro Omie",
            type: "summary",
            cards: [
              {
                label: "Contratado",
                source: "field",
                field: "contratacaoTotal",
                format: "currency",
              },
              {
                label: "Planejado",
                source: "field",
                field: "pagamentoTotalPlanejado",
                format: "currency",
              },
              {
                label: "Pago no Omie",
                source: "field",
                field: "pagamentoTotalPago",
                format: "currency",
              },
              {
                label: "Pendente",
                source: "field",
                field: "pagamentoValorPendente",
                format: "currency",
              },
              {
                label: "Situação",
                source: "field",
                field: "pagamentoStatus",
                format: "badge",
              },
            ],
          },
        ],
      }
      : pipeline.ticketModal,
  };
}

function ajustarEsteiraPagamentos(pipeline) {
  const tabs = pipeline.ticketModal?.tabs ?? [];
  const semAbaOmie = tabs
    .filter((tab) => tab.id !== "omie")
    .map(adicionarContaEmAba);
  const actions = (pipeline.ticketActions ?? []).filter(
    (action) => !["enviar-omie", "reconciliar-omie"].includes(action.id),
  );
  const colunas = substituirColuna(
    adicionarSemDuplicar(pipeline.list?.columns, [
      { field: "omieContaCorrenteId", label: "Conta corrente Omie" },
      "omieStatusIntegracao",
      { field: "omieValorPago", label: "Pago", kind: "currency" },
      { field: "omieValorPendente", label: "Pendente", kind: "currency" },
    ]),
    "omieStatusIntegracao",
    { label: "Integração", renderer: RENDERER_FAROL },
  );

  return {
    ...pipeline,
    form: adicionarSemDuplicar(pipeline.form, [CAMPO_CONTA_CORRENTE_OMIE]),
    list: { ...pipeline.list, columns: colunas },
    cardFields: adicionarSemDuplicar(pipeline.cardFields, [
      { field: "omieContaCorrenteId", label: "Conta corrente Omie" },
      { field: "omieStatusIntegracao", label: "🚦 Integração", format: "badge" },
      { field: "omieValorPago", label: "Pago", format: "currency" },
      { field: "omieValorPendente", label: "Pendente", format: "currency" },
    ]),
    ticketActions: [
      ...actions,
      acaoApi(
        "enviar-omie",
        "Enviar ao Omie",
        "/integracoes/omie/pagamentos/:id/enviar",
        {
          visibleWhen: { field: "etapa", equals: "Aprovado" },
          refresh: ["self", "parent", "all"],
        },
      ),
      acaoApi(
        "reconciliar-omie",
        "Atualizar do Omie",
        "/integracoes/omie/pagamentos/:id/reconciliar",
        {
          visibleWhen: { field: "codigoLancamentoIntegracao", exists: true },
          refresh: ["self", "parent", "all"],
        },
      ),
    ],
    ticketModal: pipeline.ticketModal
      ? {
        ...pipeline.ticketModal,
        tabs: [
          ...semAbaOmie,
          {
            id: "omie",
            label: "Integração Omie",
            type: "summary",
            cards: [
              {
                label: "Conta corrente selecionada",
                source: "field",
                field: "omieContaCorrenteId",
                format: "text",
              },
              {
                label: "Status",
                source: "field",
                field: "omieStatusIntegracao",
                format: "badge",
              },
              {
                label: "Título Omie",
                source: "field",
                field: "codigoLancamentoOmie",
                format: "number",
              },
              {
                label: "Categoria enviada",
                source: "field",
                field: "omieCodigoCategoriaEnviado",
                format: "text",
              },
              {
                label: "Conta corrente enviada",
                source: "field",
                field: "omieContaCorrenteEnviada",
                format: "number",
              },
              {
                label: "Valor do título",
                source: "field",
                field: "omieValorTitulo",
                format: "currency",
              },
              {
                label: "Valor pago",
                source: "field",
                field: "omieValorPago",
                format: "currency",
              },
              {
                label: "Valor pendente",
                source: "field",
                field: "omieValorPendente",
                format: "currency",
              },
              {
                label: "Última baixa",
                source: "field",
                field: "omieDataUltimaBaixa",
                format: "date",
              },
              {
                label: "Liquidado",
                source: "field",
                field: "omieLiquidado",
                format: "badge",
              },
              {
                label: "Última sincronização",
                source: "field",
                field: "omieUltimaSincronizacaoEm",
                format: "datetime",
              },
              {
                label: "Último erro",
                source: "field",
                field: "omieUltimoErro",
                format: "text",
              },
            ],
          },
        ],
      }
      : pipeline.ticketModal,
  };
}

function ajustarCollection(collection) {
  if (collection.model === "ClienteFornecedor") return ajustarClienteFornecedor(collection);
  if (collection.model === "Pagamento") return ajustarColecaoPagamento(collection);
  return collection;
}

function ajustarPipeline(pipeline) {
  if (pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto") {
    return ajustarEsteiraItens(pipeline);
  }
  if (pipeline.model === "Pagamento" || pipeline.name === "Pagamentos") {
    return ajustarEsteiraPagamentos(pipeline);
  }
  return pipeline;
}

export function aplicarIntegracaoOmie(manifest) {
  return {
    ...manifest,
    collections: (manifest.collections ?? []).map(ajustarCollection),
    pipelines: (manifest.pipelines ?? []).map(ajustarPipeline),
  };
}
