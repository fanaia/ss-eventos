"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const raiz = path.resolve(__dirname, "../..");

test("organiza as abas e regras financeiras do item", async () => {
  const modulo = await import(pathToFileURL(path.join(raiz, "frontend/src/prepareManifest.js")).href);
  const manifest = {
    collections: [
      {
        model: "ProjetoItem",
        form: [],
        relations: {},
      },
    ],
    pipelines: [
      {
        name: "ItensProjeto",
        model: "ProjetoItem",
        form: [],
        relations: {
          pagamentos: {
            model: "Pagamento",
            foreignKey: "projetoItemId",
            parentKey: "_id",
          },
        },
        ticketModal: {
          tabs: [],
        },
      },
    ],
  };

  const preparado = modulo.prepararManifesto(manifest);
  const esteira = preparado.pipelines[0];
  const colecao = preparado.collections[0];

  assert.deepEqual(
    esteira.ticketModal.tabs.map((tab) => tab.id),
    ["dados", "orcamento", "contratacao", "pagamentos", "fechamento"],
  );
  assert.equal(colecao.detailModal.tabs[2].label, "Contratação");
  assert.equal(colecao.detailModal.tabs[3].label, "Pagamento");

  const orcamento = esteira.ticketModal.tabs.find((tab) => tab.id === "orcamento");
  assert.deepEqual(
    orcamento.groups[0].fields,
    ["orcamentoQuantidade", "orcamentoDiarias", "orcamentoValorUnitario", "orcamentoTotal"],
  );

  const contratacao = esteira.ticketModal.tabs.find((tab) => tab.id === "contratacao");
  assert.deepEqual(
    contratacao.groups[0].fields,
    ["contratacaoQuantidade", "contratacaoDiarias", "contratacaoValorUnitario", "contratacaoTotal"],
  );

  const fechamento = esteira.ticketModal.tabs.find((tab) => tab.id === "fechamento");
  assert.deepEqual(
    fechamento.groups[0].fields,
    ["fechamentoValor", "fechamentoFee", "fechamentoImposto", "fechamentoTotal"],
  );
  assert.deepEqual(
    fechamento.groups[1].fields,
    ["fechamentoLucroValor", "fechamentoLucroPercentual"],
  );

  for (const campo of [
    "orcamentoTotal",
    "contratacaoTotal",
    "fechamentoValor",
    "fechamentoFee",
    "fechamentoImposto",
    "fechamentoTotal",
    "fechamentoLucroValor",
    "fechamentoLucroPercentual",
  ]) {
    const configuracao = esteira.form.find((item) => item.field === campo);
    assert.equal(configuracao.readonly, true);
    assert.equal(configuracao.disabled, true);
  }

  assert.equal(esteira.ticketActions[0].disabledWhen.field, "contratacaoTotal");
});

test("calcula os totais no formulário e identifica lucro ou prejuízo", async () => {
  const modulo = await import(pathToFileURL(path.join(raiz, "frontend/src/financialFields.js")).href);

  assert.equal(modulo.normalizarNumero("R$ 1.234,56"), 1234.56);
  assert.equal(modulo.normalizarNumero("-R$ 880,00"), -880);
  assert.equal(modulo.calcularTotalItem(2, 3, "R$ 100,00"), 600);
  assert.equal(modulo.classificarResultado("R$ 120,00"), "lucro");
  assert.equal(modulo.classificarResultado("-R$ 10,00"), "prejuizo");
  assert.equal(modulo.classificarResultado(0), "neutro");

  const comportamento = fs.readFileSync(
    path.join(raiz, "frontend/src/financialFields.js"),
    "utf8",
  );
  const bootstrap = fs.readFileSync(
    path.join(raiz, "frontend/src/main.tsx"),
    "utf8",
  );

  assert.match(comportamento, /controle\.readOnly = true/);
  assert.match(comportamento, /data-resultado-financeiro/);
  assert.match(comportamento, /PREFIXOS_TOTAL = \["orcamento", "contratacao"\]/);
  assert.match(bootstrap, /instalarComportamentoCamposFinanceiros\(\)/);
});

test("o pagamento usa o total contratado como saldo", () => {
  const rota = fs.readFileSync(
    path.join(raiz, "backend/src/routes/pagamentosItem.js"),
    "utf8",
  );

  assert.match(rota, /calcularSaldoFinanceiro\(item\.contratacaoTotal,\s*pagamentos\)/);
  assert.doesNotMatch(rota, /item\.fechamentoTotalComImpostoFee/);
});
