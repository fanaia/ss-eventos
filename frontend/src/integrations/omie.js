import { aplicarComponentesIntegracao } from "./base.js";
import { aplicarIntegracaoOmie } from "../omieAdjustments.js";

const ACTION_ENDPOINTS = {
  "sincronizar-formas": "/integracoes/provedores/omie/recursos/meios-pagamento/sincronizar",
  "sincronizar-categorias": "/integracoes/provedores/omie/recursos/categorias/sincronizar",
  "sincronizar-clientes": "/integracoes/provedores/omie/recursos/clientes-prestadores/sincronizar",
  "processar-fila": "/integracoes/fila/processar",
  "reconciliar-financeiro": "/integracoes/provedores/omie/recursos/contas-pagar/sincronizar",
};

function useGenericIntegrationEndpoints(collection) {
  if (collection.model !== "OmieConfiguracao") return collection;
  const rowActions = (collection.list?.rowActions ?? []).map((action) => {
    const endpoint = ACTION_ENDPOINTS[action.id];
    return endpoint ? { ...action, endpoint } : action;
  });
  return {
    ...collection,
    list: {
      ...collection.list,
      rowActions,
    },
  };
}

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

export function aplicarIntegracaoOmieCompleta(manifest) {
  const withGenericComponents = aplicarComponentesIntegracao(
    manifest,
    OMIE_INTEGRATION_DEFINITION,
  );
  const withOmie = aplicarIntegracaoOmie(withGenericComponents);
  return {
    ...withOmie,
    collections: (withOmie.collections ?? []).map(useGenericIntegrationEndpoints),
  };
}
