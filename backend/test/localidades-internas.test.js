"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const {
  TOTAL_ESTADOS,
  MINIMO_MUNICIPIOS,
  URL_ESTADOS,
  URL_MUNICIPIOS,
  normalizarLocalidades,
  sincronizarLocalidades,
} = require("../src/services/localidadesInternas");

const raiz = path.resolve(__dirname, "../..");

test("normaliza e valida a estrutura oficial de estados e municípios", () => {
  const estados = Array.from({ length: TOTAL_ESTADOS }, (_, indice) => {
    const codigo = String(10 + indice);
    return { id: Number(codigo), sigla: `U${indice}`, nome: `Estado ${indice}` };
  });
  const municipios = Array.from({ length: MINIMO_MUNICIPIOS }, (_, indice) => {
    const codigoUf = String(10 + (indice % TOTAL_ESTADOS));
    return {
      id: Number(`${codigoUf}${String(indice).padStart(5, "0")}`),
      nome: `Cidade ${indice}`,
    };
  });

  const localidades = normalizarLocalidades(estados, municipios);

  assert.equal(localidades.estados.length, TOTAL_ESTADOS);
  assert.equal(localidades.cidades.length, MINIMO_MUNICIPIOS);
  assert.equal(localidades.cidades[0].codigoUf.length, 2);
  assert.match(URL_ESTADOS, /servicodados\.ibge\.gov\.br/);
  assert.match(URL_MUNICIPIOS, /servicodados\.ibge\.gov\.br/);
});

test("rejeita resposta incompleta da fonte de localidades", () => {
  assert.throws(() => normalizarLocalidades([], []), /Quantidade inesperada de estados/);
});

test("mantém a lista interna quando o IBGE está indisponível e o cache é válido", async () => {
  const Estado = {
    countDocuments: async () => TOTAL_ESTADOS,
  };
  const Cidade = {
    countDocuments: async () => MINIMO_MUNICIPIOS,
  };

  const result = await sincronizarLocalidades({
    Estado,
    Cidade,
    obterLocalidades: async () => {
      throw new Error("serviço indisponível");
    },
  });

  assert.deepEqual(result, { origem: "cache" });
});

test("Estado, Cidade e Contato são removidos do menu automático", () => {
  const preparacao = fs.readFileSync(
    path.join(raiz, "frontend/src/prepareManifest.js"),
    "utf8",
  );
  const bootstrap = fs.readFileSync(
    path.join(raiz, "frontend/src/main.tsx"),
    "utf8",
  );

  assert.match(preparacao, /MODELOS_INTERNOS\s*=\s*new Set\(\["Estado",\s*"Cidade",\s*"Contato"\]\)/);
  assert.match(preparacao, /manifest\.collections/);
  assert.match(preparacao, /!MODELOS_INTERNOS\.has\(collection\.model\)/);
  assert.match(bootstrap, /prepararManifesto\(/);
  assert.match(bootstrap, /startFromManifest\(manifestDaCentral/);
});

test("prepara recursos operacionais de contatos, projetos e esteiras", async () => {
  const modulo = await import(pathToFileURL(path.join(raiz, "frontend/src/prepareManifest.js")).href);
  const manifest = {
    collections: [
      {
        model: "ClienteFornecedor",
        detailModal: {
          tabs: [{ id: "contatos", type: "relatedGrid", columns: ["nome"] }],
        },
      },
      { model: "Contato" },
      { model: "Categoria", section: "Cadastros" },
      {
        model: "Projeto",
        detailModal: {
          tabs: [
            { id: "itens", type: "relatedGrid", editable: true, editMode: "inline", columns: [{ field: "nome", editable: true }] },
            { id: "pagamentos", type: "readonlyGrid", columns: ["valor"] },
          ],
        },
      },
      { model: "ProjetoItem" },
    ],
    pipelines: [
      { name: "ItensProjeto", model: "ProjetoItem", ticketModal: { tabs: [] } },
      { name: "Pagamentos", model: "Pagamento" },
    ],
  };

  const preparado = modulo.prepararManifesto(manifest);

  assert.equal(preparado.collections.some((collection) => collection.model === "Contato"), false);
  assert.equal(preparado.collections.find((collection) => collection.model === "Categoria").section, "Configurações");

  const contatos = preparado.collections
    .find((collection) => collection.model === "ClienteFornecedor")
    .detailModal.tabs.find((tab) => tab.id === "contatos");
  assert.equal(contatos.create.enabled, true);
  assert.equal(contatos.delete.enabled, true);

  const itensProjeto = preparado.collections
    .find((collection) => collection.model === "Projeto")
    .detailModal.tabs.find((tab) => tab.id === "itens");
  assert.equal(itensProjeto.type, "readonlyGrid");
  assert.equal(itensProjeto.editable, undefined);

  const esteiraItens = preparado.pipelines.find((pipeline) => pipeline.model === "ProjetoItem");
  assert.deepEqual(esteiraItens.viewModes, ["board", "list"]);
  assert.equal(esteiraItens.create.enabled, true);
  assert.ok(esteiraItens.filters.some((filter) => filter.field === "projetoId"));
  assert.ok(esteiraItens.filters.some((filter) => filter.field === "responsavelId"));
  assert.deepEqual(esteiraItens.ticketActions.map((action) => action.id), ["gerar-pagamento"]);
  assert.equal(esteiraItens.ticketActions[0].type, "formAction");
  assert.equal(esteiraItens.ticketActions.some((action) => action.type === "transition"), false);
  assert.equal(esteiraItens.ticketActions.some((action) => action.type === "setField"), false);

  const esteiraPagamentos = preparado.pipelines.find((pipeline) => pipeline.model === "Pagamento");
  assert.deepEqual(esteiraPagamentos.viewModes, ["board", "list"]);
  assert.equal(esteiraPagamentos.ticketModal.enabled, true);
  assert.equal(esteiraPagamentos.ticketActions, undefined);
});

test("models de localidades restringem escrita ao perfil interno", () => {
  for (const arquivo of ["Estado.js", "Cidade.js"]) {
    const fonte = fs.readFileSync(
      path.join(raiz, "backend/src/models", arquivo),
      "utf8",
    );
    assert.match(fonte, /write:\s*\[\s*["']__localidades_internas__["']\s*\]/);
    assert.doesNotMatch(fonte, /write:\s*\[\s*["']desenvolvedor["']\s*\]/);
  }
});