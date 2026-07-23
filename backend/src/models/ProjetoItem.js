const { defineModel, fields, registry, GenericError } = require("@oondemand/oon-core-back");
const { calcularValoresItem } = require("../services/calculosProjeto");

const quantidade = (label) => ({
  type: Number,
  min: 0,
  default: 0,
  __meta: { kind: "number", label, required: false },
});

const moedaCalculada = (label) => ({
  type: Number,
  default: 0,
  __meta: {
    kind: "currency",
    label,
    required: false,
    readonly: true,
    readOnly: true,
  },
});

const percentualCalculado = (label) => ({
  type: Number,
  default: 0,
  __meta: {
    kind: "number",
    label,
    required: false,
    readonly: true,
    readOnly: true,
  },
});

const entry = defineModel({
  name: "ProjetoItem",
  singular: "projetoItem",
  basePath: "/projetos-itens",
  schema: {
    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),
    faturamento: fields.enum(["Agência", "Agência Interna", "Faturamento Direto"], {
      required: true,
      label: "Faturamento",
      default: "Agência",
    }),
    estadoId: fields.ref("Estado", { required: true, label: "Estado" }),
    cidadeId: fields.ref("Cidade", { required: true, label: "Cidade" }),
    categoriaId: fields.ref("Categoria", { required: true, label: "Categoria" }),
    subcategoriaId: fields.ref("Categoria", { required: true, label: "Subcategoria" }),
    tipoCusto: fields.enum(["Fixo", "Variável"], {
      required: true,
      label: "Tipo de Custo",
      default: "Variável",
    }),
    nome: fields.string({ required: true, label: "Nome" }),
    descricao: fields.string({ label: "Descrição", searchable: true }),
    etapa: fields.enum(
      ["Pendente", "Em negociação", "Solicitado", "Em andamento", "Concluído", "Cancelado"],
      { required: true, label: "Etapa", default: "Pendente" }
    ),
    statusTrabalho: fields.enum(
      ["Aguardando início", "Trabalhando", "Revisar"],
      { required: true, label: "Status de trabalho", default: "Aguardando início" }
    ),
    responsavelId: fields.ref("Responsavel", { required: true, label: "Responsável" }),

    orcamentoQuantidade: quantidade("Orçamento - Qtd."),
    orcamentoDiarias: quantidade("Orçamento - Diárias"),
    orcamentoValorUnitario: fields.currency({ label: "Orçamento - Valor Unit." }),
    orcamentoTotal: moedaCalculada("Orçamento - Total"),

    contratacaoQuantidade: quantidade("Contratação - Qtd."),
    contratacaoDiarias: quantidade("Contratação - Diárias"),
    contratacaoValorUnitario: fields.currency({ label: "Contratação - Valor Unit." }),
    contratacaoTotal: moedaCalculada("Contratação - Total"),

    fechamentoValor: moedaCalculada("Fechamento - Valor"),
    fechamentoFee: moedaCalculada("Fechamento - Fee"),
    fechamentoImposto: moedaCalculada("Fechamento - Impostos"),
    fechamentoTotal: moedaCalculada("Fechamento - Total"),
    fechamentoLucroValor: moedaCalculada("Lucro - Valor"),
    fechamentoLucroPercentual: percentualCalculado("Lucro - %"),
    fechamentoObservacao: fields.string({ label: "Fechamento - Observação", searchable: false }),
  },
  crud: {
    enabled: true,
    roles: { write: ["desenvolvedor"] },
    populateRefs: true,
  },
});

const Model = entry.mongooseModel;
const findByIdAndUpdateOriginal = Model.findByIdAndUpdate.bind(Model);
const insertManyOriginal = Model.insertMany.bind(Model);

async function obterProjeto(projetoId) {
  const Projeto = registry.getModel("Projeto")?.mongooseModel;
  if (!Projeto) throw new GenericError("Model Projeto não registrada.");

  const projeto = await Projeto.findById(projetoId).lean();
  if (!projeto) throw new GenericError("Projeto informado não foi encontrado.");
  return projeto;
}

function removerCamposSistema(dados) {
  const resultado = { ...dados };
  for (const campo of ["_id", "__v", "createdAt", "updatedAt"]) delete resultado[campo];
  return resultado;
}

Model.findByIdAndUpdate = async function findByIdAndUpdateComCalculo(id, alteracoes, opcoes = {}) {
  const atual = await Model.findById(id).lean();
  if (!atual) return null;

  const entrada = alteracoes?.$set ? { ...alteracoes.$set } : { ...alteracoes };
  const consolidado = { ...atual, ...entrada };
  const projeto = await obterProjeto(consolidado.projetoId);
  const calculado = removerCamposSistema(calcularValoresItem(consolidado, projeto));

  return findByIdAndUpdateOriginal(id, calculado, opcoes);
};

Model.insertMany = async function insertManyComCalculo(registros, opcoes = {}) {
  const calculados = [];
  for (const registro of registros || []) {
    const projeto = await obterProjeto(registro.projetoId);
    calculados.push(removerCamposSistema(calcularValoresItem(registro, projeto)));
  }
  return insertManyOriginal(calculados, opcoes);
};
