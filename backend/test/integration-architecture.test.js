"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("componente genérico registra provedores e resolve handlers", () => {
  const registry = read("backend/src/integrations/registry.js");
  const runtime = read("backend/src/integrations/runtime.js");
  assert.match(registry, /registerIntegrationProvider/);
  assert.match(registry, /resolveIntegrationHandler/);
  assert.match(runtime, /processIntegrationQueue/);
  assert.match(runtime, /archiveIntegrationTicket/);
  assert.match(runtime, /reprocessIntegrationTicket/);
  assert.doesNotMatch(runtime, /OMIE_CLIENTE_UPSERT/);
});

test("adaptador Omie expõe somente o contrato atual", () => {
  const omie = read("backend/src/integrations/omie/register.js");
  assert.match(omie, /OMIE_CLIENTES_IMPORTAR/);
  assert.match(omie, /OMIE_CONTAS_CORRENTES_IMPORTAR/);
  assert.match(omie, /OMIE_CATEGORIAS_IMPORTAR/);
  assert.match(omie, /\/integracoes\/provedores\/omie\/recursos\/clientes-prestadores\/sincronizar/);
  assert.match(omie, /\/integracoes\/provedores\/omie\/recursos\/contas-correntes\/sincronizar/);
  assert.doesNotMatch(omie, /meios-pagamento/);
  assert.doesNotMatch(omie, /OMIE_FORMAS_IMPORTAR/);
  assert.doesNotMatch(omie, /omieFinancialGuard/);
});

test("categoria centraliza os vínculos financeiros do Omie", () => {
  const categoria = read("backend/src/models/Categoria.js");
  const integracao = read("backend/src/services/omieIntegration.js");
  assert.match(categoria, /omieCategoriaId:\s*fields\.ref\("OmieCategoria"/);
  assert.match(categoria, /omieContaCorrenteId:\s*fields\.ref\("OmieContaCorrente"/);
  assert.doesNotMatch(categoria, /exigirCategoriaOmie/);
  assert.match(integracao, /resolverMapeamentoFinanceiro/);
  assert.match(integracao, /contaCorrenteId:\s*contaCorrente\.codigo/);
  assert.match(integracao, /omieContaCorrenteEnviada/);
});

test("configuração Omie contém apenas credenciais e conectividade", () => {
  const configuration = read("backend/src/models/OmieConfiguracao.js");
  const route = read("backend/src/routes/omieIntegration.js");
  assert.match(configuration, /appKey:\s*campoSegredo/);
  assert.match(configuration, /appSecret:\s*campoSegredo/);
  assert.doesNotMatch(configuration, /contaCorrenteId/);
  assert.doesNotMatch(configuration, /contaCorrenteDescricao/);
  assert.doesNotMatch(route, /contaCorrenteId/);
  assert.doesNotMatch(route, /clientes-fornecedores\/sincronizar/);
  assert.doesNotMatch(route, /sincronizar\/clientes/);
  assert.doesNotMatch(route, /fila\/processar/);
});

test("frontend mantém listas Omie somente leitura e mapeia pela categoria", () => {
  const omie = read("frontend/src/integrations/omie.js");
  const page = read("frontend/src/integrations/OmieIntegrationPage.tsx");
  assert.match(omie, /field:\s*"omieCategoriaId"/);
  assert.match(omie, /field:\s*"omieContaCorrenteId"/);
  assert.match(omie, /fields:\s*\["omieCategoriaId",\s*"omieContaCorrenteId"\]/);
  assert.match(page, /Mapeamentos financeiros/);
  assert.match(page, /Configurar categorias/);
  assert.match(page, /ListRows kind=\{listModal\} rows=\{listRows\}/);
  assert.doesNotMatch(page, /Selecionar conta/);
  assert.doesNotMatch(page, /contaCorrenteId/);
  assert.doesNotMatch(page, /contaCorrenteDescricao/);
});
