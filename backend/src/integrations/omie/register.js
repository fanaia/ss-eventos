"use strict";

const { registerIntegrationProvider } = require("../registry");
const { runTrackedSynchronization } = require("../history");
const { OmieApiError } = require("../../services/omieClient");
const {
  atualizarDashboardIntegracoes,
  processarWebhooksPendentes,
} = require("../../services/omieIntegration");
const { alterarClienteNoOmie } = require("../../services/omieClienteAlteracao");
const {
  conciliarPagamentoAutomatico,
  enviarPagamentoAutomatico,
  reconciliarPagamentosAutomaticos,
} = require("../../services/omiePagamentoAutomatico");
const {
  importarCategorias,
  importarClientes,
  importarContasCorrentes,
} = require("../../services/omieMasterData");

function tracked(resource, title, runner) {
  return (_event, options = {}) => runTrackedSynchronization({
    provider: "omie",
    resource,
    operation: "sync",
    title,
    metadata: {
      source: options.source || "worker",
      requestId: options.requestId || "",
    },
    runner: (executionContext) => runner({
      ...options,
      ...executionContext,
    }),
  });
}

const provider = registerIntegrationProvider({
  key: "omie",
  label: "Omie",
  description: "ERP transacional integrado à Central SS Eventos.",
  enabled: () => process.env.OMIE_ENABLED === "true",
  maxAttempts: 5,
  isRetryable(error) {
    if (error instanceof OmieApiError) return error.retryable;
    if (error?.statusCode && Number(error.statusCode) < 500) return false;
    return error?.retryable !== false;
  },
  refreshDashboard: atualizarDashboardIntegracoes,
  resources: [
    {
      key: "categorias",
      label: "Categorias Omie",
      description: "Lista financeira somente leitura usada nas categorias e subcategorias da Central.",
      syncHandler: "OMIE_CATEGORIAS_IMPORTAR",
      endpoint: "/integracoes/provedores/omie/recursos/categorias/sincronizar",
      actionLabel: "Sincronizar categorias",
      includeInFullSync: true,
      order: 10,
    },
    {
      key: "contas-correntes",
      label: "Contas correntes Omie",
      description: "Lista somente leitura usada na seleção da conta corrente de cada pagamento.",
      syncHandler: "OMIE_CONTAS_CORRENTES_IMPORTAR",
      endpoint: "/integracoes/provedores/omie/recursos/contas-correntes/sincronizar",
      actionLabel: "Sincronizar contas",
      includeInFullSync: true,
      order: 20,
    },
    {
      key: "clientes-prestadores",
      label: "Clientes / Prestadores",
      description: "Cadastros sincronizados pelo endpoint oficial de Clientes e Fornecedores do Omie.",
      syncHandler: "OMIE_CLIENTES_IMPORTAR",
      endpoint: "/integracoes/provedores/omie/recursos/clientes-prestadores/sincronizar",
      actionLabel: "Sincronizar cadastros",
      includeInFullSync: true,
      order: 30,
    },
    {
      key: "contas-pagar",
      label: "Contas a pagar",
      description: "Consulta e reconciliação dos pagamentos enviados ao Omie.",
      syncHandler: "OMIE_FINANCEIRO_RECONCILIAR",
      endpoint: "/integracoes/provedores/omie/recursos/contas-pagar/sincronizar",
      actionLabel: "Reconciliar pagamentos",
      includeInFullSync: false,
      order: 40,
    },
  ],
  handlers: {
    OMIE_CLIENTE_ALTERAR: (event, options) => alterarClienteNoOmie(
      event.aggregateId || event.payload?.clienteFornecedorId,
      options,
    ),
    OMIE_CATEGORIAS_IMPORTAR: tracked(
      "categorias",
      "Sincronização de categorias Omie",
      importarCategorias,
    ),
    OMIE_CONTAS_CORRENTES_IMPORTAR: tracked(
      "contas-correntes",
      "Sincronização de contas correntes Omie",
      importarContasCorrentes,
    ),
    OMIE_CLIENTES_IMPORTAR: tracked(
      "clientes-prestadores",
      "Sincronização de clientes e prestadores",
      importarClientes,
    ),
    OMIE_CONTA_PAGAR_UPSERT: (event, options) => enviarPagamentoAutomatico(
      event.aggregateId || event.payload?.pagamentoId,
      options,
    ),
    OMIE_CONTA_PAGAR_CONSULTAR: (event, options) => conciliarPagamentoAutomatico(
      event.aggregateId || event.payload?.pagamentoId,
      options,
    ),
    OMIE_FINANCEIRO_RECONCILIAR: tracked(
      "contas-pagar",
      "Reconciliação de contas a pagar",
      reconciliarPagamentosAutomaticos,
    ),
    OMIE_WEBHOOK_PROCESSAR: (event, options) => processarWebhooksPendentes({
      ...options,
      webhookInboxId: event.aggregateId || event.payload?.webhookInboxId,
    }),
  },
});

module.exports = provider;
