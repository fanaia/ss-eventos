"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const localidades = require("../src/data/localidades-brasil.json");

const raiz = path.resolve(__dirname, "../..");

test("lista interna contém todas as UFs e municípios brasileiros", () => {
  assert.equal(localidades.estados.length, 27);
  assert.ok(localidades.cidades.length >= 5500);

  const codigosEstados = new Set(localidades.estados.map((estado) => String(estado.codigoIbge)));
  const ufs = new Set(localidades.estados.map((estado) => estado.uf));
  const codigosCidades = new Set(localidades.cidades.map((cidade) => String(cidade.codigoIbge)));

  assert.equal(codigosEstados.size, localidades.estados.length);
  assert.equal(ufs.size, localidades.estados.length);
  assert.equal(codigosCidades.size, localidades.cidades.length);

  for (const cidade of localidades.cidades) {
    assert.ok(codigosEstados.has(String(cidade.codigoUf)), `UF ausente para ${cidade.nome}`);
  }
});

test("Estado e Cidade não aparecem como cadastros editáveis no manifesto", () => {
  const manifesto = JSON.parse(
    fs.readFileSync(path.join(raiz, "frontend/central.ui.json"), "utf8"),
  );
  const modelos = new Set((manifesto.collections || []).map((colecao) => colecao.model));

  assert.equal(modelos.has("Estado"), false);
  assert.equal(modelos.has("Cidade"), false);
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
