const { defineModel, fields } = require("@oondemand/oon-core-back");

defineModel({
  name: "Categoria",
  singular: "categoria",
  basePath: "/categorias",
  schema: {
    nome: fields.string({ required: true, label: "Nome" }),
    categoriaPaiId: fields.ref("Categoria", { label: "Categoria Pai" }),
    descricao: fields.string({ label: "Descrição", searchable: true }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});
