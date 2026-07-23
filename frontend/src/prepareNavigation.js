const COLECOES_EXCLUSIVAS_DE_ESTEIRA = new Set(["ProjetoItem", "Pagamento"]);

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
