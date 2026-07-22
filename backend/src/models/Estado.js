const { defineModel, fields } = require("@oondemand/oon-core-back");

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

defineModel({
  name: "Estado",
  singular: "estado",
  basePath: "/estados",
  schema: {
    uf: fields.enum(UFS, { required: true, label: "UF" }),
    nome: fields.string({ required: true, label: "Nome" }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});
