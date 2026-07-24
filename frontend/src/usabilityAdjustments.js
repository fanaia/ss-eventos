function removerEdicaoDaColuna(column) {
  if (typeof column === "string") return column;
  return {
    ...column,
    editable: undefined,
    editor: undefined,
    required: undefined,
  };
}

function pagamentosSomenteLeitura(tabs = []) {
  return tabs.map((tab) => {
    if (tab.id !== "pagamentos") return tab;
    return {
      ...tab,
      type: "readonlyGrid",
      editable: undefined,
      editMode: undefined,
      create: undefined,
      delete: undefined,
      columns: tab.columns?.map(removerEdicaoDaColuna),
    };
  });
}

function ajustarColecao(collection) {
  if (collection.model === "Projeto") {
    return {
      ...collection,
      detailModal: {
        ...collection.detailModal,
        // Novos projetos precisam começar pelo formulário obrigatório. A ação
        // de abertura dos registros existentes continua apontando para Resumo.
        defaultTab: "dados",
      },
    };
  }

  if (collection.model === "ProjetoItem") {
    return {
      ...collection,
      detailModal: collection.detailModal ? {
        ...collection.detailModal,
        tabs: pagamentosSomenteLeitura(collection.detailModal.tabs),
      } : collection.detailModal,
    };
  }

  return collection;
}

function ajustarEsteira(pipeline) {
  if (pipeline.model !== "ProjetoItem" && pipeline.name !== "ItensProjeto") return pipeline;
  return {
    ...pipeline,
    ticketModal: pipeline.ticketModal ? {
      ...pipeline.ticketModal,
      tabs: pagamentosSomenteLeitura(pipeline.ticketModal.tabs),
    } : pipeline.ticketModal,
  };
}

/** Ajustes de navegação e segurança visual específicos da SS Eventos. */
export function aplicarAjustesUsabilidade(manifest) {
  return {
    ...manifest,
    collections: manifest.collections?.map(ajustarColecao),
    pipelines: manifest.pipelines?.map(ajustarEsteira),
  };
}
