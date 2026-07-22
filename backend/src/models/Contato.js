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
  name: "Contato",
  singular: "contato",
  basePath: "/contatos",
  schema: {
    clienteFornecedorId: fields.ref("ClienteFornecedor", {
      required: true,
      label: "Cliente/Fornecedor",
    }),
    cargo: fields.string({ label: "Cargo" }),
    nome: fields.string({ required: true, label: "Nome" }),
    telefone: fields.string({ label: "Telefone" }),
    email: emailOpcional,
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});
