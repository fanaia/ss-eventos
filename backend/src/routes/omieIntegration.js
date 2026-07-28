"use strict";

const { defineRoutes, registry, GenericError } = require("@oondemand/oon-core-back");
const { criarOmieClient } = require("../services/omieClient");
const {
  atualizarDashboardIntegracoes,
  consultarContaPagar,
  enviarContaPagar,
} = require("../services/omieIntegration");
const {
  hashPayload,
  hashSegredo,
  compararHashSeguro,
  sanitizarErro,
} = require("../services/omieUtils");
const {
  obterOuCriarConfiguracaoAtiva,
  obterCredenciaisConfiguracao,
  obterTokenWebhookAtivo,
} = require("../models/OmieConfiguracao");
const { enfileirarIntegracao } = require("../models/IntegrationOutbox");

const ROLES = ["admin", "desenvolvedor"];

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

function evento(body) {
  return body?.event?.topic
    || body?.topic
    || body?.eventType
    || body?.evento
    || body?.event
    || "OmieWebhook";
}

function idEvento(body) {
  return body?.event?.id || body?.id || body?.eventId || body?.id_evento || "";
}

function configuracaoParaUi(config) {
  const webhookUrl = config?.webhookUrl || "";
  return {
    _id: String(config?._id || ""),
    nome: config?.nome || "Omie SS Eventos",
    ambiente: config?.ambiente || "Produção",
    urlPublica: config?.urlPublica || "",
    appKeyMascarada: config?.appKeyMascarada || "",
    credenciaisConfiguradas: Boolean(config?.credenciaisConfiguradas),
    statusConexao: config?.statusConexao || "Não testado",
    ultimoErroConexao: config?.ultimoErroConexao || "",
    enabled: process.env.OMIE_ENABLED === "true",
    webhooks: [
      {
        event: "ContaPagar.Alterado",
        label: "Atualizações e baixas de contas a pagar",
        description: "Recebe alterações financeiras do Omie e atualiza o pagamento na Central.",
        url: webhookUrl || null,
      },
    ],
  };
}

function filtroTexto(query, campos) {
  const texto = String(query || "").trim();
  if (!texto) return {};
  const expressao = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return { $or: campos.map((campo) => ({ [campo]: expressao })) };
}

async function listar(Model, filtro, selecao, limite) {
  return Model.find(filtro)
    .select(selecao)
    .sort({ descricao: 1, nome: 1, codigo: 1 })
    .limit(limite)
    .lean();
}

async function executarEObterPagamento(id, operacao) {
  const resultadoIntegracao = await operacao(id);
  const pagamento = await model("Pagamento").findById(id).lean();
  if (!pagamento) {
    throw new GenericError("Pagamento não encontrado após a integração.", {
      statusCode: 404,
    });
  }

  // O registro atualizado fica no nível raiz para o apiAction poder mesclar o
  // retorno no ticket aberto. `data` mantém compatibilidade com consumidores
  // que esperam a entidade dentro de um envelope.
  return {
    ...pagamento,
    data: pagamento,
    resultadoIntegracao,
  };
}

defineRoutes("/integracoes/omie", (router) => {
  router.private.get("/configuracao", { roles: ROLES }, async (_req, res) => {
    const config = await obterOuCriarConfiguracaoAtiva();
    res.json({ configuracao: configuracaoParaUi(config) });
  });

  router.private.put(
    "/configuracao",
    {
      roles: ROLES,
      audit: { entidade: "OmieConfiguracao", acao: "atualizar_configuracao" },
    },
    async (req, res) => {
      const atual = await obterOuCriarConfiguracaoAtiva();
      const permitido = ["nome", "ambiente", "urlPublica", "appKey", "appSecret"];
      const alteracoes = {};
      for (const campo of permitido) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, campo)) {
          alteracoes[campo] = req.body[campo];
        }
      }
      const atualizado = await model("OmieConfiguracao").findByIdAndUpdate(
        atual._id,
        { $set: alteracoes },
        { new: true },
      );
      res.json({ configuracao: configuracaoParaUi(atualizado) });
    },
  );

  router.private.get("/listas/clientes-prestadores", { roles: ROLES }, async (req, res) => {
    const data = await listar(
      model("ClienteFornecedor"),
      filtroTexto(req.query?.q, ["nome", "documento", "codigoClienteIntegracao"]),
      "nome documento cliente fornecedor status origem codigoClienteOmie codigoClienteIntegracao omieStatusIntegracao",
      500,
    );
    res.json({ data });
  });

  router.private.get("/listas/categorias", { roles: ROLES }, async (req, res) => {
    const data = await listar(
      model("OmieCategoria"),
      {
        ...filtroTexto(req.query?.q, ["codigo", "descricao"]),
        status: req.query?.status || "Ativo",
      },
      "codigo descricao natureza tipoCategoria categoriaSuperiorCodigo totalizadora transferencia contaInativa contaDespesa status sincronizadoEm",
      500,
    );
    res.json({ data });
  });

  router.private.get("/listas/contas-correntes", { roles: ROLES }, async (req, res) => {
    const data = await listar(
      model("OmieContaCorrente"),
      {
        ...filtroTexto(
          req.query?.q,
          ["descricao", "codigoIntegracao", "codigoBanco", "numeroConta"],
        ),
        status: req.query?.status || "Ativo",
      },
      "codigo codigoIntegracao descricao tipo codigoBanco codigoAgencia numeroConta inativa bloqueada status sincronizadoEm",
      300,
    );
    res.json({ data });
  });

  router.private.post(
    "/testar-conexao",
    {
      roles: ROLES,
      audit: { entidade: "OmieConfiguracao", acao: "testar_conexao" },
    },
    async (_req, res) => {
      const { config, appKey, appSecret } = await obterCredenciaisConfiguracao();
      if (!appKey || !appSecret) {
        throw new GenericError("Informe App Key e App Secret antes de testar.", {
          statusCode: 409,
        });
      }
      try {
        const resposta = await criarOmieClient({ appKey, appSecret }).chamar(
          "clientes",
          "ListarClientes",
          [{ pagina: 1, registros_por_pagina: 1, apenas_importado_api: "N" }],
        );
        await model("OmieConfiguracao").updateOne(
          { _id: config._id },
          {
            $set: {
              statusConexao: "OK",
              ultimoErroConexao: "",
              credenciaisConfiguradas: true,
            },
          },
        );
        res.json({
          ok: true,
          message: "Conexão com o Omie validada pelo endpoint de Clientes/Fornecedores.",
          totalClientes: Number(resposta.total_de_registros || 0),
        });
      } catch (erro) {
        const mensagem = sanitizarErro(erro);
        await model("OmieConfiguracao").updateOne(
          { _id: config._id },
          { $set: { statusConexao: "Erro", ultimoErroConexao: mensagem } },
        );
        throw new GenericError(mensagem, { statusCode: 502 });
      }
    },
  );

  router.private.post(
    "/pagamentos/:id/enviar",
    {
      roles: ROLES,
      audit: { entidade: "Pagamento", acao: "enviar_omie" },
    },
    async (req, res) => {
      res.json(await executarEObterPagamento(req.params.id, enviarContaPagar));
    },
  );

  router.private.post(
    "/pagamentos/:id/reconciliar",
    { roles: ROLES },
    async (req, res) => {
      res.json(await executarEObterPagamento(req.params.id, consultarContaPagar));
    },
  );

  router.public.post("/webhooks/:token", async (req, res) => {
    const esperado = await obterTokenWebhookAtivo();
    if (!esperado || !compararHashSeguro(req.params.token, hashSegredo(esperado))) {
      return res.status(401).json({ error: "Webhook não autorizado." });
    }

    const tamanho = Buffer.byteLength(JSON.stringify(req.body || {}), "utf8");
    if (tamanho > Number(process.env.OMIE_WEBHOOK_MAX_BYTES || 1048576)) {
      return res.status(413).json({ error: "Payload excede o limite permitido." });
    }

    const payloadHash = hashPayload(req.body || {});
    const Inbox = model("WebhookInbox");
    let inbox = await Inbox.findOne({ provider: "omie", payloadHash }).lean();
    if (!inbox) {
      try {
        inbox = await Inbox.create({
          provider: "omie",
          resource: "contas-pagar",
          eventType: String(evento(req.body)).slice(0, 200),
          externalEventId: String(idEvento(req.body)).slice(0, 200),
          payload: req.body || {},
          payloadHash,
          receivedAt: new Date(),
          status: "Pendente",
        });
      } catch (erro) {
        if (erro?.code !== 11000) throw erro;
        inbox = await Inbox.findOne({ provider: "omie", payloadHash }).lean();
      }
    }

    await enfileirarIntegracao({
      provider: "omie",
      handler: "OMIE_WEBHOOK_PROCESSAR",
      tipo: "OMIE_WEBHOOK_PROCESSAR",
      resource: "contas-pagar",
      operation: "webhook",
      aggregateType: "WebhookInbox",
      aggregateId: inbox?._id,
      idempotencyKey: `omie:webhook:${payloadHash}`,
      payload: { webhookInboxId: String(inbox?._id || "") },
    });
    await atualizarDashboardIntegracoes();
    return res.status(202).json({
      accepted: true,
      duplicate: Boolean(inbox?.processedAt),
    });
  });
});
