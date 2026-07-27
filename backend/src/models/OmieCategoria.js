"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "OmieCategoria",
  singular: "omieCategoria",
  basePath: "/integracoes/omie/categorias",
  schema: {
    codigo: fields.string({ required: true, label: "Código Omie", searchable: true }),
    descricao: fields.string({ required: true, label: "Descrição", searchable: true }),
    natureza: fields.string({ label: "Natureza", searchable: true }),
    tipoCategoria: fields.string({ label: "Tipo" }),
    categoriaSuperiorCodigo: fields.string({ label: "Categoria superior" }),
    totalizadora: fields.boolean({ label: "Totalizadora", default: false }),
    transferencia: fields.boolean({ label: "Transferência", default: false }),
    contaInativa: fields.boolean({ label: "Inativa", default: false }),
    contaDespesa: fields.boolean({ label: "Despesa", default: false }),
    contaReceita: fields.boolean({ label: "Receita", default: false }),
    naoExibir: fields.boolean({ label: "Não exibir", default: false }),
    payloadHash: fields.string({ label: "Hash do payload" }),
    sincronizadoEm: fields.date({ label: "Sincronizado em" }),
    vistoEm: fields.date({ label: "Visto em" }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

entry.mongooseModel.schema.index({ codigo: 1 }, { unique: true });
module.exports = entry;
