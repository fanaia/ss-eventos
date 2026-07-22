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

test("Estado e Cidade são removidos do manifesto entregue ao OonCore", () => {
  const fonte = fs.readFileSync(
    path.join(raiz, "frontend/src/main.tsx"),
    "utf8",
  );

  assert.match(fonte, /MODELOS_INTERNOS\s*=\s*new Set\(\["Estado",\s*"Cidade"\]\)/);
  assert.match(fonte, /manifest\.collections\?\.filter/);
  assert.match(fonte, /!MODELOS_INTERNOS\.has\(collection\.model\)/);
  assert.match(fonte, /startFromManifest\(manifestDaCentral/);
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
