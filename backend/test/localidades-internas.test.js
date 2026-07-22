"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  TOTAL_ESTADOS,
  MINIMO_MUNICIPIOS,
  URL_ESTADOS,
  URL_MUNICIPIOS,
  normalizarLocalidades,
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
