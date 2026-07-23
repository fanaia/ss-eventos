const { defineModel, fields, registry, GenericError } = require("@oondemand/oon-core-back");

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

const entry = defineModel({
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
  crud: {
    enabled: true,
    roles: { write: ["desenvolvedor"] },
    populateRefs: true,
  },
});

const Model = entry.mongooseModel;
const findByIdAndDeleteOriginal = Model.findByIdAndDelete.bind(Model);

Model.findByIdAndDelete = async function excluirContatoSeguro(id, opcoes = {}) {
  const Projeto = registry.getModel("Projeto")?.mongooseModel;
  if (Projeto && await Projeto.exists({ contatoPrincipalId: id })) {
    throw new GenericError(
      "Este contato é o contato principal de um projeto. Inative o contato ou altere o projeto antes de excluir.",
      { statusCode: 409 }
    );
  }
  return findByIdAndDeleteOriginal(id, opcoes);
};
