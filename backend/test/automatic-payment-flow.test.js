"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

test("Pagamento agenda o Omie somente ao entrar na etapa automática", () => {
  const pagamento = read("backend/src/models/Pagamento.js");
  assert.match(pagamento, /ETAPA_ENVIO_AUTOMATICO = "Enviado para Omie"/);
  assert.match(pagamento, /pagamento\.etapa !== ETAPA_ENVIO_AUTOMATICO/);
  assert.doesNotMatch(pagamento, /pagamento\.etapa !== "Aprovado"/);
  assert.match(pagamento, /handler: "OMIE_CONTA_PAGAR_UPSERT"/);
  assert.match(pagamento, /statusTrabalho: "Trabalhando"/);
  assert.match(pagamento, /omieStatusIntegracao: "Pendente"/);
});

test("etapas automáticas bloqueiam alterações manuais", () => {
  const pagamento = read("backend/src/models/Pagamento.js");
  assert.match(pagamento, /ETAPAS_AUTOMATICAS/);
  assert.match(pagamento, /etapaAutomatica\(atual\.etapa\) && !skipOmieOutbox/);
  assert.match(pagamento, /Esta é uma etapa automática/);
  assert.match(pagamento, /Pagamento Ok somente pode ser definida pela conciliação/);
  assert.match(pagamento, /atual\.etapa !== "Aguardando NF"/);
});

test("conciliação é um comando permitido somente na etapa Enviado para Omie", () => {
  const pagamento = read("backend/src/models/Pagamento.js");
  assert.match(pagamento, /entrada\._conciliarOmie/);
  assert.match(pagamento, /delete entrada\._conciliarOmie/);
  assert.match(pagamento, /atual\.etapa !== ETAPA_ENVIO_AUTOMATICO/);
  assert.match(pagamento, /conciliarPagamentoAutomatico\(id\)/);
  assert.match(pagamento, /return Model\.findById\(id\)/);
  assert.equal(exists("backend/src/routes/omiePagamentoAutomatico.js"), false);
});

test("automação muda status para Trabalhando e Revisão em caso de erro", () => {
  const automatico = read("backend/src/services/omiePagamentoAutomatico.js");
  const register = read("backend/src/integrations/omie/register.js");
  assert.match(automatico, /statusTrabalho: "Trabalhando"/);
  assert.match(automatico, /statusTrabalho: "Revisar"/);
  assert.match(automatico, /omieStatusIntegracao: "Erro"/);
  assert.match(register, /enviarPagamentoAutomatico/);
  assert.match(register, /conciliarPagamentoAutomatico/);
  assert.match(register, /reconciliarPagamentosAutomaticos/);
});

test("frontend remove Enviar ao Omie e mantém somente conciliação na etapa automática", () => {
  const flow = read("frontend/src/automaticPaymentFlow.js");
  const main = read("frontend/src/main.tsx");
  assert.match(flow, /defaultActions: false/);
  assert.doesNotMatch(flow, /label: "Enviar ao Omie"/);
  assert.match(flow, /label: "Atualizar do Omie"/);
  assert.match(flow, /type: "setField"/);
  assert.match(flow, /field: "_conciliarOmie"/);
  assert.match(flow, /value: true/);
  assert.doesNotMatch(flow, /integracoes\/omie\/automatico/);
  assert.match(flow, /hiddenWhen: \{ field: "etapa", notEquals: ETAPA_ENVIO_AUTOMATICO \}/);
  assert.match(flow, /"Aguardando NF",\s*ETAPA_ENVIO_AUTOMATICO/);
  assert.match(main, /aplicarFluxoAutomaticoPagamentos/);
});

test("frontend bloqueia campos e oculta Salvar nas etapas automáticas", () => {
  const behavior = read("frontend/src/automaticPaymentStageBehavior.js");
  const main = read("frontend/src/main.tsx");
  assert.match(behavior, /ETAPAS_AUTOMATICAS = new Set\(\["Enviado para Omie", "Pagamento Ok"\]\)/);
  assert.match(behavior, /controle\.disabled = true/);
  assert.match(behavior, /botao\.style\.display = "none"/);
  assert.match(behavior, /CAMPOS_CONTROLADOS_PELO_PROCESSO/);
  assert.match(main, /instalarComportamentoEtapasAutomaticasPagamento\(\)/);
});
