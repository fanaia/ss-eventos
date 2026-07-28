"use strict";

const {
  defineModel,
  fields,
  registry,
  GenericError,
} = require("@oondemand/oon-core-back");
const {
  calcularValoresItem,
  resumirPagamento,
} = require("../services/calculosProjeto");
const {
  dadosComDependenciaOpcional,
  subcategoriaPertenceACategoria,
} = require("../services/dadosValidacao");

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

const textoCalculado = (label, valorPadrao = "") => ({
  type: String,
  default: valorPadrao,
  __meta: {
    kind: "string",
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
    // O Core atual usa os três primeiros campos de detalhe no card da esteira.
    // Estes campos ficam primeiro para apresentar o resumo financeiro solicitado.
    orcamentoTotal: moedaCalculada("Valor Orçado"),
    contratacaoTotal: moedaCalculada("Valor Contratado"),
    pagamentoResumo: textoCalculado("Pagamento", function resumoPagamentoPadrao() {
      const pendente = this.pagamentoValorPendente ?? Math.max(
        0,
        Number(this.contratacaoTotal || 0) - Number(this.pagamentoTotalPago || 0),
      );
      return resumirPagamento({
        status: this.pagamentoStatus,
        pendente,
      });
    }),

    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),
    faturamento: fields.enum(
      ["Agência", "Agência Interna", "Faturamento Direto"],
      { required: true, label: "Faturamento", default: "Agência" },
    ),
    estadoId: fields.ref("Estado", { required: true, label: "Estado" }),
    cidadeId: fields.ref("Cidade", { required: true, label: "Cidade" }),
    categoriaId: fields.ref("Categoria", { required: true, label: "Categoria" }),
    subcategoriaId: fields.ref("Categoria", { label: "Subcategoria" }),
    tipoCusto: fields.enum(["Fixo", "Variável"], {
      required: true,
      label: "Tipo de Custo",
      default: "Variável",
    }),
    nome: fields.string({ required: true, label: "Nome" }),
    descricao: fields.string({ label: "Descrição", searchable: true }),
    etapa: fields.enum(
      ["Pendente", "Em negociação", "Solicitado", "Em andamento", "Concluído", "Cancelado"],
      { required: true, label: "Etapa", default: "Pendente" },
    ),
    statusTrabalho: fields.enum(
      ["Aguardando início", "Trabalhando", "Revisar"],
      {
        required: true,
        label: "Status de trabalho",
        default: "Aguardando início",
      },
    ),
    responsavelId: fields.ref("Responsavel", {
      required: true,
      label: "Responsável",
    }),

    orcamentoQuantidade: quantidade("Orçamento - Qtd."),
    orcamentoDiarias: quantidade("Orçamento - Diárias"),
    orcamentoValorUnitario: fields.currency({ label: "Orçamento - Valor Unit." }),
    contratacaoQuantidade: quantidade("Contratação - Qtd."),
    contratacaoDiarias: quantidade("Contratação - Diárias"),
    contratacaoValorUnitario: fields.currency({ label: "Contratação - Valor Unit." }),

    fechamentoValor: moedaCalculada("Fechamento - Valor"),
    fechamentoFee: moedaCalculada("Fechamento - Fee"),
    fechamentoImposto: moedaCalculada("Fechamento - Impostos"),
    fechamentoTotal: moedaCalculada("Fechamento - Total"),
    fechamentoLucroValor: moedaCalculada("Lucro - Valor"),
    fechamentoLucroPercentual: percentualCalculado("Lucro - %"),
    fechamentoObservacao: fields.string({
      label: "Fechamento - Observação",
      searchable: false,
    }),

    pagamentoTotalPlanejado: moedaCalculada("Pagamentos planejados"),
    pagamentoTotalPago: moedaCalculada("Pago no Omie"),
    pagamentoValorPendente: moedaCalculada("Pendente de pagamento"),
    pagamentoStatus: fields.enum(
      [
        "Sem pagamento",
        "Pagamento pendente",
        "Enviado ao Omie",
        "Parcialmente pago",
        "Pago",
        "Divergência",
        "Erro de integração",
      ],
      {
        label: "Situação dos pagamentos",
        default: "Sem pagamento",
      },
    ),
  },
  crud: {
    enabled: true,
    roles: { write: ["desenvolvedor"] },
    populateRefs: true,
  },
});

const Model = entry.mongooseModel;
const createOriginal = Model.create.bind(Model);
const updateOriginal = Model.findByIdAndUpdate.bind(Model);
const insertOriginal = Model.insertMany.bind(Model);

async function obterProjeto(id) {
  const Projeto = registry.getModel("Projeto")?.mongooseModel;
  if (!Projeto) throw new GenericError("Model Projeto não registrada.");
  const projeto = await Projeto.findById(id).lean();
  if (!projeto) throw new GenericError("Projeto informado não foi encontrado.");
  return projeto;
}

async function normalizarSubcategoria(categoriaId, subcategoriaId) {
  if (!subcategoriaId) return null;
  const Categoria = registry.getModel("Categoria")?.mongooseModel;
  if (!Categoria) throw new GenericError("Model Categoria não registrada.");
  const subcategoria = await Categoria.findById(subcategoriaId).lean();
  return subcategoriaPertenceACategoria(categoriaId, subcategoria)
    ? subcategoria._id
    : null;
}

function removerCamposSistema(dados) {
  const resultado = { ...dados };
  for (const campo of ["_id", "__v", "createdAt", "updatedAt"]) {
    delete resultado[campo];
  }
  return resultado;
}

async function prepararRegistro(dados = {}) {
  const consolidado = { ...dados };
  consolidado.subcategoriaId = await normalizarSubcategoria(
    consolidado.categoriaId,
    consolidado.subcategoriaId,
  );
  return removerCamposSistema(
    calcularValoresItem(consolidado, await obterProjeto(consolidado.projetoId)),
  );
}

Model.create = async function criarProjetoItem(dados, opcoes = {}) {
  if (Array.isArray(dados)) {
    const calculados = [];
    for (const registro of dados) calculados.push(await prepararRegistro(registro));
    return createOriginal(calculados, opcoes);
  }

  const [criado] = await createOriginal([await prepararRegistro(dados)], opcoes);
  return criado;
};

Model.findByIdAndUpdate = async function atualizarProjetoItem(
  id,
  alteracoes,
  opcoes = {},
) {
  const atual = await Model.findById(id).lean();
  if (!atual) return null;

  const entrada = alteracoes?.$set ? { ...alteracoes.$set } : { ...alteracoes };
  const consolidado = dadosComDependenciaOpcional(
    entrada,
    { consolidated: { ...atual, ...entrada } },
    "categoriaId",
    "subcategoriaId",
  );
  consolidado.subcategoriaId = await normalizarSubcategoria(
    consolidado.categoriaId,
    consolidado.subcategoriaId,
  );

  const calculado = removerCamposSistema(
    calcularValoresItem(consolidado, await obterProjeto(consolidado.projetoId)),
  );
  return updateOriginal(id, calculado, opcoes);
};

Model.insertMany = async function inserirProjetoItens(registros, opcoes = {}) {
  const calculados = [];
  for (const registro of registros || []) {
    calculados.push(await prepararRegistro(registro));
  }
  return insertOriginal(calculados, opcoes);
};

module.exports = entry;
