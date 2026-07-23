"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const raiz = path.resolve(__dirname, "../..");
const helperUrl = pathToFileURL(
  path.join(raiz, "frontend/src/prepareNavigation.js"),
).href;

test("organiza o menu e direciona itens e pagamentos para as esteiras", async () => {
  const { prepararNavegacao } = await import(helperUrl);
  const manifest = {
    collections: [
      { model: "ClienteFornecedor", label: "Clientes/Fornecedores", section: "Cadastros" },
      { model: "ProjetoItem", label: "Itens de Projeto", section: "Operação" },
      { model: "Projeto", label: "Projetos", section: "Operação" },
      { model: "Pagamento", label: "Pagamentos", section: "Financeiro" },
      { model: "Categoria", label: "Categorias/Subcategorias", section: "Cadastros" },
      { model: "Responsavel", label: "Responsáveis", section: "Configurações" },
    ],
    pipelines: [
      {
        name: "ItensProjeto",
        model: "ProjetoItem",
        path: "/esteira-itens",
        label: "Esteira de Itens",
        section: "Operação",
      },
      {
        name: "Pagamentos",
        model: "Pagamento",
        path: "/esteira-pagamentos",
        label: "Esteira de Pagamentos",
        section: "Financeiro",
      },
    ],
  };

  const preparado = prepararNavegacao(manifest);

  assert.deepEqual(
    preparado.collections.map(({ model, label, section }) => ({ model, label, section })),
    [
      { model: "ClienteFornecedor", label: "Clientes Fornecedores", section: "Cadastros" },
      { model: "Projeto", label: "Projetos", section: "Operação" },
      { model: "Categoria", label: "Categorias/SubCategorias", section: "Configurações" },
      { model: "Responsavel", label: "Responsáveis", section: "Configurações" },
    ],
  );

  const itens = preparado.pipelines.find((pipeline) => pipeline.model === "ProjetoItem");
  assert.equal(itens.label, "Itens");
  assert.equal(itens.section, "Operação");
  assert.equal(itens.path, "/esteira-itens");

  const pagamentos = preparado.pipelines.find((pipeline) => pipeline.model === "Pagamento");
  assert.equal(pagamentos.label, "Pagamentos");
  assert.equal(pagamentos.section, "Financeiro");
  assert.equal(pagamentos.path, "/esteira-pagamentos");
});

test("o bootstrap aplica a preparação da navegação antes de iniciar o OonCore", () => {
  const bootstrap = fs.readFileSync(
    path.join(raiz, "frontend/src/main.tsx"),
    "utf8",
  );

  assert.match(bootstrap, /import \{ prepararNavegacao \}/);
  assert.match(bootstrap, /prepararNavegacao\(\s*prepararManifesto\(/);
  assert.match(bootstrap, /startFromManifest\(manifestDaCentral/);
});
