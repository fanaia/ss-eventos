"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { registry } = require("@oondemand/oon-core-back");

const coreEntry = require.resolve("@oondemand/oon-core-back");
const { createCrudController } = require(
  path.join(path.dirname(coreEntry), "core/factories/crudController.js"),
);
const validationPath = require.resolve("../src/validations/regrasProjetos");

function mongooseModel(records) {
  return {
    findById(id) {
      return {
        lean: async () => records[String(id)] ?? null,
      };
    },
  };
}

function registerModel(name, records) {
  registry.registerModel({
    name,
    mongooseModel: mongooseModel(records),
    definition: {},
  });
}

function registerDomainFixtures() {
  registerModel("Projeto", {
    "projeto-1": { _id: "projeto-1", status: "Ativo" },
  });
  registerModel("Responsavel", {
    "responsavel-1": { _id: "responsavel-1", status: "Ativo" },
  });
  registerModel("Estado", {
    "estado-1": { _id: "estado-1", status: "Ativo" },
  });
  registerModel("Cidade", {
    "cidade-1": {
      _id: "cidade-1",
      estadoId: "estado-1",
      status: "Ativo",
    },
  });
  registerModel("Categoria", {
    "categoria-1": {
      _id: "categoria-1",
      categoriaPaiId: null,
      status: "Ativo",
    },
    "subcategoria-1": {
      _id: "subcategoria-1",
      categoriaPaiId: "categoria-1",
      status: "Ativo",
    },
  });

  delete require.cache[validationPath];
  require(validationPath);
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

const currentItem = {
  _id: "item-1",
  projetoId: "projeto-1",
  responsavelId: "responsavel-1",
  estadoId: "estado-1",
  cidadeId: "cidade-1",
  categoriaId: "categoria-1",
  subcategoriaId: "subcategoria-1",
  nome: "Item de teste",
  faturamento: "Agência",
  tipoCusto: "Fixo",
  etapa: "Pendente",
  orcamentoQuantidade: 1,
  orcamentoDiarias: 1,
  orcamentoValorUnitario: 100,
  fechamentoQuantidade: 0,
  fechamentoDiarias: 0,
  fechamentoValorUnitario: 0,
};

for (const scenario of [
  {
    name: "salva somente os campos da aba Orçamento",
    changes: {
      orcamentoQuantidade: 2,
      orcamentoDiarias: 3,
      orcamentoValorUnitario: 150,
    },
  },
  {
    name: "salva somente os campos da aba Fechamento",
    changes: {
      fechamentoQuantidade: 2,
      fechamentoDiarias: 1,
      fechamentoValorUnitario: 175,
      fechamentoObservacao: "Valor negociado.",
    },
  },
]) {
  test(scenario.name, async () => {
    registry.reset();
    let persistedChanges;

    try {
      registerDomainFixtures();

      const service = {
        async getById(id) {
          assert.equal(id, "item-1");
          return { toObject: () => ({ ...currentItem }) };
        },
        async update(id, changes) {
          assert.equal(id, "item-1");
          persistedChanges = changes;
          return { ...currentItem, ...changes };
        },
      };
      const controller = createCrudController(
        { name: "ProjetoItem", singular: "projetoItem" },
        service,
      );
      const response = responseRecorder();

      await controller.update(
        { params: { id: "item-1" }, body: scenario.changes },
        response,
      );

      assert.equal(response.statusCode, 200);
      assert.deepEqual(persistedChanges, scenario.changes);
      assert.equal(response.body.projetoItem.projetoId, "projeto-1");
      assert.equal(response.body.projetoItem.responsavelId, "responsavel-1");
    } finally {
      registry.reset();
      delete require.cache[validationPath];
    }
  });
}
