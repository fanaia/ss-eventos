"use strict";

const { defineRoutes, registry, GenericError } = require("@oondemand/oon-core-back");
const {
  calcularSaldoFinanceiro,
  validarValorPagamento,
} = require("../services/pagamentosItem");
const { recalcularIndicadoresItem } = require("../services/omieIntegration");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

async function obterItem(id) {
  const item = await model("ProjetoItem").findById(id).lean();
  if (!item) {
    throw new GenericError("Item do projeto não encontrado.", { statusCode: 404 });
  }
  return item;
}

async function calcularSaldo(item) {
  const pagamentos = await model("Pagamento").find(
    {
      projetoItemId: item._id,
      canceladoNaCentral: { $ne: true },
    },
    { valor: 1 },
  ).lean();
  return calcularSaldoFinanceiro(item.contratacaoTotal, pagamentos);
}

defineRoutes("/projetos-itens", (router) => {
  router.private.get("/:id/pagamento-pendente", async (req, res) => {
    const item = await obterItem(req.params.id);
    const saldo = await calcularSaldo(item);
    res.json({
      dataPrevisaoPagamento: new Date().toISOString().slice(0, 10),
      omieContaCorrenteId: "",
      valor: saldo.valorPendente,
      nfRecebida: false,
      ...saldo,
    });
  });

  router.private.post(
    "/:id/gerar-pagamento",
    {
      roles: ["admin", "desenvolvedor"],
      audit: { entidade: "Pagamento", acao: "gerar_pagamento_item" },
    },
    async (req, res) => {
      const item = await obterItem(req.params.id);
      const saldo = await calcularSaldo(item);
      const valor = validarValorPagamento(req.body?.valor, saldo);
      const dados = {
        projetoId: item.projetoId,
        projetoItemId: item._id,
        dataPrevisaoPagamento: req.body?.dataPrevisaoPagamento,
        omieContaCorrenteId: req.body?.omieContaCorrenteId || null,
        valor,
        responsavelPagamentoId: req.body?.responsavelPagamentoId,
        nfRecebida: Boolean(req.body?.nfRecebida),
        etapa: "Solicitado",
        statusTrabalho: "Aguardando início",
      };

      const validate = registry.getValidation("Pagamento");
      if (validate) {
        await validate(dados, {
          op: "create",
          method: "post",
          current: null,
          changes: dados,
          consolidated: dados,
        });
      }

      const pagamento = await model("Pagamento").create(dados);
      const indicadores = await recalcularIndicadoresItem(item._id);
      res.status(201).json({ pagamento, indicadores });
    },
  );
});
