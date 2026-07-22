const { defineModel, fields } = require("@oondemand/oon-core-back");

const emailOpcional = {
  type: String,
  trim: true,
  lowercase: true,
  validate: {
    validator: (valor) => !valor || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
    message: "E-mail inválido.",
  },
  __meta: { kind: "string", label: "E-mail", required: false, searchable: true },
};

defineModel({
  name: "Responsavel",
  singular: "responsavel",
  basePath: "/responsaveis",
  schema: {
    nome: fields.string({ required: true, label: "Nome" }),
    email: emailOpcional,
    tipo: fields.enum(["Operacional", "Pagamento", "Ambos"], {
      label: "Tipo",
      default: "Ambos",
    }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});
