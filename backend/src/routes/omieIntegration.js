"use strict";

const { defineRoutes, registry, GenericError } = require("@oondemand/oon-core-back");
const { criarOmieClient } = require("../services/omieClient");
const {
  importarClientes,
  importarCategorias,
  importarFormasPagamento,
  enviarContaPagar,
  consultarContaPagar,
  reconciliarFinanceiro,
  processarFila,
  processarWebhooksPendentes,
  enfileirarSincronizacaoCompleta,
  atualizarDashboardIntegracoes,
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

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

function evento(body) {
  return body?.event?.topic || body?.topic || body?.eventType || body?.evento || body?.event || "OmieWebhook";
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
    contaCorrenteId: config?.contaCorrenteId || null,
    appKeyMascarada: config?.appKeyMascarada || "",
    credenciaisConfiguradas: Boolean(config?.credenciaisConfiguradas),
    statusConexao: config?.statusConexao || "Não testado",
    ultimoErroConexao: config?.ultimoErroConexao || "",
    webhookUrl,
    enabled: process.env.OMIE_ENABLED === "true",
    webhooks: [
      {
        event: "ContaPagar.Alterado",
        label: "Atualizações e baixas de contas a pagar",
        description: "Recebe alterações financeiras do Omie e agenda a atualização do pagamento na Central.",
        url: webhookUrl || null,
      },
    ],
  };
}

async function obterTicket(id) {
  const ticket = await model("IntegrationOutbox").findById(id).lean();
  if (!ticket) throw new GenericError("Ticket de integração não encontrado.", { statusCode: 404 });
  return ticket;
}

defineRoutes("/integracoes/omie", (router) => {
  router.private.get("/configuracao", { roles: ["desenvolvedor"] }, async (_req, res) => {
    const config = await obterOuCriarConfiguracaoAtiva();
    res.json({ configuracao: configuracaoParaUi(config) });
  });

  router.private.put(
    "/configuracao",
    {
      roles: ["desenvolvedor"],
      audit: { entidade: "OmieConfiguracao", acao: "atualizar_configuracao" },
    },
    async (req, res) => {
      const atual = await obterOuCriarConfiguracaoAtiva();
      const permitido = [
        "nome",
        "ambiente",
        "urlPublica",
        "contaCorrenteId",
        "appKey",
        "appSecret",
      ];
      const alteracoes = {};
      for (const campo of permitido) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, campo)) alteracoes[campo] = req.body[campo];
      }
      const atualizado = await model("OmieConfiguracao").findByIdAndUpdate(
        atual._id,
        { $set: alteracoes },
        { new: true },
      );
      res.json({ configuracao: configuracaoParaUi(atualizado) });
    },
  );

  router.private.get("/status", { roles: ["desenvolvedor"] }, async (_req, res) => {
    const indicadores = await atualizarDashboardIntegracoes();
    const config = await obterOuCriarConfiguracaoAtiva();
    res.json({
      enabled: process.env.OMIE_ENABLED === "true",
      credentialsConfigured: Boolean(config.credenciaisConfiguradas),
      config,
      indicadores,
    });
  });

  router.private.get("/webhook-url", { roles: ["desenvolvedor"] }, async (_req, res) => {
    const config = await obterOuCriarConfiguracaoAtiva();
    res.json({ webhookUrl: config.webhookUrl || "" });
  });

  router.private.post(
    "/testar-conexao",
    { roles: ["desenvolvedor"], audit: { entidade: "OmieConfiguracao", acao: "testar_conexao" } },
    async (_req, res) => {
      const { config, appKey, appSecret } = await obterCredenciaisConfiguracao();
      if (!appKey || !appSecret) {
        throw new GenericError("Informe App Key e App Secret nas Configurações antes de testar.", { statusCode: 409 });
      }
      try {
        const resposta = await criarOmieClient({ appKey, appSecret }).chamar(
          "categorias",
          "ListarCategorias",
          [{ pagina: 1, registros_por_pagina: 1 }],
        );
        await model("OmieConfiguracao").updateOne(
          { _id: config._id },
          { $set: { statusConexao: "OK", ultimoErroConexao: "", credenciaisConfiguradas: true } },
        );
        res.json({ ok: true, message: "Conexão com o Omie validada com sucesso.", totalCategorias: Number(resposta.total_de_registros || 0) });
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
    "/sincronizar",
    { roles: ["desenvolvedor"], audit: { entidade: "Omie", acao: "sincronizar_cadastros" } },
    async (req, res) => {
      const enfileirado = await enfileirarSincronizacaoCompleta();
      const resultado = req.body?.processarAgora ? await processarFila({ limite: 10 }) : null;
      res.status(202).json({ ...enfileirado, resultado });
    },
  );

  router.private.post("/sincronizar/clientes", { roles: ["desenvolvedor"] }, async (_req, res) => {
    res.json(await importarClientes());
  });
  router.private.post("/sincronizar/categorias", { roles: ["desenvolvedor"] }, async (_req, res) => {
    res.json(await importarCategorias());
  });
  router.private.post("/sincronizar/formas-pagamento", { roles: ["desenvolvedor"] }, async (_req, res) => {
    res.json(await importarFormasPagamento());
  });

  router.private.post(
    "/pagamentos/:id/enviar",
    { roles: ["desenvolvedor"], audit: { entidade: "Pagamento", acao: "enviar_omie" } },
    async (req, res) => res.json(await enviarContaPagar(req.params.id)),
  );
  router.private.post("/pagamentos/:id/reconciliar", { roles: ["desenvolvedor"] }, async (req, res) => {
    res.json(await consultarContaPagar(req.params.id));
  });
  router.private.post("/reconciliar", { roles: ["desenvolvedor"] }, async (req, res) => {
    res.json(await reconciliarFinanceiro({ limite: req.body?.limite }));
  });
  router.private.post("/fila/processar", { roles: ["desenvolvedor"] }, async (req, res) => {
    res.json(await processarFila({ limite: req.body?.limite }));
  });
  router.private.post("/webhooks/processar", { roles: ["desenvolvedor"] }, async (req, res) => {
    res.json(await processarWebhooksPendentes({ limite: req.body?.limite }));
  });

  router.private.post(
    "/fila/:id/arquivar",
    { roles: ["desenvolvedor"], audit: { entidade: "IntegrationOutbox", acao: "arquivar_erro" } },
    async (req, res) => {
      const ticket = await obterTicket(req.params.id);
      if (!["Erro temporário", "Erro definitivo"].includes(ticket.status)) {
        throw new GenericError("Somente tickets com erro podem ser arquivados.", { statusCode: 409 });
      }
      const atualizado = await model("IntegrationOutbox").findByIdAndUpdate(
        ticket._id,
        {
          $set: {
            statusAnterior: ticket.status,
            status: "Arquivado",
            arquivadoEm: new Date(),
            motivoArquivamento: String(req.body?.motivo || "Erro reconhecido e arquivado manualmente.").slice(0, 500),
            lockedAt: null,
            lockedBy: "",
            proximaTentativaEm: null,
          },
        },
        { new: true },
      );
      await atualizarDashboardIntegracoes();
      res.json(atualizado);
    },
  );

  router.private.post(
    "/fila/:id/reprocessar",
    { roles: ["desenvolvedor"], audit: { entidade: "IntegrationOutbox", acao: "reprocessar" } },
    async (req, res) => {
      const ticket = await obterTicket(req.params.id);
      if (!["Erro temporário", "Erro definitivo", "Arquivado"].includes(ticket.status)) {
        throw new GenericError("Este ticket não está em uma situação que permita reprocessamento.", { statusCode: 409 });
      }
      const atualizado = await model("IntegrationOutbox").findByIdAndUpdate(
        ticket._id,
        {
          $set: {
            status: "Pendente",
            statusAnterior: ticket.status,
            tentativas: 0,
            proximaTentativaEm: new Date(),
            ultimoErro: "",
            arquivadoEm: null,
            motivoArquivamento: "",
            lockedAt: null,
            lockedBy: "",
          },
        },
        { new: true },
      );
      await atualizarDashboardIntegracoes();
      res.json(atualizado);
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
    return res.status(202).json({ accepted: true, duplicate: Boolean(inbox?.processedAt) });
  });
});
