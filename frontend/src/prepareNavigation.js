const COLECOES_EXCLUSIVAS_DE_ESTEIRA = new Set([
  "ProjetoItem",
  "Pagamento",
  "IntegrationOutbox",
  "WebhookInbox",
  "OmieBaixaPagamento",
]);

const ORDEM_SECOES = new Map([
  ["Cadastros", 0],
  ["Operação", 1],
  ["Financeiro", 2],
  ["Integrações", 3],
  ["Configurações", 4],
]);

const CONFIGURACAO_COLECOES = {
  ClienteFornecedor: {
    label: "Clientes/Prestadores",
    section: "Cadastros",
  },
  Projeto: {
    label: "Projetos",
    section: "Operação",
  },
  Categoria: {
    label: "Categorias/Subcategorias",
    section: "Configurações",
  },
  Responsavel: {
    label: "Responsáveis",
    section: "Configurações",
  },
};

function configurarColecao(collection) {
  const configuracao = CONFIGURACAO_COLECOES[collection.model];
  return configuracao ? { ...collection, ...configuracao } : collection;
}

function configurarEsteira(pipeline) {
  if (pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto") {
    return { ...pipeline, label: "Itens", section: "Operação" };
  }

  if (pipeline.model === "Pagamento" || pipeline.name === "Pagamentos") {
    return { ...pipeline, label: "Pagamentos", section: "Financeiro" };
  }

  if (["IntegrationOutbox", "WebhookInbox"].includes(pipeline.model)) {
    return { ...pipeline, section: "Integrações" };
  }

  return pipeline;
}

export function ordenarViewsPorSecao(views = []) {
  return views
    .map((view, index) => ({ view, index }))
    .sort((a, b) => {
      const ordemA = ORDEM_SECOES.get(a.view.section) ?? 100;
      const ordemB = ORDEM_SECOES.get(b.view.section) ?? 100;
      return ordemA - ordemB || a.index - b.index;
    })
    .map(({ view }) => view);
}

/**
 * Configurações concentra apenas cadastros internos. Integrações concentra a
 * operação Omie, a fila e os eventos recebidos, sem expor coleções técnicas.
 */
export function prepararNavegacao(manifest) {
  return {
    ...manifest,
    collections: manifest.collections
      ?.filter((collection) => !COLECOES_EXCLUSIVAS_DE_ESTEIRA.has(collection.model))
      .map(configurarColecao),
    pipelines: manifest.pipelines?.map(configurarEsteira),
  };
}
