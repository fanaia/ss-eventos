const { defineRoutes, registry, GenericError } = require("@oondemand/oon-core-back");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

function arredondar(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

async function obterItem(itemId) {
  const item = await model("ProjetoItem").findById(itemId).lean();
  if (!item) throw new GenericError("Item do projeto não encontrado.", { statusCode: 404 });
  return item;
}

async function calcularSaldo(item) {
  const pagamentos = await model("Pagamento")
    .find({ projetoItemId: item._id }, { valor: 1 })
    .lean();
  const totalGerado = arredondar(
    pagamentos.reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0)
  );
  const totalFechado = arredondar(item.fechamentoTotalComImpostoFee || 0);
  return {
    totalFechado,
    totalGerado,
    valorPendente: arredondar(Math.max(0, totalFechado - totalGerado)),
  };
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

defineRoutes("/projetos-itens", (router) => {
  router.private.get("/:id/pagamento-pendente", async (req, res) => {
    const item = await obterItem(req.params.id);
    const saldo = await calcularSaldo(item);
    res.json({
      dataPrevisaoPagamento: hoje(),
      formaPagamento: "",
      valor: saldo.valorPendente,
      nfRecebida: false,
      ...saldo,
    });
  });

  router.private.post(
    "/:id/gerar-pagamento",
    {
      roles: ["desenvolvedor"],
      audit: { entidade: "Pagamento", acao: "gerar_pagamento_item" },
    },
    async (req, res) => {
      const item = await obterItem(req.params.id);
      const saldo = await calcularSaldo(item);
      const valor = arredondar(req.body?.valor);

      if (saldo.totalFechado <= 0) {
        throw new GenericError("Informe o fechamento do item antes de gerar pagamentos.");
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        throw new GenericError("O valor do pagamento deve ser maior que zero.", {
          details: { field: "valor", message: "Informe um valor maior que zero." },
        });
      }
      if (valor > saldo.valorPendente) {
        throw new GenericError(
          `O valor informado excede o saldo pendente de R$ ${saldo.valorPendente.toFixed(2)}.`,
          { details: { field: "valor", message: "O valor não pode exceder o saldo pendente." } }
        );
      }

      const dados = {
        projetoId: item.projetoId,
        projetoItemId: item._id,
        dataPrevisaoPagamento: req.body?.dataPrevisaoPagamento,
        formaPagamento: req.body?.formaPagamento,
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
      res.status(201).json({ pagamento });
    }
  );
});
