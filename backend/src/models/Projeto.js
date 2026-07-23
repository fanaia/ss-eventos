const { defineModel, fields } = require("@oondemand/oon-core-back");

const percentual = (label) => ({
  type: Number,
  required: true,
  min: 0,
  max: 100,
  default: 0,
  __meta: { kind: "number", label, required: true },
});

defineModel({
  name: "Projeto",
  singular: "projeto",
  basePath: "/projetos",
  schema: {
    nome: fields.string({ required: true, label: "Nome" }),
    fornecedorId: fields.ref("ClienteFornecedor", { required: true, label: "Fornecedor" }),
    clienteId: fields.ref("ClienteFornecedor", { required: true, label: "Cliente" }),
    contatoPrincipalId: fields.ref("Contato", { required: true, label: "Contato Principal" }),
    percentualFee: percentual("% Fee"),
    percentualImposto: percentual("% Imposto"),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: {
    enabled: true,
    roles: { write: ["desenvolvedor"] },
    populateRefs: true,
  },
});
