const MODELOS_INTERNOS = new Set(["Estado", "Cidade", "Contato"]);

const CAMPOS_FINANCEIROS_ITEM = new Set([
  "orcamentoQuantidade",
  "orcamentoDiarias",
  "orcamentoValorUnitario",
  "orcamentoTotal",
  "orcamentoTotalSemImpostos",
  "orcamentoFee",
  "orcamentoImposto",
  "orcamentoTotalComImpostoFee",
  "contratacaoQuantidade",
  "contratacaoDiarias",
  "contratacaoValorUnitario",
  "contratacaoTotal",
  "fechamentoQuantidade",
  "fechamentoDiarias",
  "fechamentoValorUnitario",
  "fechamentoValor",
  "fechamentoTotalSemImpostos",
  "fechamentoFee",
  "fechamentoImposto",
  "fechamentoTotal",
  "fechamentoTotalComImpostoFee",
  "fechamentoLucroValor",
  "fechamentoLucroPercentual",
  "fechamentoObservacao",
]);

function campoFinanceiro(field, group, groupLabel, opcoes = {}) {
  return {
    field,
    group,
    ...(groupLabel ? { groupLabel } : {}),
    inline: opcoes.inline ?? true,
    ...(opcoes.readonly
      ? { readonly: true, readOnly: true, disabled: true }
      : {}),
  };
}

function formularioItem(form = []) {
  const base = form.filter((config) => !CAMPOS_FINANCEIROS_ITEM.has(config.field));

  return [
    ...base,
    campoFinanceiro("orcamentoQuantidade", "Valores Orçamento", "Valores Orçamento"),
    campoFinanceiro("orcamentoDiarias", "Valores Orçamento"),
    campoFinanceiro("orcamentoValorUnitario", "Valores Orçamento"),
    campoFinanceiro("orcamentoTotal", "Valores Orçamento", undefined, { readonly: true }),

    campoFinanceiro("contratacaoQuantidade", "Valores Contratação", "Valores Contratação"),
    campoFinanceiro("contratacaoDiarias", "Valores Contratação"),
    campoFinanceiro("contratacaoValorUnitario", "Valores Contratação"),
    campoFinanceiro("contratacaoTotal", "Valores Contratação", undefined, { readonly: true }),

    campoFinanceiro("fechamentoValor", "Fechamento Calculado", "Fechamento Calculado", { readonly: true }),
    campoFinanceiro("fechamentoFee", "Fechamento Calculado", undefined, { readonly: true }),
    campoFinanceiro("fechamentoImposto", "Fechamento Calculado", undefined, { readonly: true }),
    campoFinanceiro("fechamentoTotal", "Fechamento Calculado", undefined, { readonly: true }),
    campoFinanceiro("fechamentoLucroValor", "Lucro", "Lucro", { readonly: true }),
    campoFinanceiro("fechamentoLucroPercentual", "Lucro", undefined, { readonly: true }),
    campoFinanceiro("fechamentoObservacao", "Observação", "Observação", { inline: false }),
  ];
}

function modalItem(ticketModal = {}) {
  return {
    ...ticketModal,
    enabled: true,
    titleField: "nome",
    size: "full",
    defaultTab: "dados",
    tabs: [
      {
        id: "dados",
        label: "Dados do item",
        type: "form",
        groups: [
          { label: "Identificação", fields: ["projetoId", "nome", "descricao"], columns: 2 },
          {
            label: "Classificação",
            fields: ["faturamento", "tipoCusto", "etapa", "responsavelId"],
            columns: 4,
          },
          {
            label: "Local e Categoria",
            fields: ["estadoId", "cidadeId", "categoriaId", "subcategoriaId"],
            columns: 4,
          },
        ],
      },
      {
        id: "orcamento",
        label: "Orçamento",
        type: "form",
        groups: [
          {
            label: "Valores do orçamento",
            fields: [
              "orcamentoQuantidade",
              "orcamentoDiarias",
              "orcamentoValorUnitario",
              "orcamentoTotal",
            ],
            columns: 4,
          },
        ],
      },
      {
        id: "contratacao",
        label: "Contratação",
        type: "form",
        groups: [
          {
            label: "Valores da contratação",
            fields: [
              "contratacaoQuantidade",
              "contratacaoDiarias",
              "contratacaoValorUnitario",
              "contratacaoTotal",
            ],
            columns: 4,
          },
        ],
      },
      {
        id: "pagamentos",
        label: "Pagamento",
        type: "relatedGrid",
        relation: "pagamentos",
        editable: true,
        editMode: "inline",
        columns: [
          {
            field: "dataPrevisaoPagamento",
            format: "date",
            editable: true,
            editor: "date",
            required: true,
          },
          { field: "formaPagamento", editable: true },
          {
            field: "valor",
            format: "currency",
            editable: true,
            editor: "currency",
            required: true,
          },
          {
            field: "responsavelPagamentoId",
            label: "Responsável",
            editable: true,
            editor: "ref",
            required: true,
          },
          { field: "nfRecebida", editable: true, editor: "boolean" },
          {
            field: "etapa",
            format: "badge",
            editable: true,
            editor: "enum",
            required: true,
          },
        ],
      },
      {
        id: "fechamento",
        label: "Fechamento",
        type: "form",
        groups: [
          {
            label: "Fechamento calculado",
            fields: [
              "fechamentoValor",
              "fechamentoFee",
              "fechamentoImposto",
              "fechamentoTotal",
            ],
            columns: 4,
          },
          {
            label: "Lucro",
            fields: ["fechamentoLucroValor", "fechamentoLucroPercentual"],
            columns: 2,
          },
          {
            label: "Observação",
            fields: ["fechamentoObservacao"],
            columns: 1,
          },
        ],
      },
    ],
  };
}

function acaoGerarPagamento() {
  return {
    id: "gerar-pagamento",
    label: "Gerar pagamento",
    type: "formAction",
    title: "Gerar pagamento",
    loadEndpoint: "/projetos-itens/:id/pagamento-pendente",
    endpoint: "/projetos-itens/:id/gerar-pagamento",
    method: "POST",
    disabledWhen: { field: "contratacaoTotal", lte: 0 },
    refresh: ["all", "pagamentos", "fechamento"],
    fields: [
      { field: "dataPrevisaoPagamento", label: "Data prevista", kind: "date", required: true },
      { field: "formaPagamento", label: "Forma de pagamento", kind: "string", required: true },
      { field: "valor", label: "Valor", kind: "currency", required: true },
      { field: "responsavelPagamentoId", label: "Responsável", kind: "ref", ref: "Responsavel", required: true },
      { field: "nfRecebida", label: "NF recebida", kind: "boolean" },
    ],
  };
}

function configurarAbaProjeto(tab) {
  if (tab.id === "resumo") {
    const cards = (tab.cards ?? [])
      .filter((card) => !["orcamentoTotalComImpostoFee", "fechamentoTotalComImpostoFee"].includes(card.field))
      .map((card) => card);

    const indicePagamentos = cards.findIndex((card) => card.field === "valor");
    const financeiros = [
      {
        label: "Total Orçado",
        source: "relatedSum",
        relation: "itens",
        field: "orcamentoTotal",
        format: "currency",
      },
      {
        label: "Total Contratado",
        source: "relatedSum",
        relation: "itens",
        field: "contratacaoTotal",
        format: "currency",
      },
      {
        label: "Total Fechado",
        source: "relatedSum",
        relation: "itens",
        field: "fechamentoTotal",
        format: "currency",
      },
    ];

    return {
      ...tab,
      cards: indicePagamentos >= 0
        ? [...cards.slice(0, indicePagamentos), ...financeiros, ...cards.slice(indicePagamentos)]
        : [...cards, ...financeiros],
    };
  }

  if (tab.id === "itens") {
    return {
      ...tab,
      type: "readonlyGrid",
      editable: undefined,
      editMode: undefined,
      columns: [
        "nome",
        "faturamento",
        "categoriaId",
        "subcategoriaId",
        "tipoCusto",
        "etapa",
        "responsavelId",
        { field: "orcamentoTotal", label: "Total Orçado", format: "currency" },
        { field: "contratacaoTotal", label: "Total Contratado", format: "currency" },
        { field: "fechamentoTotal", label: "Total Fechado", format: "currency" },
        { field: "fechamentoLucroValor", label: "Lucro", format: "currency" },
      ],
    };
  }

  if (tab.id === "pagamentos") {
    return {
      ...tab,
      type: "readonlyGrid",
      editable: undefined,
      editMode: undefined,
      columns: tab.columns?.map((column) => typeof column === "string" ? column : {
        ...column,
        editable: undefined,
        editor: undefined,
      }),
    };
  }

  return tab;
}

function configurarColecao(collection, pipelineItensProjeto) {
  if (collection.model === "Categoria") {
    return { ...collection, section: "Configurações" };
  }

  if (collection.model === "ClienteFornecedor") {
    return {
      ...collection,
      detailModal: {
        ...collection.detailModal,
        tabs: collection.detailModal?.tabs?.map((tab) => tab.id !== "contatos" ? tab : {
          ...tab,
          create: {
            enabled: true,
            label: "Novo contato",
            fields: [
              { field: "cargo", label: "Cargo", kind: "string" },
              { field: "nome", label: "Nome", kind: "string", required: true },
              { field: "telefone", label: "Telefone", kind: "string" },
              { field: "email", label: "E-mail", kind: "string" },
              { field: "status", label: "Status", kind: "enum", options: ["Ativo", "Inativo"], required: true },
            ],
            initialValues: { status: "Ativo" },
          },
          delete: {
            enabled: true,
            confirm: "Excluir este contato? Contatos usados como contato principal de um projeto não poderão ser excluídos.",
          },
        }),
      },
    };
  }

  if (collection.model === "Projeto") {
    return {
      ...collection,
      detailModal: {
        ...collection.detailModal,
        tabs: collection.detailModal?.tabs?.map(configurarAbaProjeto),
      },
    };
  }

  if (collection.model === "ProjetoItem" && pipelineItensProjeto?.ticketModal) {
    return {
      ...collection,
      form: formularioItem(pipelineItensProjeto.form ?? collection.form),
      relations: {
        ...(collection.relations ?? {}),
        ...(pipelineItensProjeto.relations ?? {}),
      },
      detailModal: modalItem(pipelineItensProjeto.ticketModal),
    };
  }

  return collection;
}

function configurarEsteira(pipeline) {
  if (pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto") {
    return {
      ...pipeline,
      form: formularioItem(pipeline.form),
      ticketModal: modalItem(pipeline.ticketModal),
      filters: [
        { field: "projetoId", label: "Projeto", type: "ref" },
        { field: "responsavelId", label: "Responsável", type: "ref" },
      ],
      create: {
        enabled: true,
        label: "Novo item",
        initialTab: "dados",
        defaultStage: "Pendente",
        defaultValues: { statusTrabalho: "Aguardando início" },
      },
      viewModes: ["board", "list"],
      defaultView: "board",
      list: {
        columns: [
          "projetoId",
          "nome",
          "faturamento",
          "tipoCusto",
          "etapa",
          "statusTrabalho",
          "responsavelId",
          { field: "orcamentoTotal", label: "Total Orçado", kind: "currency" },
          { field: "contratacaoTotal", label: "Total Contratado", kind: "currency" },
          { field: "fechamentoTotal", label: "Total Fechado", kind: "currency" },
          { field: "fechamentoLucroValor", label: "Lucro", kind: "currency" },
        ],
      },
      // Aprovar, Recusar e status de trabalho são fornecidos pelo OonCore.
      ticketActions: [acaoGerarPagamento()],
    };
  }

  if (pipeline.model === "Pagamento" || pipeline.name === "Pagamentos") {
    return {
      ...pipeline,
      titleField: "formaPagamento",
      filters: [
        { field: "projetoId", label: "Projeto", type: "ref" },
        { field: "responsavelPagamentoId", label: "Responsável", type: "ref" },
      ],
      viewModes: ["board", "list"],
      defaultView: "board",
      list: {
        columns: [
          "projetoId",
          "projetoItemId",
          "dataPrevisaoPagamento",
          "formaPagamento",
          { field: "valor", label: "Valor", kind: "currency" },
          "responsavelPagamentoId",
          "nfRecebida",
          "etapa",
          "statusTrabalho",
        ],
      },
      form: [
        { field: "projetoId" },
        { field: "projetoItemId" },
        { field: "dataPrevisaoPagamento" },
        { field: "formaPagamento" },
        { field: "valor" },
        { field: "responsavelPagamentoId" },
        { field: "nfRecebida" },
        { field: "etapa" },
        { field: "statusTrabalho" },
      ],
      ticketModal: {
        enabled: true,
        titleField: "formaPagamento",
        size: "xl",
        defaultTab: "dados",
        tabs: [
          {
            id: "dados",
            label: "Dados do pagamento",
            type: "form",
            groups: [
              { label: "Vínculo", fields: ["projetoId", "projetoItemId"], columns: 2 },
              { label: "Pagamento", fields: ["dataPrevisaoPagamento", "formaPagamento", "valor", "responsavelPagamentoId"], columns: 2 },
              { label: "Processo", fields: ["nfRecebida", "etapa", "statusTrabalho"], columns: 3 },
            ],
          },
        ],
      },
      // Sem ticketActions: o Core habilita aprovação e status de trabalho.
    };
  }

  return pipeline;
}

/** Prepara o manifesto efetivamente entregue ao OonCore. */
export function prepararManifesto(manifest) {
  const pipelineItensProjeto = manifest.pipelines?.find(
    (pipeline) => pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto",
  );

  return {
    ...manifest,
    collections: manifest.collections
      ?.filter((collection) => !MODELOS_INTERNOS.has(collection.model))
      .map((collection) => configurarColecao(collection, pipelineItensProjeto)),
    pipelines: manifest.pipelines?.map(configurarEsteira),
  };
}
