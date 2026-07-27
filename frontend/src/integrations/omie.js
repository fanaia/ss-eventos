import { aplicarComponentesIntegracao } from "./base.js";
import { aplicarIntegracaoOmie } from "../omieAdjustments.js";

const CONFIGURATION_PAGE = Object.freeze({
  id: "configuracao-omie",
  path: "/configuracoes",
  label: "Configurações",
  title: "Integração Omie",
  section: "Configurações",
  component: "custom:OmieIntegrationPage",
  permissions: ["desenvolvedor"],
  order: 900,
});

export const OMIE_INTEGRATION_DEFINITION = Object.freeze({
  provider: "omie",
  providerLabel: "Omie",
  configurationModel: "OmieConfiguracao",
  resources: [
    "clientes-prestadores",
    "categorias",
    "meios-pagamento",
    "contas-pagar",
  ],
});

function withConfigurationPage(manifest) {
  const pages = [...(manifest.pages ?? [])]
    .filter((page) => page.id !== CONFIGURATION_PAGE.id && page.path !== CONFIGURATION_PAGE.path);
  pages.push(CONFIGURATION_PAGE);

  return {
    ...manifest,
    pages,
    collections: (manifest.collections ?? []).filter(
      (collection) => collection.model !== OMIE_INTEGRATION_DEFINITION.configurationModel,
    ),
  };
}

export function aplicarIntegracaoOmieCompleta(manifest) {
  const withGenericComponents = aplicarComponentesIntegracao(
    manifest,
    OMIE_INTEGRATION_DEFINITION,
  );
  const withOmie = aplicarIntegracaoOmie(withGenericComponents);
  return withConfigurationPage(withOmie);
}
