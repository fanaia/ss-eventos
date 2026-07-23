const COLECOES_EXCLUSIVAS_DE_ESTEIRA = new Set(["ProjetoItem", "Pagamento"]);
const ORDEM_SECOES = new Map([
  ["Cadastros", 0],
  ["Operação", 1],
  ["Financeiro", 2],
  ["Configurações", 3],
]);

const CONFIGURACAO_COLECOES = {
  ClienteFornecedor: {
    label: "Clientes Fornecedores",
    section: "Cadastros",
  },
  Projeto: {
    label: "Projetos",
    section: "Operação",
  },
  Categoria: {
    label: "Categorias/SubCategorias",
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
    return {
      ...pipeline,
      label: "Itens",
      section: "Operação",
    };
  }

  if (pipeline.model === "Pagamento" || pipeline.name === "Pagamentos") {
    return {
      ...pipeline,
      label: "Pagamentos",
      section: "Financeiro",
    };
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
 * Organiza a navegação automática sem remover as rotas operacionais.
 *
 * Itens e Pagamentos aparecem somente pelas respectivas esteiras. As coleções
 * continuam declaradas no manifesto-fonte e são usadas durante a preparação
 * anterior para reaproveitar formulários, relações e modais.
 *
 * @param {Record<string, any>} manifest
 * @returns {Record<string, any>}
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