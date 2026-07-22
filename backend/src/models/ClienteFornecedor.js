const { defineModel, fields } = require("@oondemand/oon-core-back");

function somenteDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function todosIguais(valor) {
  return /^(\d)\1+$/.test(valor);
}

function cpfValido(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;

  const calcularDigito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

function cnpjValido(valor) {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;

  const calcularDigito = (base, pesos) => {
    const soma = base.reduce((total, digito, indice) => total + Number(digito) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const numeros = cnpj.slice(0, 12).split("");
  const primeiro = calcularDigito(numeros, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcularDigito([...numeros, String(primeiro)], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(cnpj[12]) && segundo === Number(cnpj[13]);
}

async function tipoDoContexto(contexto) {
  if (contexto?.tipo) return contexto.tipo;
  if (typeof contexto?.getUpdate !== "function") return undefined;

  const update = contexto.getUpdate() || {};
  const tipo = update.tipo || update.$set?.tipo;
  if (tipo) return tipo;

  const atual = await contexto.model.findOne(contexto.getQuery()).select("tipo").lean();
  return atual?.tipo;
}

const documento = {
  type: String,
  required: true,
  trim: true,
  validate: {
    validator: async function validarDocumento(valor) {
      const tipo = await tipoDoContexto(this);
      if (tipo === "PF") return cpfValido(valor);
      if (tipo === "PJ") return cnpjValido(valor);
      return tipo === "Est" && String(valor || "").trim().length > 0;
    },
    message: "Documento inválido para o tipo informado.",
  },
  __meta: { kind: "string", label: "Documento", required: true, searchable: true },
};

defineModel({
  name: "ClienteFornecedor",
  singular: "clienteFornecedor",
  basePath: "/clientes-fornecedores",
  schema: {
    cliente: fields.boolean({ label: "Cliente", default: false }),
    fornecedor: fields.boolean({ label: "Fornecedor", default: false }),
    nome: fields.string({ required: true, label: "Nome" }),
    tipo: fields.enum(["PF", "PJ", "Est"], { required: true, label: "Tipo", default: "PJ" }),
    documento,
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

module.exports = { cpfValido, cnpjValido };
