const { defineModel, fields } = require("@oondemand/oon-core-back");

defineModel({
  name: "Cidade",
  singular: "cidade",
  basePath: "/cidades",
  schema: {
    estadoId: fields.ref("Estado", { required: true, label: "Estado" }),
    nome: fields.string({ required: true, label: "Nome" }),
    codigoIbge: fields.string({ label: "Código IBGE" }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});
