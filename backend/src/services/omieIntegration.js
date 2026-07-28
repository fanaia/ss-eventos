"use strict";

const { registry, GenericError } = require("@oondemand/oon-core-back");
const { criarOmieClient, OmieApiError } = require("./omieClient");
const {
  mapearClienteParaOmie,
  mapearContaPagar,
  extrairEstadoContaPagar,
} = require("./omieMappers");
const {
  hashPayload,
  sanitizarErro,
  codigoPagamentoIntegracao,
  arredondarMoeda,
  dataIsoDeOmie,
} = require("./omieUtils");
const {
  obterOuCriarConfiguracaoAtiva,
  obterCredenciaisConfiguracao,
} = require("../models/OmieConfiguracao");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

function exigirIntegracaoAtiva() {
  if (process.env.OMIE_ENABLED !== "true") {
    throw new GenericError(
      "A integração Omie está desativada. Ative OMIE_ENABLED=true após testar as credenciais.",
      { statusCode: 503 },
    );
  }
}

async function contexto(opcoes = {}) {
  exigirIntegracaoAtiva();
  const { config, appKey, appSecret } = await obterCredenciaisConfiguracao();
  return {
    config,
    client: opcoes.client || criarOmieClient({ appKey, appSecret }),
  };
}

async function atualizarDashboardIntegracoes() {
  const [config, fila, webhooksPendentes, clientes, pagamentos] = await Promise.all([
    obterOuCriarConfiguracaoAtiva(),
    model("IntegrationOutbox").aggregate([
      { $group: { _id: "$status", total: { $sum: 1 } } },
    ]),
    model("WebhookInbox").countDocuments({
      status: { $in: ["Pendente", "Processando", "Erro"] },
    }),
    model("ClienteFornecedor").aggregate([
      { $group: { _id: "$omieStatusIntegracao", total: { $sum: 1 } } },
    ]),
    model("Pagamento").aggregate([
      { $group: { _id: "$omieStatusIntegracao", total: { $sum: 1 } } },
    ]),
  ]);

  const contar = (linhas, status) => Number(
    linhas.find((item) => item._id === status)?.total || 0,
  );
  const indicadores = {
    integracoesPendentes: contar(fila, "Pendente") + contar(fila, "Erro temporário"),
    integracoesProcessando: contar(fila, "Processando"),
    integracoesComErro: contar(fila, "Erro definitivo"),
    integracoesConcluidas: contar(fila, "Concluído"),
    integracoesArquivadas: contar(fila, "Arquivado"),
    webhooksPendentes,
    clientesSincronizados: contar(clientes, "Sincronizado"),
    clientesPendentes: contar(clientes, "Pendente"),
    clientesComErro: contar(clientes, "Erro") + contar(clientes, "Conflito"),
    pagamentosEnviados: contar(pagamentos, "Enviado"),
    pagamentosComErro: contar(pagamentos, "Erro"),
    ultimaAtualizacaoDashboardEm: new Date(),
  };
  await model("OmieConfiguracao").updateOne({ _id: config._id }, { $set: indicadores });
  return indicadores;
}

async function sincronizarCliente(id, opcoes = {}) {
  const { client } = await contexto(opcoes);
  const Cliente = model("ClienteFornecedor");
  const cliente = await Cliente.findById(id).lean();
  if (!cliente) {
    throw new GenericError("Cliente/Fornecedor não encontrado.", { statusCode: 404 });
  }

  const contato = await model("Contato")
    .findOne({ clienteFornecedorId: cliente._id, status: "Ativo" })
    .sort({ createdAt: 1 })
    .lean();
  const payload = mapearClienteParaOmie(cliente, contato);

  try {
    const resposta = await client.chamar("clientes", "UpsertCliente", [payload]);
    const codigo = Number(
      resposta.codigo_cliente_omie
      || resposta.codigo_cliente
      || cliente.codigoClienteOmie
      || 0,
    ) || undefined;
    await Cliente.updateOne(
      { _id: cliente._id },
      {
        $set: {
          codigoClienteOmie: codigo,
          codigoClienteIntegracao: payload.codigo_cliente_integracao,
          omieSincronizadoEm: new Date(),
          omieStatusIntegracao: "Sincronizado",
          omieUltimoErro: "",
          omiePayloadHash: hashPayload(payload),
          omieVersaoLocalSincronizada: Number(cliente.omieVersaoLocal || 1),
        },
      },
    );
    return {
      codigoClienteOmie: codigo,
      codigoClienteIntegracao: payload.codigo_cliente_integracao,
    };
  } catch (erro) {
    await Cliente.updateOne(
      { _id: cliente._id },
      { $set: { omieStatusIntegracao: "Erro", omieUltimoErro: sanitizarErro(erro) } },
    );
    throw erro;
  }
}

function categoriasPorPrioridade(item, categorias) {
  const porId = new Map(categorias.map((categoria) => [String(categoria._id), categoria]));
  return [
    porId.get(String(item.subcategoriaId || "")),
    porId.get(String(item.categoriaId || "")),
  ].filter(Boolean);
}

async function resolverMapeamentoFinanceiro(item, pagamento) {
  const ids = [item.subcategoriaId, item.categoriaId].filter(Boolean);
  const categorias = await model("Categoria").find({ _id: { $in: ids } }).lean();
  const categoriaLocal = categoriasPorPrioridade(item, categorias)
    .find((registro) => registro.omieCategoriaId);

  if (!categoriaLocal) {
    throw new GenericError(
      "Relacione a categoria ou subcategoria do item com uma Categoria Omie.",
      { statusCode: 409 },
    );
  }
  if (!pagamento.omieContaCorrenteId) {
    throw new GenericError(
      "Selecione a Conta Corrente Omie do pagamento antes de enviá-lo.",
      { statusCode: 409 },
    );
  }

  const [categoria, contaCorrente] = await Promise.all([
    model("OmieCategoria").findById(categoriaLocal.omieCategoriaId).lean(),
    model("OmieContaCorrente").findById(pagamento.omieContaCorrenteId).lean(),
  ]);

  if (
    !categoria
    || categoria.status !== "Ativo"
    || categoria.contaInativa
    || categoria.totalizadora
    || categoria.transferencia
    || categoria.naoExibir
  ) {
    throw new GenericError(
      "A Categoria Omie vinculada está inativa ou não pode receber lançamentos.",
      { statusCode: 409 },
    );
  }

  if (
    !contaCorrente
    || contaCorrente.status !== "Ativo"
    || contaCorrente.inativa
    || contaCorrente.bloqueada
  ) {
    throw new GenericError(
      "A Conta Corrente Omie selecionada no pagamento está inativa ou bloqueada.",
      { statusCode: 409 },
    );
  }

  return { categoria, contaCorrente };
}

async function fornecedorDoPagamento(pagamento, opcoes) {
  const item = await model("ProjetoItem").findById(pagamento.projetoItemId).lean();
  const projeto = item ? await model("Projeto").findById(item.projetoId).lean() : null;
  if (!item || !projeto) {
    throw new GenericError("Item ou projeto do pagamento não encontrado.", { statusCode: 409 });
  }

  let fornecedor = await model("ClienteFornecedor").findById(projeto.fornecedorId).lean();
  if (!fornecedor?.fornecedor) {
    throw new GenericError("Fornecedor do projeto inválido.", { statusCode: 409 });
  }
  if (!fornecedor.codigoClienteOmie || fornecedor.omieStatusIntegracao !== "Sincronizado") {
    await sincronizarCliente(fornecedor._id, opcoes);
    fornecedor = await model("ClienteFornecedor").findById(fornecedor._id).lean();
  }
  return { item, fornecedor };
}

async function aplicarEstadoPagamento(pagamento, titulo) {
  const estado = extrairEstadoContaPagar(titulo);
  await model("Pagamento").findByIdAndUpdate(
    pagamento._id,
    {
      $set: {
        codigoLancamentoOmie: estado.codigoLancamentoOmie || pagamento.codigoLancamentoOmie,
        omieValorTitulo: estado.valorDocumento || pagamento.valor,
        omieValorPago: estado.valorPago,
        omieValorPendente: estado.valorPendente,
        omieLiquidado: estado.liquidado,
        omieDataUltimaBaixa: dataIsoDeOmie(estado.dataUltimaBaixa)
          || pagamento.omieDataUltimaBaixa,
        omieStatusIntegracao: "Enviado",
        omieUltimoErro: "",
        omieUltimaSincronizacaoEm: new Date(),
        etapa: estado.liquidado ? "Pagamento Ok" : "Enviado para Omie",
      },
    },
    { skipOmieOutbox: true },
  );
  await recalcularIndicadoresItem(pagamento.projetoItemId);
  return estado;
}

async function enviarContaPagar(id, opcoes = {}) {
  const { client } = await contexto(opcoes);
  const Pagamento = model("Pagamento");
  const pagamento = await Pagamento.findById(id).lean();
  if (!pagamento) throw new GenericError("Pagamento não encontrado.", { statusCode: 404 });
  if (process.env.OMIE_EXIGIR_NF === "true" && !pagamento.nfRecebida) {
    throw new GenericError(
      "A NF deve estar recebida antes do envio ao Omie.",
      { statusCode: 409 },
    );
  }
  if (!["Aprovado", "Enviado para Omie", "Pagamento Ok"].includes(pagamento.etapa)) {
    throw new GenericError("Aprove o pagamento antes de enviá-lo ao Omie.", { statusCode: 409 });
  }

  const { item, fornecedor } = await fornecedorDoPagamento(pagamento, opcoes);
  const { categoria, contaCorrente } = await resolverMapeamentoFinanceiro(item, pagamento);
  const payload = mapearContaPagar({
    pagamento: {
      ...pagamento,
      codigoLancamentoIntegracao: pagamento.codigoLancamentoIntegracao
        || codigoPagamentoIntegracao(pagamento._id),
    },
    codigoFornecedorOmie: fornecedor.codigoClienteOmie,
    codigoCategoriaOmie: categoria.codigo,
    contaCorrenteId: contaCorrente.codigo,
  });

  await Pagamento.updateOne(
    { _id: id },
    {
      $set: {
        codigoLancamentoIntegracao: payload.codigo_lancamento_integracao,
        omieStatusIntegracao: "Processando",
        omieUltimoErro: "",
      },
    },
  );

  try {
    const resposta = await client.chamar("contasPagar", "UpsertContaPagar", [payload]);
    const titulo = { ...resposta, ...payload };
    await Pagamento.updateOne(
      { _id: id },
      {
        $set: {
          omieCodigoCategoriaEnviado: categoria.codigo,
          omieContaCorrenteEnviada: Number(contaCorrente.codigo),
          omieCodigoClienteFornecedorEnviado: fornecedor.codigoClienteOmie,
          omieNumeroDocumentoEnviado: payload.numero_documento,
          omiePayloadHash: hashPayload(payload),
        },
      },
    );
    return aplicarEstadoPagamento(pagamento, titulo);
  } catch (erro) {
    if (erro instanceof OmieApiError && erro.retryable) {
      try {
        return await consultarContaPagar(id, opcoes);
      } catch {
        // O erro original permanece como evidência principal.
      }
    }
    await Pagamento.updateOne(
      { _id: id },
      { $set: { omieStatusIntegracao: "Erro", omieUltimoErro: sanitizarErro(erro) } },
    );
    throw erro;
  }
}

async function consultarContaPagar(id, opcoes = {}) {
  const { client } = await contexto(opcoes);
  const pagamento = await model("Pagamento").findById(id).lean();
  if (!pagamento?.codigoLancamentoIntegracao && !pagamento?.codigoLancamentoOmie) {
    throw new GenericError("Pagamento ainda não possui título no Omie.", { statusCode: 409 });
  }
  const chave = pagamento.codigoLancamentoOmie
    ? { codigo_lancamento_omie: pagamento.codigoLancamentoOmie }
    : { codigo_lancamento_integracao: pagamento.codigoLancamentoIntegracao };
  const titulo = await client.chamar("contasPagar", "ConsultarContaPagar", [chave]);
  return aplicarEstadoPagamento(pagamento, titulo);
}

async function recalcularIndicadoresItem(itemId) {
  const Item = model("ProjetoItem");
  const Pagamento = model("Pagamento");
  const item = await Item.findById(itemId).lean();
  if (!item) return null;

  const pagamentos = await Pagamento.find({
    projetoItemId: itemId,
    canceladoNaCentral: { $ne: true },
  }).lean();
  const planejado = arredondarMoeda(
    pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0),
  );
  const pago = arredondarMoeda(
    pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.omieValorPago || 0), 0),
  );
  const pendente = arredondarMoeda(
    Math.max(0, Number(item.contratacaoTotal || 0) - pago),
  );

  let status = "Pagamento pendente";
  if (!pagamentos.length) status = "Sem pagamento";
  else if (pagamentos.some((pagamento) => pagamento.omieStatusIntegracao === "Erro")) {
    status = "Erro de integração";
  } else if (planejado > Number(item.contratacaoTotal || 0) + 0.01) {
    status = "Divergência";
  } else if (
    Number(item.contratacaoTotal || 0) > 0
    && pago >= Number(item.contratacaoTotal || 0) - 0.01
  ) {
    status = "Pago";
  } else if (pago > 0) status = "Parcialmente pago";
  else if (
    pagamentos.some((pagamento) => ["Enviado", "Processando"].includes(
      pagamento.omieStatusIntegracao,
    ))
  ) {
    status = "Enviado ao Omie";
  }

  await Item.findByIdAndUpdate(
    itemId,
    {
      $set: {
        pagamentoTotalPlanejado: planejado,
        pagamentoTotalPago: pago,
        pagamentoValorPendente: pendente,
        pagamentoStatus: status,
      },
    },
  );
  return { planejado, pago, pendente, status };
}

async function reconciliarFinanceiro(opcoes = {}) {
  const { config } = await contexto(opcoes);
  const limite = Math.min(500, Number(opcoes.limite || 100));
  const pagamentos = await model("Pagamento")
    .find({
      codigoLancamentoIntegracao: { $exists: true, $ne: "" },
      omieStatusIntegracao: { $in: ["Enviado", "Processando", "Erro"] },
      canceladoNaCentral: { $ne: true },
    })
    .sort({ omieUltimaSincronizacaoEm: 1 })
    .limit(limite)
    .lean();

  const erros = [];
  let processados = 0;
  for (const pagamento of pagamentos) {
    try {
      await consultarContaPagar(pagamento._id, opcoes);
      processados += 1;
    } catch (erro) {
      erros.push({ pagamentoId: String(pagamento._id), erro: sanitizarErro(erro) });
      await model("Pagamento").updateOne(
        { _id: pagamento._id },
        { $set: { omieStatusIntegracao: "Erro", omieUltimoErro: sanitizarErro(erro) } },
      );
    }
  }

  await model("OmieConfiguracao").updateOne(
    { _id: config._id },
    { $set: { ultimaReconciliacaoFinanceiraEm: new Date() } },
  );
  await atualizarDashboardIntegracoes();
  return { encontrados: pagamentos.length, processados, erros };
}

function encontrarRecursivamente(objeto, chaves, nivel = 0) {
  if (!objeto || typeof objeto !== "object" || nivel > 5) return undefined;
  for (const chave of chaves) {
    if (objeto[chave] !== undefined) return objeto[chave];
  }
  for (const valor of Object.values(objeto)) {
    const resultado = encontrarRecursivamente(valor, chaves, nivel + 1);
    if (resultado !== undefined) return resultado;
  }
  return undefined;
}

async function processarWebhooksPendentes(opcoes = {}) {
  const Inbox = model("WebhookInbox");
  const Pagamento = model("Pagamento");
  const filtro = opcoes.webhookInboxId
    ? { _id: opcoes.webhookInboxId, status: { $in: ["Pendente", "Erro"] } }
    : { status: { $in: ["Pendente", "Erro"] } };
  const itens = await Inbox.find(filtro)
    .sort({ receivedAt: 1 })
    .limit(Math.min(100, Number(opcoes.limite || 20)))
    .lean();

  let processados = 0;
  for (const item of itens) {
    await Inbox.updateOne(
      { _id: item._id },
      { $set: { status: "Processando" }, $inc: { attempts: 1 } },
    );
    try {
      const codigoIntegracao = encontrarRecursivamente(
        item.payload,
        ["codigo_lancamento_integracao"],
      );
      const codigoOmie = encontrarRecursivamente(
        item.payload,
        ["codigo_lancamento_omie", "codigo_lancamento"],
      );
      const pagamento = await Pagamento.findOne(
        codigoIntegracao
          ? { codigoLancamentoIntegracao: codigoIntegracao }
          : { codigoLancamentoOmie: Number(codigoOmie || 0) },
      ).lean();
      if (pagamento) await consultarContaPagar(pagamento._id, opcoes);
      await Inbox.updateOne(
        { _id: item._id },
        { $set: { status: "Concluído", processedAt: new Date(), lastError: "" } },
      );
      processados += 1;
    } catch (erro) {
      await Inbox.updateOne(
        { _id: item._id },
        { $set: { status: "Erro", lastError: sanitizarErro(erro) } },
      );
    }
  }

  await atualizarDashboardIntegracoes();
  return { encontrados: itens.length, processados };
}

module.exports = {
  atualizarDashboardIntegracoes,
  consultarContaPagar,
  enviarContaPagar,
  processarWebhooksPendentes,
  recalcularIndicadoresItem,
  reconciliarFinanceiro,
  resolverMapeamentoFinanceiro,
  sincronizarCliente,
};
