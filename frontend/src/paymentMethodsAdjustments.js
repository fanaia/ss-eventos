const CAMPO_FORMA_PAGAMENTO = {
  field: "formaPagamentoId",
  label: "Forma de pagamento",
  kind: "ref",
  ref: "FormaPagamento",
  required: true,
  referenceFilters: { status: "Ativo" },
};

function colecaoFormasPagamento() {
  return {
    model: "FormaPagamento",
    mode: "dynamic",
    path: "/formas-pagamento",
    label: "Formas de Pagamento",
    section: "Configurações",
    form: [
      {
        field: "nome",
        group: "Identificação",
        groupLabel: "Identificação",
        inline: true,
      },
      {
        field: "status",
        group: "Identificação",
        inline: true,
      },
      {
        field: "padrao",
        label: "Forma padrão",
        widget: "checkbox",
        group: "Configuração",
        groupLabel: "Configuração",
        groupDescription: "A forma padrão será selecionada automaticamente ao gerar um pagamento.",
        inline: true,
      },
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
        {
          field: "padrao",
          label: "Forma padrão",
          type: "boolean",
        },
      ],
      columns: ["nome", "padrao", "status"],
    },
  };
}

function substituirCampoFormaPagamento(field) {
  if (field?.field !== "formaPagamento") return field;
  return { ...CAMPO_FORMA_PAGAMENTO };
}

function substituirNomeCampo(nome) {
  return nome === "formaPagamento" ? "formaPagamentoId" : nome;
}

function ajustarAcaoGerarPagamento(action) {
  if (action.id !== "gerar-pagamento") return action;
  return {
    ...action,
    fields: action.fields?.map(substituirCampoFormaPagamento),
  };
}

function ajustarColecao(collection) {
  if (collection.model !== "Pagamento") return collection;

  const filtros = collection.list?.filters ?? [];
  const possuiFiltro = filtros.some((filter) => filter.field === "formaPagamentoId");
  return {
    ...collection,
    list: {
      ...collection.list,
      filters: possuiFiltro
        ? filtros
        : [
          ...filtros.slice(0, 2),
          { field: "formaPagamentoId", label: "Forma de pagamento", type: "ref" },
          ...filtros.slice(2),
        ],
    },
  };
}

function ajustarEsteira(pipeline) {
  if (pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto") {
    return {
      ...pipeline,
      ticketActions: pipeline.ticketActions?.map(ajustarAcaoGerarPagamento),
    };
  }

  if (pipeline.model !== "Pagamento" && pipeline.name !== "Pagamentos") return pipeline;

  const filtros = pipeline.filters ?? [];
  const possuiFiltro = filtros.some((filter) => filter.field === "formaPagamentoId");
  return {
    ...pipeline,
    filters: possuiFiltro
      ? filtros
      : [
        ...filtros,
        { field: "formaPagamentoId", label: "Forma de pagamento", type: "ref" },
      ],
    form: pipeline.form?.map(substituirCampoFormaPagamento),
    ticketModal: pipeline.ticketModal ? {
      ...pipeline.ticketModal,
      tabs: pipeline.ticketModal.tabs?.map((tab) => tab.type !== "form" ? tab : {
        ...tab,
        groups: tab.groups?.map((group) => ({
          ...group,
          fields: group.fields.map(substituirNomeCampo),
        })),
        fields: tab.fields?.map(substituirNomeCampo),
      }),
    } : pipeline.ticketModal,
  };
}

/** Adiciona o cadastro e troca entradas livres por referências configuradas. */
export function aplicarFormasPagamento(manifest) {
  const collections = manifest.collections?.map(ajustarColecao) ?? [];
  if (!collections.some((collection) => collection.model === "FormaPagamento")) {
    collections.push(colecaoFormasPagamento());
  }

  return {
    ...manifest,
    collections,
    pipelines: manifest.pipelines?.map(ajustarEsteira),
  };
}
