const MODELOS_INTERNOS = new Set(["Estado", "Cidade", "Contato"]);

const STATUS_TRABALHO = ["Aguardando início", "Trabalhando", "Revisar"];

function acaoStatusTrabalho(valor) {
  return {
    id: `status-trabalho-${valor.toLowerCase().replace(/\s+/g, "-")}`,
    label: valor,
    type: "setField",
    field: "statusTrabalho",
    value: valor,
    disabledWhen: { field: "statusTrabalho", equals: valor },
    refresh: ["all"],
  };
}

function transicao(id, label, de, para) {
  return {
    id,
    label,
    type: "transition",
    field: "etapa",
    value: para,
    hiddenWhen: { field: "etapa", notEquals: de },
    confirm: { description: `${label} este ticket e alterar a etapa para ${para}?` },
    refresh: ["all"],
  };
}

function acoesItens() {
  return [
    transicao("aprovar-pendente", "Aprovar", "Pendente", "Em negociação"),
    transicao("aprovar-negociacao", "Aprovar", "Em negociação", "Solicitado"),
    transicao("aprovar-solicitado", "Aprovar", "Solicitado", "Em andamento"),
    transicao("aprovar-andamento", "Aprovar", "Em andamento", "Concluído"),
    transicao("recusar-negociacao", "Recusar", "Em negociação", "Pendente"),
    transicao("recusar-solicitado", "Recusar", "Solicitado", "Em negociação"),
    transicao("recusar-andamento", "Recusar", "Em andamento", "Solicitado"),
    transicao("recusar-concluido", "Recusar", "Concluído", "Em andamento"),
    ...STATUS_TRABALHO.map(acaoStatusTrabalho),
    {
      id: "gerar-pagamento",
      label: "Gerar pagamento",
      type: "formAction",
      title: "Gerar pagamento",
      loadEndpoint: "/projetos-itens/:id/pagamento-pendente",
      endpoint: "/projetos-itens/:id/gerar-pagamento",
      method: "POST",
      disabledWhen: { field: "fechamentoTotalComImpostoFee", lte: 0 },
      refresh: ["all", "pagamentos", "totais"],
      fields: [
        { field: "dataPrevisaoPagamento", label: "Data prevista", kind: "date", required: true },
        { field: "formaPagamento", label: "Forma de pagamento", kind: "string", required: true },
        { field: "valor", label: "Valor", kind: "currency", required: true },
        { field: "responsavelPagamentoId", label: "Responsável", kind: "ref", ref: "Responsavel", required: true },
        { field: "nfRecebida", label: "NF recebida", kind: "boolean" },
      ],
    },
  ];
}

function acoesPagamentos() {
  return [
    transicao("aprovar-solicitado", "Aprovar", "Solicitado", "Aprovado"),
    transicao("aprovar-aprovado", "Aprovar", "Aprovado", "Aguardando NF"),
    transicao("aprovar-nf", "Aprovar", "Aguardando NF", "Enviado para Omie"),
    transicao("aprovar-omie", "Aprovar", "Enviado para Omie", "Pagamento Ok"),
    transicao("recusar-aprovado", "Recusar", "Aprovado", "Solicitado"),
    transicao("recusar-nf", "Recusar", "Aguardando NF", "Aprovado"),
    transicao("recusar-omie", "Recusar", "Enviado para Omie", "Aguardando NF"),
    transicao("recusar-ok", "Recusar", "Pagamento Ok", "Enviado para Omie"),
    ...STATUS_TRABALHO.map(acaoStatusTrabalho),
  ];
}

function somenteLeitura(tab) {
  if (!["itens", "pagamentos"].includes(tab.id)) return tab;
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
        tabs: collection.detailModal?.tabs?.map(somenteLeitura),
      },
    };
  }

  if (collection.model === "ProjetoItem" && pipelineItensProjeto?.ticketModal) {
    return {
      ...collection,
      form: pipelineItensProjeto.form ?? collection.form,
      relations: {
        ...(collection.relations ?? {}),
        ...(pipelineItensProjeto.relations ?? {}),
      },
      detailModal: {
        ...pipelineItensProjeto.ticketModal,
        enabled: true,
      },
    };
  }

  return collection;
}

function configurarEsteira(pipeline) {
  if (pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto") {
    return {
      ...pipeline,
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
          { field: "orcamentoTotalComImpostoFee", label: "Total Orçado", kind: "currency" },
          { field: "fechamentoTotalComImpostoFee", label: "Total Fechado", kind: "currency" },
        ],
      },
      ticketActions: acoesItens(),
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
      ticketActions: acoesPagamentos(),
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
