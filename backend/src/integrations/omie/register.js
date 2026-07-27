"use strict";

const { registerIntegrationProvider } = require("../registry");
const { runTrackedSynchronization } = require("../history");
const { OmieApiError } = require("../../services/omieClient");
const {
  atualizarDashboardIntegracoes,
  consultarContaPagar,
  enviarContaPagar,
  importarCategorias,
  importarClientes,
  importarFormasPagamento,
  processarWebhooksPendentes,
  reconciliarFinanceiro,
  sincronizarCliente,
} = require("../../services/omieIntegration");

function tracked(resource, title, runner) {
  return (_event, options = {}) => runTrackedSynchronization({
    provider: "omie",
    resource,
    operation: "sync",
    title,
    runner: () => runner(options),
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
      key: "clientes-prestadores",
      label: "Clientes / Prestadores",
      description: "Cadastro bidirecional de clientes e fornecedores.",
      syncHandler: "OMIE_CLIENTES_IMPORTAR",
      actionLabel: "Sincronizar",
      includeInFullSync: true,
      endpoint: "/integracoes/provedores/omie/recursos/clientes-prestadores/sincronizar",
      order: 10,
    },
    {
      key: "categorias",
      label: "Categorias financeiras",
      description: "Categorias do Omie relacionadas às categorias e subcategorias da Central.",
      syncHandler: "OMIE_CATEGORIAS_IMPORTAR",
      actionLabel: "Sincronizar",
      includeInFullSync: true,
      endpoint: "/integracoes/provedores/omie/recursos/categorias/sincronizar",
      order: 20,
    },
    {
      key: "meios-pagamento",
      label: "Meios de pagamento",
      description: "Formas de pagamento de compras disponíveis no Omie.",
      syncHandler: "OMIE_FORMAS_IMPORTAR",
      actionLabel: "Sincronizar",
      includeInFullSync: true,
      endpoint: "/integracoes/provedores/omie/recursos/meios-pagamento/sincronizar",
      order: 30,
    },
    {
      key: "contas-pagar",
      label: "Contas a pagar",
      description: "Envio, consulta e reconciliação dos pagamentos aprovados.",
      syncHandler: "OMIE_FINANCEIRO_RECONCILIAR",
      actionLabel: "Reconciliar",
      includeInFullSync: false,
      endpoint: "/integracoes/provedores/omie/recursos/contas-pagar/sincronizar",
      order: 40,
    },
  ],
  handlers: {
    OMIE_CLIENTE_UPSERT: (event, options) => sincronizarCliente(
      event.aggregateId || event.payload?.clienteFornecedorId,
      options,
    ),
    OMIE_CLIENTES_IMPORTAR: tracked(
      "clientes-prestadores",
      "Sincronização de clientes e prestadores",
      importarClientes,
    ),
    OMIE_CATEGORIAS_IMPORTAR: tracked(
      "categorias",
      "Sincronização de categorias financeiras",
      importarCategorias,
    ),
    OMIE_FORMAS_IMPORTAR: tracked(
      "meios-pagamento",
      "Sincronização de meios de pagamento",
      importarFormasPagamento,
    ),
    OMIE_CONTA_PAGAR_UPSERT: (event, options) => enviarContaPagar(
      event.aggregateId || event.payload?.pagamentoId,
      options,
    ),
    OMIE_CONTA_PAGAR_CONSULTAR: (event, options) => consultarContaPagar(
      event.aggregateId || event.payload?.pagamentoId,
      options,
    ),
    OMIE_FINANCEIRO_RECONCILIAR: tracked(
      "contas-pagar",
      "Reconciliação de contas a pagar",
      reconciliarFinanceiro,
    ),
    OMIE_WEBHOOK_PROCESSAR: (event, options) => processarWebhooksPendentes({
      ...options,
      webhookInboxId: event.aggregateId || event.payload?.webhookInboxId,
    }),
  },
});

module.exports = provider;
