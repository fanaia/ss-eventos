const { defineModel, fields } = require("@oondemand/oon-core-back");

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const entry = defineModel({
  name: "Estado",
  singular: "estado",
  basePath: "/estados",
  schema: {
    codigoIbge: fields.string({ required: true, label: "Código IBGE" }),
    uf: fields.enum(UFS, { required: true, label: "UF" }),
    nome: fields.string({ required: true, label: "Nome" }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  // Coleção interna: leitura é usada pelos dropdowns; escrita não é exposta aos usuários.
  crud: { enabled: true, roles: { write: ["__localidades_internas__"] } },
});

entry.mongooseModel.schema.index({ uf: 1 }, { unique: true });
entry.mongooseModel.schema.index({ codigoIbge: 1 });
