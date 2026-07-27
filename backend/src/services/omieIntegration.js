"use strict";

const os = require("node:os");
const { registry, GenericError } = require("@oondemand/oon-core-back");
const { criarOmieClient, OmieApiError } = require("./omieClient");
const {
  mapearClienteParaOmie,
  mapearClienteDoOmie,
  mapearCategoriaOmie,
  mapearFormaPagamentoOmie,
  mapearContaPagar,
  extrairEstadoContaPagar,
} = require("./omieMappers");
const {
  somenteDigitos,
  hashPayload,
  sanitizarErro,
  codigoClienteIntegracao,
  codigoPagamentoIntegracao,
  arredondarMoeda,
  dataIsoDeOmie,
} = require("./omieUtils");
const {
  obterOuCriarConfiguracaoAtiva,
  obterCredenciaisConfiguracao,
} = require("../models/OmieConfiguracao");
const { assegurarFormaPadrao } = require("../models/FormaPagamento");
const { atrasoTentativa, enfileirarIntegracao } = require("../models/IntegrationOutbox");

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
    model("WebhookInbox").countDocuments({ status: { $in: ["Pendente", "Processando", "Erro"] } }),
    model("ClienteFornecedor").aggregate([
      { $group: { _id: "$omieStatusIntegracao", total: { $sum: 1 } } },
    ]),
    model("Pagamento").aggregate([
      { $group: { _id: "$omieStatusIntegracao", total: { $sum: 1 } } },
    ]),
  ]);

  const contar = (linhas, status) => Number(linhas.find((item) => item._id === status)?.total || 0);
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
  if (!cliente) throw new GenericError("Cliente/Fornecedor não encontrado.", { statusCode: 404 });

  const contato = await model("Contato")
    .findOne({ clienteFornecedorId: cliente._id, status: "Ativo" })
    .sort({ createdAt: 1 })
    .lean();
  const payload = mapearClienteParaOmie(cliente, contato);

  try {
    const resposta = await client.chamar("clientes", "UpsertCliente", [payload]);
    const codigo = Number(
      resposta.codigo_cliente_omie || resposta.codigo_cliente || cliente.codigoClienteOmie || 0,
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
    return { codigoClienteOmie: codigo, codigoClienteIntegracao: payload.codigo_cliente_integracao };
  } catch (erro) {
    await Cliente.updateOne(
      { _id: cliente._id },
      { $set: { omieStatusIntegracao: "Erro", omieUltimoErro: sanitizarErro(erro) } },
    );
    throw erro;
  }
}

async function salvarClienteImportado(registro) {
  const Cliente = model("ClienteFornecedor");
  const dados = mapearClienteDoOmie(registro);
  const documentoNormalizado = somenteDigitos(dados.documento);
  const filtros = [
    dados.codigoClienteOmie ? { codigoClienteOmie: dados.codigoClienteOmie } : null,
    dados.codigoClienteIntegracao ? { codigoClienteIntegracao: dados.codigoClienteIntegracao } : null,
    dados.documento ? { documento: dados.documento } : null,
    documentoNormalizado && documentoNormalizado !== dados.documento
      ? { documento: documentoNormalizado }
      : null,
  ].filter(Boolean);
  const atual = filtros.length ? await Cliente.findOne({ $or: filtros }).lean() : null;
  const agora = new Date();

  if (!atual) {
    const novo = new Cliente({
      ...dados,
      omieSincronizadoEm: agora,
      omieStatusIntegracao: "Sincronizado",
      omieVersaoLocal: 1,
      omieVersaoLocalSincronizada: 1,
      omiePayloadHash: hashPayload(registro),
    });
    if (!novo.codigoClienteIntegracao) novo.codigoClienteIntegracao = codigoClienteIntegracao(novo._id);
    await novo.save();
    return novo;
  }

  const conflito = Number(atual.omieVersaoLocal || 1) > Number(atual.omieVersaoLocalSincronizada || 0)
    && atual.omieStatusIntegracao === "Pendente";
  return Cliente.findOneAndUpdate(
    { _id: atual._id },
    {
      $set: conflito
        ? {
          codigoClienteOmie: dados.codigoClienteOmie,
          omieAtualizadoEm: agora,
          omieStatusIntegracao: "Conflito",
          omieUltimoErro: "Cadastro alterado na Central e no Omie; revisão manual necessária.",
        }
        : {
          ...dados,
          omieSincronizadoEm: agora,
          omieStatusIntegracao: "Sincronizado",
          omieUltimoErro: "",
          omiePayloadHash: hashPayload(registro),
          omieVersaoLocalSincronizada: Number(atual.omieVersaoLocal || 1),
        },
    },
    { new: true },
  );
}

async function importarClientes(opcoes = {}) {
  const { client, config } = await contexto(opcoes);
  const registros = await client.paginar(
    "clientes",
    "ListarClientes",
    { apenas_importado_api: "N" },
    (resposta) => resposta.clientes_cadastro || resposta.clientes_cadastro_resumido || [],
  );
  for (const registro of registros) await salvarClienteImportado(registro);
  const agora = new Date();
  await model("OmieConfiguracao").updateOne(
    { _id: config._id },
    { $set: { ultimaSincronizacaoCadastrosEm: agora, ultimaSincronizacaoClientesEm: agora } },
  );
  await atualizarDashboardIntegracoes();
  return { processados: registros.length };
}

async function importarCategorias(opcoes = {}) {
  const { client, config } = await contexto(opcoes);
  const OmieCategoria = model("OmieCategoria");
  const agora = new Date();
  const registros = await client.paginar(
    "categorias",
    "ListarCategorias",
    {},
    (resposta) => resposta.categoria_cadastro || resposta.categorias || [],
  );
  for (const registro of registros) {
    const dados = mapearCategoriaOmie(registro, agora);
    await OmieCategoria.findOneAndUpdate(
      { codigo: dados.codigo },
      { $set: { ...dados, payloadHash: hashPayload(registro), status: dados.contaInativa ? "Inativo" : "Ativo" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  await OmieCategoria.updateMany(
    { vistoEm: { $lt: agora }, status: "Ativo" },
    { $set: { status: "Inativo", contaInativa: true } },
  );
  await model("OmieConfiguracao").updateOne(
    { _id: config._id },
    { $set: { ultimaSincronizacaoCadastrosEm: agora, ultimaSincronizacaoCategoriasEm: agora } },
  );
  return { processados: registros.length };
}

async function importarFormasPagamento(opcoes = {}) {
  const { client, config } = await contexto(opcoes);
  const FormaPagamento = model("FormaPagamento");
  const agora = new Date();
  const registros = await client.paginar(
    "formasPagamentoCompras",
    "ListarFormasPagCompras",
    {},
    (resposta) => resposta.cadastros || [],
  );
  for (const registro of registros) {
    const dados = mapearFormaPagamentoOmie(registro, agora);
    await FormaPagamento.findOneAndUpdate(
      { codigoOmie: dados.codigoOmie },
      { $set: dados, $setOnInsert: { padrao: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  await FormaPagamento.updateMany(
    { origem: "Omie", vistoEm: { $lt: agora }, status: "Ativo" },
    { $set: { status: "Inativo", padrao: false } },
  );
  await assegurarFormaPadrao();
  await model("OmieConfiguracao").updateOne(
    { _id: config._id },
    { $set: { ultimaSincronizacaoCadastrosEm: agora, ultimaSincronizacaoFormasPagamentoEm: agora } },
  );
  return { processados: registros.length };
}

async function resolverCategoria(item) {
  const Categoria = model("Categoria");
  const OmieCategoria = model("OmieCategoria");
  const ids = [item.subcategoriaId, item.categoriaId].filter(Boolean);
  const categorias = await Categoria.find({ _id: { $in: ids } }).lean();
  const porId = new Map(categorias.map((categoria) => [String(categoria._id), categoria]));
  const escolhida = [
    porId.get(String(item.subcategoriaId || "")),
    porId.get(String(item.categoriaId || "")),
  ].find((categoria) => categoria?.omieCategoriaId);
  if (!escolhida) {
    throw new GenericError(
      "Relacione a categoria/subcategoria do item com uma categoria financeira do Omie.",
      { statusCode: 409 },
    );
  }
  const omie = await OmieCategoria.findById(escolhida.omieCategoriaId).lean();
  if (!omie || omie.status !== "Ativo" || omie.contaInativa || omie.totalizadora || omie.transferencia || omie.naoExibir) {
    throw new GenericError("A categoria financeira do Omie está inativa ou não pode receber lançamentos.", { statusCode: 409 });
  }
  return omie;
}

async function fornecedorDoPagamento(pagamento, opcoes) {
  const item = await model("ProjetoItem").findById(pagamento.projetoItemId).lean();
  const projeto = item ? await model("Projeto").findById(item.projetoId).lean() : null;
  if (!item || !projeto) throw new GenericError("Item ou projeto do pagamento não encontrado.", { statusCode: 409 });
  let fornecedor = await model("ClienteFornecedor").findById(projeto.fornecedorId).lean();
  if (!fornecedor?.fornecedor) throw new GenericError("Fornecedor do projeto inválido.", { statusCode: 409 });
  if (!fornecedor.codigoClienteOmie || fornecedor.omieStatusIntegracao !== "Sincronizado") {
    await sincronizarCliente(fornecedor._id, opcoes);
    fornecedor = await model("ClienteFornecedor").findById(fornecedor._id).lean();
  }
  return { item, fornecedor };
}

async function aplicarEstadoPagamento(pagamento, titulo) {
  const estado = extrairEstadoContaPagar(titulo);
  const Pagamento = model("Pagamento");
  await Pagamento.findByIdAndUpdate(
    pagamento._id,
    {
      $set: {
        codigoLancamentoOmie: estado.codigoLancamentoOmie || pagamento.codigoLancamentoOmie,
        omieValorTitulo: estado.valorDocumento || pagamento.valor,
        omieValorPago: estado.valorPago,
        omieValorPendente: estado.valorPendente,
        omieLiquidado: estado.liquidado,
        omieDataUltimaBaixa: dataIsoDeOmie(estado.dataUltimaBaixa) || pagamento.omieDataUltimaBaixa,
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
  const { client, config } = await contexto(opcoes);
  const Pagamento = model("Pagamento");
  const pagamento = await Pagamento.findById(id).lean();
  if (!pagamento) throw new GenericError("Pagamento não encontrado.", { statusCode: 404 });
  if (process.env.OMIE_EXIGIR_NF === "true" && !pagamento.nfRecebida) {
    throw new GenericError("A NF deve estar recebida antes do envio ao Omie.", { statusCode: 409 });
  }
  if (!["Aprovado", "Enviado para Omie", "Pagamento Ok"].includes(pagamento.etapa)) {
    throw new GenericError("Aprove o pagamento antes de enviá-lo ao Omie.", { statusCode: 409 });
  }

  const { item, fornecedor } = await fornecedorDoPagamento(pagamento, opcoes);
  const categoria = await resolverCategoria(item);
  const payload = mapearContaPagar({
    pagamento: {
      ...pagamento,
      codigoLancamentoIntegracao: pagamento.codigoLancamentoIntegracao || codigoPagamentoIntegracao(pagamento._id),
    },
    codigoFornecedorOmie: fornecedor.codigoClienteOmie,
    codigoCategoriaOmie: categoria.codigo,
    contaCorrenteId: config.contaCorrenteId,
  });
  await Pagamento.updateOne(
    { _id: id },
    { $set: { codigoLancamentoIntegracao: payload.codigo_lancamento_integracao, omieStatusIntegracao: "Processando", omieUltimoErro: "" } },
  );

  try {
    const resposta = await client.chamar("contasPagar", "UpsertContaPagar", [payload]);
    const titulo = { ...resposta, ...payload };
    await Pagamento.updateOne(
      { _id: id },
      {
        $set: {
          omieCodigoCategoriaEnviado: categoria.codigo,
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
  const pagamentos = await Pagamento.find({ projetoItemId: itemId, canceladoNaCentral: { $ne: true } }).lean();
  const planejado = arredondarMoeda(pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0));
  const pago = arredondarMoeda(pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.omieValorPago || 0), 0));
  const pendente = arredondarMoeda(Math.max(0, Number(item.contratacaoTotal || 0) - pago));
  let status = "Pagamento pendente";
  if (!pagamentos.length) status = "Sem pagamento";
  else if (pagamentos.some((pagamento) => pagamento.omieStatusIntegracao === "Erro")) status = "Erro de integração";
  else if (planejado > Number(item.contratacaoTotal || 0) + 0.01) status = "Divergência";
  else if (Number(item.contratacaoTotal || 0) > 0 && pago >= Number(item.contratacaoTotal || 0) - 0.01) status = "Pago";
  else if (pago > 0) status = "Parcialmente pago";
  else if (pagamentos.some((pagamento) => ["Enviado", "Processando"].includes(pagamento.omieStatusIntegracao))) status = "Enviado ao Omie";
  await Item.findByIdAndUpdate(
    itemId,
    { $set: { pagamentoTotalPlanejado: planejado, pagamentoTotalPago: pago, pagamentoValorPendente: pendente, pagamentoStatus: status } },
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

function recursivo(objeto, chaves, nivel = 0) {
  if (!objeto || typeof objeto !== "object" || nivel > 5) return undefined;
  for (const chave of chaves) if (objeto[chave] !== undefined) return objeto[chave];
  for (const valor of Object.values(objeto)) {
    const resultado = recursivo(valor, chaves, nivel + 1);
    if (resultado !== undefined) return resultado;
  }
  return undefined;
}

async function processarWebhooksPendentes(opcoes = {}) {
  const Inbox = model("WebhookInbox");
  const Pagamento = model("Pagamento");
  const itens = await Inbox.find({ status: { $in: ["Pendente", "Erro"] } })
    .sort({ receivedAt: 1 })
    .limit(Math.min(100, Number(opcoes.limite || 20)))
    .lean();
  let processados = 0;
  for (const item of itens) {
    await Inbox.updateOne({ _id: item._id }, { $set: { status: "Processando" }, $inc: { attempts: 1 } });
    try {
      const codigoIntegracao = recursivo(item.payload, ["codigo_lancamento_integracao"]);
      const codigoOmie = recursivo(item.payload, ["codigo_lancamento_omie", "codigo_lancamento"]);
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

async function executar(evento, opcoes) {
  switch (evento.tipo) {
    case "OMIE_CLIENTE_UPSERT": return sincronizarCliente(evento.aggregateId || evento.payload?.clienteFornecedorId, opcoes);
    case "OMIE_CLIENTES_IMPORTAR": return importarClientes(opcoes);
    case "OMIE_FORMAS_IMPORTAR": return importarFormasPagamento(opcoes);
    case "OMIE_CATEGORIAS_IMPORTAR": return importarCategorias(opcoes);
    case "OMIE_CONTA_PAGAR_UPSERT": return enviarContaPagar(evento.aggregateId || evento.payload?.pagamentoId, opcoes);
    case "OMIE_FINANCEIRO_RECONCILIAR": return reconciliarFinanceiro(opcoes);
    case "OMIE_WEBHOOK_PROCESSAR": return processarWebhooksPendentes(opcoes);
    default: throw new GenericError(`Tipo de integração não suportado: ${evento.tipo}`);
  }
}

async function processarFila(opcoes = {}) {
  exigirIntegracaoAtiva();
  const Outbox = model("IntegrationOutbox");
  const worker = `${os.hostname()}:${process.pid}`;
  const limite = Math.min(100, Number(opcoes.limite || 20));
  const erros = [];
  let processados = 0;
  for (let indice = 0; indice < limite; indice += 1) {
    const agora = new Date();
    const evento = await Outbox.findOneAndUpdate(
      {
        status: { $in: ["Pendente", "Erro temporário"] },
        $and: [
          { $or: [{ proximaTentativaEm: { $lte: agora } }, { proximaTentativaEm: null }, { proximaTentativaEm: { $exists: false } }] },
          { $or: [{ lockedAt: { $lt: new Date(Date.now() - 600000) } }, { lockedAt: null }, { lockedAt: { $exists: false } }] },
        ],
      },
      { $set: { status: "Processando", lockedAt: agora, lockedBy: worker }, $inc: { tentativas: 1 } },
      { sort: { createdAt: 1 }, new: true },
    ).lean();
    if (!evento) break;

    try {
      const resposta = await executar(evento, opcoes);
      await Outbox.updateOne(
        { _id: evento._id },
        { $set: { status: "Concluído", concluidoEm: new Date(), responseSummary: resposta || {}, ultimoErro: "", lockedAt: null, lockedBy: "" } },
      );
      processados += 1;
    } catch (erro) {
      const tentativas = Number(evento.tentativas || 1);
      const definitivo = tentativas >= 5 || (erro instanceof OmieApiError && !erro.retryable);
      const mensagem = sanitizarErro(erro);
      await Outbox.updateOne(
        { _id: evento._id },
        {
          $set: {
            status: definitivo ? "Erro definitivo" : "Erro temporário",
            ultimoErro: mensagem,
            proximaTentativaEm: definitivo ? null : new Date(Date.now() + atrasoTentativa(tentativas)),
            lockedAt: null,
            lockedBy: "",
          },
        },
      );
      erros.push({ id: String(evento._id), erro: mensagem });
    }
  }
  await atualizarDashboardIntegracoes();
  return { processados, erros };
}

async function enfileirarSincronizacaoCompleta() {
  const janela = new Date().toISOString().slice(0, 10);
  await Promise.all([
    ["OMIE_CLIENTES_IMPORTAR", "clientes"],
    ["OMIE_CATEGORIAS_IMPORTAR", "categorias"],
    ["OMIE_FORMAS_IMPORTAR", "formas"],
  ].map(([tipo, nome]) => enfileirarIntegracao({
    tipo,
    aggregateType: "Omie",
    idempotencyKey: `omie:sync:${nome}:${janela}`,
    payload: { janela },
  })));
  await atualizarDashboardIntegracoes();
  return { enfileirados: 3 };
}

module.exports = {
  sincronizarCliente,
  importarClientes,
  importarCategorias,
  importarFormasPagamento,
  enviarContaPagar,
  consultarContaPagar,
  recalcularIndicadoresItem,
  reconciliarFinanceiro,
  processarWebhooksPendentes,
  processarFila,
  enfileirarSincronizacaoCompleta,
  atualizarDashboardIntegracoes,
};
