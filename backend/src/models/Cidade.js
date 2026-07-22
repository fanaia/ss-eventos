const { defineModel, fields, registry } = require("@oondemand/oon-core-back");
const { agendarSincronizacao } = require("../services/localidadesInternas");

const entry = defineModel({
  name: "Cidade",
  singular: "cidade",
  basePath: "/cidades",
  schema: {
    estadoId: fields.ref("Estado", { required: true, label: "Estado" }),
    nome: fields.string({ required: true, label: "Nome" }),
    codigoIbge: fields.string({ required: true, label: "Código IBGE" }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  // Coleção interna: leitura é usada pelos dropdowns; escrita não é exposta aos usuários.
  crud: { enabled: true, roles: { write: ["__localidades_internas__"] } },
});

entry.mongooseModel.schema.index({ codigoIbge: 1 });
entry.mongooseModel.schema.index({ estadoId: 1, nome: 1 });

agendarSincronizacao({
  connection: entry.mongooseModel.db,
  obterModels: () => ({
    Estado: registry.getModel("Estado")?.mongooseModel,
    Cidade: registry.getModel("Cidade")?.mongooseModel,
  }),
});
