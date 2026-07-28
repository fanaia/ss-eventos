import { aplicarComponentesIntegracao } from "./base.js";
import { aplicarIntegracaoOmie } from "../omieAdjustments.js";

const OMIE_PAGE = Object.freeze({
  id: "integracao-omie",
  path: "/integracoes/omie",
  label: "Omie",
  title: "Integração Omie",
  section: "Integrações",
  component: "custom:OmieIntegrationPage",
  permissions: ["admin", "desenvolvedor"],
  order: 90,
});

export const OMIE_INTEGRATION_DEFINITION = Object.freeze({
  provider: "omie",
  providerLabel: "Omie",
  configurationModel: "OmieConfiguracao",
  resources: [
    "categorias",
    "contas-correntes",
    "clientes-prestadores",
    "contas-pagar",
  ],
});

function fieldName(field) {
  return typeof field === "string" ? field : field?.field;
}

function addFields(current = [], fields = []) {
  const existing = new Set(current.map(fieldName));
  return [...current, ...fields.filter((field) => !existing.has(fieldName(field)))];
}

function addColumns(current = [], columns = []) {
  const existing = new Set(current.map(fieldName));
  return [...current, ...columns.filter((column) => !existing.has(fieldName(column)))];
}

const OMIE_CATEGORY_FIELD = {
  field: "omieCategoriaId",
  label: "Categoria Omie",
  kind: "ref",
  ref: "OmieCategoria",
  group: "Integração Omie",
  groupLabel: "Integração Omie",
  referenceFilters: {
    status: "Ativo",
    contaInativa: false,
    totalizadora: false,
    transferencia: false,
    naoExibir: false,
  },
};

const OMIE_ACCOUNT_FIELD = {
  field: "omieContaCorrenteId",
  label: "Conta corrente Omie",
  kind: "ref",
  ref: "OmieContaCorrente",
  group: "Integração Omie",
  referenceFilters: {
    status: "Ativo",
    inativa: false,
    bloqueada: false,
  },
};

function configureCategory(collection) {
  if (collection.model !== "Categoria") return collection;

  const originalTabs = collection.detailModal?.tabs ?? [];
  const tabsWithoutIntegration = originalTabs.filter(
    (tab) => tab.id !== "omie" && tab.id !== "dados",
  );

  return {
    ...collection,
    section: "Configurações",
    form: addFields(collection.form, [
      OMIE_CATEGORY_FIELD,
      OMIE_ACCOUNT_FIELD,
    ]),
    list: {
      ...collection.list,
      columns: addColumns(collection.list?.columns, [
        { field: "omieCategoriaId", label: "Categoria Omie" },
        { field: "omieContaCorrenteId", label: "Conta corrente Omie" },
      ]),
      rowActions: collection.list?.rowActions?.length
        ? collection.list.rowActions
        : [{
          type: "openDetailModal",
          label: "Editar",
          icon: "edit",
          initialTab: "dados",
        }],
    },
    detailModal: {
      ...(collection.detailModal ?? {}),
      enabled: true,
      titleField: "nome",
      size: "xl",
      defaultTab: "dados",
      tabs: [
        {
          id: "dados",
          label: "Dados",
          type: "form",
          groups: [
            {
              label: "Categoria/Subcategoria",
              fields: ["nome", "categoriaPaiId", "descricao", "status"],
              columns: 2,
            },
          ],
        },
        ...tabsWithoutIntegration,
        {
          id: "omie",
          label: "Integração Omie",
          type: "form",
          groups: [
            {
              label: "Mapeamento financeiro",
              description:
                "Selecione a Categoria Omie e a Conta Corrente Omie usadas ao enviar Contas a Pagar. A subcategoria tem prioridade sobre a categoria pai.",
              fields: ["omieCategoriaId", "omieContaCorrenteId"],
              columns: 2,
            },
          ],
        },
      ],
    },
  };
}

function withOmieNavigation(manifest) {
  const pages = [...(manifest.pages ?? [])]
    .filter((page) => page.id !== "configuracao-omie" && page.id !== OMIE_PAGE.id)
    .filter((page) => page.path !== "/configuracoes" && page.path !== OMIE_PAGE.path);
  pages.push(OMIE_PAGE);

  const hiddenTechnicalCollections = new Set([
    "OmieConfiguracao",
    "OmieCategoria",
    "OmieContaCorrente",
    "FormaPagamento",
    "IntegrationExecution",
  ]);

  return {
    ...manifest,
    pages,
    collections: (manifest.collections ?? [])
      .filter((collection) => !hiddenTechnicalCollections.has(collection.model))
      .map(configureCategory),
  };
}

export function aplicarIntegracaoOmieCompleta(manifest) {
  const withGenericComponents = aplicarComponentesIntegracao(
    manifest,
    OMIE_INTEGRATION_DEFINITION,
  );
  const withOmie = aplicarIntegracaoOmie(withGenericComponents);
  return withOmieNavigation(withOmie);
}
