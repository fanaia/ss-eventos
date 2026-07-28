"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const raiz = path.resolve(__dirname, "../..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

test("integração usa outbox, inbox e chaves determinísticas", () => {
  const outbox = ler("backend/src/models/IntegrationOutbox.js");
  const inbox = ler("backend/src/models/WebhookInbox.js");
  const integracao = ler("backend/src/services/omieIntegration.js");
  assert.match(outbox, /idempotencyKey/);
  assert.match(outbox, /unique:\s*true/);
  assert.match(inbox, /payloadHash/);
  assert.match(integracao, /OMIE_CONTA_PAGAR_UPSERT/);
  assert.match(integracao, /ConsultarContaPagar/);
});

test("credenciais informadas na tela são criptografadas e nunca expostas", () => {
  const configuracao = ler("backend/src/models/OmieConfiguracao.js");
  const segredos = ler("backend/src/services/omieSecrets.js");
  const rota = ler("backend/src/routes/omieIntegration.js");
  const pagina = ler("frontend/src/integrations/OmieIntegrationPage.tsx");
  assert.match(configuracao, /select:\s*false/);
  assert.match(configuracao, /criptografarSegredo/);
  assert.match(segredos, /aes-256-gcm/);
  assert.match(rota, /configuracaoParaUi/);
  assert.match(pagina, /type="password"/);
  assert.doesNotMatch(pagina, /OMIE_APP_SECRET/);
});

test("categorias e contas correntes são listas Omie somente leitura", () => {
  const categoria = ler("backend/src/models/OmieCategoria.js");
  const conta = ler("backend/src/models/OmieContaCorrente.js");
  const masterData = ler("backend/src/services/omieMasterData.js");
  assert.match(categoria, /não podem ser editadas manualmente/);
  assert.match(conta, /não podem ser editadas manualmente/);
  assert.match(masterData, /ListarCategorias/);
  assert.match(masterData, /ListarContasCorrentes/);
  assert.match(masterData, /ListarClientes/);
});

test("conta corrente sincronizada é obrigatória no envio de Contas a Pagar", () => {
  const guard = ler("backend/src/services/omieFinancialGuard.js");
  const mapper = ler("backend/src/services/omieMappers.js");
  const pagamento = ler("backend/src/models/Pagamento.js");
  assert.match(guard, /Selecione uma conta corrente Omie/);
  assert.match(guard, /OmieContaCorrente/);
  assert.match(mapper, /id_conta_corrente/);
  assert.match(mapper, /conta corrente Omie ativa/);
  assert.match(pagamento, /omieContaCorrenteEnviada/);
});

test("categoria e subcategoria enviam o código da categoria Omie vinculada", () => {
  const categoria = ler("backend/src/models/Categoria.js");
  const integracao = ler("backend/src/services/omieIntegration.js");
  const frontend = ler("frontend/src/integrations/omie.js");
  assert.match(categoria, /omieCategoriaId/);
  assert.match(integracao, /subcategoriaId/);
  assert.match(integracao, /categoriaId/);
  assert.match(integracao, /codigoCategoriaOmie:\s*categoria\.codigo/);
  assert.match(frontend, /field:\s*"omieCategoriaId"/);
  assert.match(frontend, /Categoria financeira/);
});

test("Clientes e Prestadores usam o endpoint validado e importação sem loop", () => {
  const masterData = ler("backend/src/services/omieMasterData.js");
  const route = ler("backend/src/routes/omieIntegration.js");
  const client = ler("backend/src/services/omieClient.js");
  assert.match(masterData, /"clientes",\s*\n\s*"ListarClientes"/);
  assert.match(masterData, /skipOmieOutbox:\s*true/);
  assert.match(route, /clientes-fornecedores\/sincronizar/);
  assert.match(client, /geral\/clientes/);
});

test("frontend usa Integrações, abas, modais, fila e eventos", () => {
  const pagina = ler("frontend/src/integrations/OmieIntegrationPage.tsx");
  const omie = ler("frontend/src/integrations/omie.js");
  const navegacao = ler("frontend/src/prepareNavigation.js");
  assert.match(pagina, /Visão geral/);
  assert.match(pagina, /Cadastros sincronizados/);
  assert.match(pagina, /Financeiro/);
  assert.match(pagina, /Histórico/);
  assert.match(pagina, /Webhooks/);
  assert.match(pagina, /function Modal/);
  assert.match(pagina, /\/integracoes\/esteira/);
  assert.match(pagina, /\/integracoes\/eventos/);
  assert.match(omie, /section:\s*"Integrações"/);
  assert.match(navegacao, /Categorias\/Subcategorias/);
  assert.match(navegacao, /Responsáveis/);
});

test("pagamentos exibem campos complementares e itens exibem pago e pendente", () => {
  const ajustes = ler("frontend/src/omieAdjustments.js");
  assert.match(ajustes, /omieDataUltimaBaixa/);
  assert.match(ajustes, /omieLiquidado/);
  assert.match(ajustes, /pagamentoTotalPago/);
  assert.match(ajustes, /pagamentoValorPendente/);
});
