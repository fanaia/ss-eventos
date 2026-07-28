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
  assert.match(integracao, /UpsertContaPagar/);
  assert.match(integracao, /ConsultarContaPagar/);
});

test("credenciais são criptografadas e não aparecem no diagnóstico", () => {
  const configuracao = ler("backend/src/models/OmieConfiguracao.js");
  const segredos = ler("backend/src/services/omieSecrets.js");
  const rota = ler("backend/src/routes/omieIntegration.js");
  const client = ler("backend/src/services/omieClient.js");
  const pagina = ler("frontend/src/integrations/OmieIntegrationPage.tsx");
  assert.match(configuracao, /select:\s*false/);
  assert.match(configuracao, /criptografarSegredo/);
  assert.match(segredos, /aes-256-gcm/);
  assert.match(rota, /configuracaoParaUi/);
  assert.match(client, /app\[_-\]\?key|app/);
  assert.match(client, /filter\(\(\[chave\]\) => !segredo\.test\(chave\)\)/);
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
  assert.doesNotMatch(masterData, /sincronizarTudo/);
});

test("alterações locais usam AlterarCliente e nunca UpsertCliente no Omie", () => {
  const cliente = ler("backend/src/models/ClienteFornecedor.js");
  const alteracao = ler("backend/src/services/omieClienteAlteracao.js");
  const register = ler("backend/src/integrations/omie/register.js");
  const client = ler("backend/src/services/omieClient.js");

  assert.match(cliente, /handler:\s*"OMIE_CLIENTE_ALTERAR"/);
  assert.match(cliente, /tipo:\s*"OMIE_CLIENTE_ALTERAR"/);
  assert.match(cliente, /operation:\s*"update"/);
  assert.doesNotMatch(cliente, /OMIE_CLIENTE_UPSERT/);
  assert.match(register, /OMIE_CLIENTE_ALTERAR/);
  assert.doesNotMatch(register, /OMIE_CLIENTE_UPSERT/);
  assert.match(alteracao, /"AlterarCliente"/);
  assert.match(alteracao, /codigo_cliente_omie:\s*Number\(cliente\.codigoClienteOmie\)/);
  assert.doesNotMatch(alteracao, /UpsertCliente/);
  assert.match(client, /call === "UpsertCliente"\) return "AlterarCliente"/);
});

test("categoria define categoria Omie e pagamento define conta corrente", () => {
  const categoria = ler("backend/src/models/Categoria.js");
  const pagamento = ler("backend/src/models/Pagamento.js");
  const integracao = ler("backend/src/services/omieIntegration.js");
  const mapper = ler("backend/src/services/omieMappers.js");
  assert.match(categoria, /omieCategoriaId/);
  assert.doesNotMatch(categoria, /omieContaCorrenteId/);
  assert.match(pagamento, /omieContaCorrenteId/);
  assert.match(integracao, /subcategoriaId/);
  assert.match(integracao, /categoriaId/);
  assert.match(integracao, /pagamento\.omieContaCorrenteId/);
  assert.match(integracao, /codigoCategoriaOmie:\s*categoria\.codigo/);
  assert.match(integracao, /contaCorrenteId:\s*contaCorrente\.codigo/);
  assert.match(mapper, /id_conta_corrente:\s*codigoConta/);
});

test("reconciliação interpreta valor_pag como saldo e reconhece baixa", () => {
  const mapper = ler("backend/src/services/omieMappers.js");
  const rota = ler("backend/src/routes/omieIntegration.js");
  assert.match(mapper, /\["valor_pag", "valor_pendente", "saldo"\]/);
  assert.match(mapper, /\["PAGO", "LIQUIDADO"\]\.includes\(status\)/);
  assert.match(mapper, /status === "CANCELADO"/);
  assert.match(mapper, /valorDocumento - valorPendente/);
  assert.match(rota, /executarEObterPagamento/);
  assert.match(rota, /\.\.\.pagamento/);
  assert.match(rota, /data:\s*pagamento/);
});

test("Clientes e Prestadores usam ListarClientes sem loop outbound", () => {
  const masterData = ler("backend/src/services/omieMasterData.js");
  const register = ler("backend/src/integrations/omie/register.js");
  const client = ler("backend/src/services/omieClient.js");
  assert.match(masterData, /"clientes",\s*\n\s*"ListarClientes"/);
  assert.match(masterData, /skipOmieOutbox:\s*true/);
  assert.match(register, /recursos\/clientes-prestadores\/sincronizar/);
  assert.match(client, /geral\/clientes/);
});

test("não existem arquivos ou rotas de compatibilidade", () => {
  const route = ler("backend/src/routes/omieIntegration.js");
  const integration = ler("backend/src/services/omieIntegration.js");
  assert.equal(
    fs.existsSync(path.join(raiz, "backend/src/services/omieFinancialGuard.js")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(raiz, "backend/src/routes/omieListAliases.js")),
    false,
  );
  assert.doesNotMatch(route, /sincronizar\/categorias/);
  assert.doesNotMatch(route, /sincronizar\/contas-correntes/);
  assert.doesNotMatch(route, /webhooks\/processar/);
  assert.doesNotMatch(integration, /processarFila/);
  assert.doesNotMatch(integration, /enfileirarSincronizacaoCompleta/);
  assert.doesNotMatch(integration, /importarFormasPagamento/);
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
