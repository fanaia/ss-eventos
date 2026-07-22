const { defineModel, fields } = require("@oondemand/oon-core-back");

defineModel({
  name: "Responsavel",
  singular: "responsavel",
  basePath: "/responsaveis",
  schema: {
    nome: fields.string({ required: true, label: "Nome" }),
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido."],
      __meta: { kind: "string", label: "E-mail", required: false, searchable: true },
    },
    tipo: fields.enum(["Operacional", "Pagamento", "Ambos"], {
      label: "Tipo",
      default: "Ambos",
    }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});
