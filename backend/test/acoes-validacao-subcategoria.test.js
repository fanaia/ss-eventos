"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  dadosConsolidados,
  dadosComDependenciaOpcional,
} = require("../src/services/dadosValidacao");

const raiz = path.resolve(__dirname, "../..");

test("usa o registro consolidado nas mutações parciais da esteira", () => {
  const alteracoes = { statusTrabalho: "Trabalhando" };
  const consolidado = {
    _id: "item-1",
    projetoId: "projeto-1",
    responsavelId: "responsavel-1",
    statusTrabalho: "Trabalhando",
  };

  assert.equal(dadosConsolidados(alteracoes, { consolidated: consolidado }), consolidado);
});

test("mantém compatibilidade quando a validação não recebe contexto", () => {
  const dados = { etapa: "Aprovado" };
  assert.equal(dadosConsolidados(dados), dados);
});

test("interpreta subcategoria omitida como remoção quando a categoria foi enviada", () => {
  const efetivos = dadosComDependenciaOpcional(
    { categoriaId: "categoria-2" },
    {
      consolidated: {
        categoriaId: "categoria-2",
        subcategoriaId: "subcategoria-antiga",
      },
    },
    "categoriaId",
    "subcategoriaId",
  );

  assert.equal(efetivos.categoriaId, "categoria-2");
  assert.equal(efetivos.subcategoriaId, null);
});

test("preserva subcategoria nas mutações rápidas que não enviam a categoria", () => {
  const efetivos = dadosComDependenciaOpcional(
    { statusTrabalho: "Revisar" },
    {
      consolidated: {
        categoriaId: "categoria-1",
        subcategoriaId: "subcategoria-1",
        statusTrabalho: "Revisar",
      },
    },
    "categoriaId",
    "subcategoriaId",
  );

  assert.equal(efetivos.subcategoriaId, "subcategoria-1");
});

test("preserva a nova subcategoria quando ela é informada", () => {
  const efetivos = dadosComDependenciaOpcional(
    {
      categoriaId: "categoria-2",
      subcategoriaId: "subcategoria-2",
    },
    {
      consolidated: {
        categoriaId: "categoria-2",
        subcategoriaId: "subcategoria-2",
      },
    },
    "categoriaId",
    "subcategoriaId",
  );

  assert.equal(efetivos.subcategoriaId, "subcategoria-2");
});

test("validações de item e pagamento usam os dados consolidados", () => {
  const fonte = fs.readFileSync(
    path.join(raiz, "backend/src/validations/regrasProjetos.js"),
    "utf8",
  );

  assert.match(fonte, /defineValidation\("ProjetoItem", async \(dados, contexto\)/);
  assert.match(fonte, /defineValidation\("Pagamento", async \(dados, contexto\)/);
  assert.ok((fonte.match(/dadosConsolidados\(dados, contexto\)/g) ?? []).length >= 2);
  assert.match(fonte, /dadosComDependenciaOpcional\(/);
});

test("subcategoria é opcional e só é validada quando informada", () => {
  const model = fs.readFileSync(
    path.join(raiz, "backend/src/models/ProjetoItem.js"),
    "utf8",
  );
  const validacao = fs.readFileSync(
    path.join(raiz, "backend/src/validations/regrasProjetos.js"),
    "utf8",
  );

  assert.match(
    model,
    /subcategoriaId:\s*fields\.ref\("Categoria",\s*\{\s*label:\s*"Subcategoria"\s*\}\)/,
  );
  assert.doesNotMatch(
    model,
    /subcategoriaId:\s*fields\.ref\("Categoria",\s*\{[^}]*required:\s*true/,
  );
  assert.match(validacao, /if \(efetivos\.subcategoriaId\) \{/);
  assert.match(model, /dadosComDependenciaOpcional\(/);
});
