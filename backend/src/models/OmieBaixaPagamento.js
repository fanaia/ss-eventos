"use strict";
const { defineModel, fields } = require("@oondemand/oon-core-back");
const entry = defineModel({
  name: "OmieBaixaPagamento", singular: "omieBaixaPagamento", basePath: "/integracoes/omie/baixas",
  schema: {
    pagamentoId: fields.ref("Pagamento", { required: true, label: "Pagamento" }),
    codigoLancamentoOmie: { type: Number, required: true, __meta: { kind: "number", label: "Lançamento Omie" } },
    codigoBaixaOmie: fields.string({ required: true, label: "Código da baixa Omie", searchable: true }),
    codigoBaixaIntegracao: fields.string({ label: "Código da baixa de integração", searchable: true }),
    dataBaixa: fields.date({ label: "Data da baixa" }), valorBaixado: fields.currency({ label: "Valor baixado" }),
    desconto: fields.currency({ label: "Desconto" }), juros: fields.currency({ label: "Juros" }),
    multa: fields.currency({ label: "Multa" }), valorEfetivo: fields.currency({ label: "Valor efetivo" }),
    estornada: fields.boolean({ label: "Estornada", default: false }), estornadaEm: fields.date({ label: "Estornada em" }),
    origemEvento: fields.enum(["Webhook", "Reconciliação", "Manual"], { label: "Origem", default: "Webhook" }),
    payloadHash: fields.string({ label: "Hash do payload" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] }, populateRefs: true },
});
entry.mongooseModel.schema.index({ codigoBaixaOmie: 1 }, { unique: true });
entry.mongooseModel.schema.index({ pagamentoId: 1, estornada: 1 });
module.exports = entry;
