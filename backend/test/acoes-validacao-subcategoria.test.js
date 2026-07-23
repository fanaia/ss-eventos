"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { dadosConsolidados } = require("../src/services/dadosValidacao");

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

test("validações de item e pagamento usam os dados consolidados", () => {
  const fonte = fs.readFileSync(
    path.join(raiz, "backend/src/validations/regrasProjetos.js"),
    "utf8",
  );

  assert.match(fonte, /defineValidation\("ProjetoItem", async \(dados, contexto\)/);
  assert.match(fonte, /defineValidation\("Pagamento", async \(dados, contexto\)/);
  assert.ok((fonte.match(/dadosConsolidados\(dados, contexto\)/g) ?? []).length >= 3);
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
});
