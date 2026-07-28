const CAMPOS_REMOVIDOS = new Set(["formaPagamento", "formaPagamentoId"]);

function nomeCampo(campo) {
  return typeof campo === "string" ? campo : campo?.field;
}

function semCamposRemovidos(campos = []) {
  return campos.filter((campo) => !CAMPOS_REMOVIDOS.has(nomeCampo(campo)));
}

function limparGrupo(grupo) {
  return {
    ...grupo,
    fields: semCamposRemovidos(grupo.fields),
  };
}

function limparAba(aba) {
  return {
    ...aba,
    fields: semCamposRemovidos(aba.fields),
    columns: semCamposRemovidos(aba.columns),
    groups: aba.groups?.map(limparGrupo),
    create: aba.create
      ? { ...aba.create, fields: semCamposRemovidos(aba.create.fields) }
      : aba.create,
  };
}

function limparModal(modal) {
  return modal
    ? { ...modal, tabs: modal.tabs?.map(limparAba) }
    : modal;
}

function limparLista(lista) {
  return lista
    ? {
      ...lista,
      columns: semCamposRemovidos(lista.columns),
      filters: semCamposRemovidos(lista.filters),
    }
    : lista;
}

function limparAcao(acao) {
  return {
    ...acao,
    fields: semCamposRemovidos(acao.fields),
  };
}

function limparColecao(collection) {
  return {
    ...collection,
    form: semCamposRemovidos(collection.form),
    list: limparLista(collection.list),
    detailModal: limparModal(collection.detailModal),
  };
}

function limparEsteira(pipeline) {
  return {
    ...pipeline,
    form: semCamposRemovidos(pipeline.form),
    filters: semCamposRemovidos(pipeline.filters),
    cardFields: semCamposRemovidos(pipeline.cardFields),
    list: limparLista(pipeline.list),
    ticketActions: pipeline.ticketActions?.map(limparAcao),
    ticketModal: limparModal(pipeline.ticketModal),
  };
}

export function removerCamposFormaPagamento(manifest) {
  return {
    ...manifest,
    collections: (manifest.collections ?? [])
      .filter((collection) => collection.model !== "FormaPagamento")
      .map(limparColecao),
    pipelines: (manifest.pipelines ?? []).map(limparEsteira),
  };
}
