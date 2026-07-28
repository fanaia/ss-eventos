"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "Categoria",
  singular: "categoria",
  basePath: "/categorias",
  schema: {
    nome: fields.string({ required: true, label: "Nome" }),
    categoriaPaiId: fields.ref("Categoria", { label: "Categoria Pai" }),
    descricao: fields.string({ label: "Descrição", searchable: true }),
    omieCategoriaId: fields.ref("OmieCategoria", { label: "Categoria Omie" }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: {
    enabled: true,
    roles: { write: ["admin", "desenvolvedor"] },
    populateRefs: true,
  },
});

module.exports = entry;
