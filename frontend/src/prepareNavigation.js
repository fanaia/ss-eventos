const COLECOES_EXCLUSIVAS_DE_ESTEIRA = new Set([
  "ProjetoItem",
  "Pagamento",
  "IntegrationOutbox",
  "WebhookInbox",
  "OmieBaixaPagamento",
]);

const SETTINGS_HOME_PAGE = Object.freeze({
  id: "configuracoes-home",
  path: "/configuracoes",
  label: "Configurações",
  title: "Configurações",
  section: "Configurações",
  component: "custom:SettingsHomePage",
  permissions: ["admin", "desenvolvedor"],
  order: 999,
});

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

function configurarPaginas(pages = []) {
  return [
    ...pages.filter(
      (page) => page.id !== SETTINGS_HOME_PAGE.id && page.path !== SETTINGS_HOME_PAGE.path,
    ),
    SETTINGS_HOME_PAGE,
  ];
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
 * O menu principal mantém somente Cadastros, Operação e Financeiro.
 * Categorias, Responsáveis, Integrações e Auditoria continuam com rotas próprias,
 * mas são acessados pela Home de Configurações aberta pelo cabeçalho.
 */
export function prepararNavegacao(manifest) {
  return {
    ...manifest,
    pages: configurarPaginas(manifest.pages),
    collections: manifest.collections
      ?.filter((collection) => !COLECOES_EXCLUSIVAS_DE_ESTEIRA.has(collection.model))
      .map(configurarColecao),
    pipelines: manifest.pipelines?.map(configurarEsteira),
  };
}

export {
  CONFIGURACAO_COLECOES,
  SETTINGS_HOME_PAGE,
};
