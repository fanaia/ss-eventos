"use strict";

const { defineModel, fields, GenericError } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "OmieContaCorrente",
  singular: "omieContaCorrente",
  basePath: "/integracoes/omie/contas-correntes",
  schema: {
    codigo: { type: Number, required: true, __meta: { kind: "number", label: "Código Omie", readonly: true, readOnly: true } },
    codigoIntegracao: fields.string({ label: "Código de integração", searchable: true }),
    descricao: fields.string({ required: true, label: "Descrição", searchable: true }),
    tipo: fields.string({ label: "Tipo", searchable: true }),
    codigoBanco: fields.string({ label: "Banco", searchable: true }),
    codigoAgencia: fields.string({ label: "Agência", searchable: true }),
    numeroConta: fields.string({ label: "Conta", searchable: true }),
    inativa: fields.boolean({ label: "Inativa", default: false }),
    bloqueada: fields.boolean({ label: "Bloqueada", default: false }),
    payloadHash: fields.string({ label: "Hash do payload" }),
    sincronizadoEm: fields.date({ label: "Sincronizada em" }),
    vistoEm: fields.date({ label: "Vista em" }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["__integracao_interna__"] } },
});

const Model = entry.mongooseModel;
Model.schema.index({ codigo: 1 }, { unique: true });
Model.schema.index({ codigoIntegracao: 1 }, { unique: true, sparse: true });

function somenteIntegracao() {
  throw new GenericError("Contas correntes são sincronizadas do Omie e não podem ser editadas manualmente.", {
    statusCode: 409,
  });
}

Model.create = somenteIntegracao;
Model.insertMany = somenteIntegracao;
Model.findByIdAndUpdate = somenteIntegracao;
Model.findByIdAndDelete = somenteIntegracao;

module.exports = entry;
