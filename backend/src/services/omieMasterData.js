"use strict";

const { registry, GenericError } = require("@oondemand/oon-core-back");
const { criarOmieClient } = require("./omieClient");
const {
  mapearClienteDoOmie,
  mapearCategoriaOmie,
  mapearContaCorrenteOmie,
} = require("./omieMappers");
const {
  somenteDigitos,
  hashPayload,
  sanitizarErro,
} = require("./omieUtils");
const { obterCredenciaisConfiguracao } = require("../models/OmieConfiguracao");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

function exigirIntegracaoAtiva() {
  if (process.env.OMIE_ENABLED !== "true") {
    throw new GenericError("A integração Omie está desativada.", { statusCode: 503 });
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

function resumoInicial() {
  return {
    totalRecebidos: 0,
    totalInformadoPeloProvedor: 0,
    paginas: 0,
    processados: 0,
    sucessos: 0,
    criados: 0,
    atualizados: 0,
    semAlteracao: 0,
    ignorados: 0,
    erros: [],
    itens: [],
    requisicoes: [],
  };
}

function codigoRegistro(registro = {}) {
  return registro.codigo_cliente_omie
    || registro.codigo_cliente
    || registro.codigo
    || registro.nCodCC
    || registro.codigo_conta_corrente
    || "sem-código";
}

function descricaoRegistro(registro = {}) {
  return registro.nome_fantasia
    || registro.razao_social
    || registro.descricao
    || registro.nome
    || "Sem descrição";
}

function registrarItem(resumo, codigo, descricao, resultado, detalhes = {}) {
  resumo.itens.push({
    codigo: String(codigo || "—"),
    descricao: String(descricao || "Sem descrição"),
    resultado,
    ...detalhes,
  });
}

function registrarErro(resumo, registro, erro, etapa) {
  const detalhe = {
    indice: resumo.processados + 1,
    codigo: String(codigoRegistro(registro)),
    descricao: String(descricaoRegistro(registro)),
    etapa,
    erro: sanitizarErro(erro),
    tipoErro: String(erro?.name || "Error"),
    codigoErro: String(erro?.code || ""),
  };
  resumo.erros.push(detalhe);
  registrarItem(
    resumo,
    detalhe.codigo,
    detalhe.descricao,
    "Erro",
    { erro: detalhe.erro, etapa },
  );
}

function concluirResumo(resumo, client) {
  resumo.requisicoes = typeof client?.getTraces === "function" ? client.getTraces() : [];
  const chamadasComSucesso = resumo.requisicoes.filter((trace) => trace.status === "Sucesso");
  resumo.paginas = chamadasComSucesso.length;
  const ultimaResposta = chamadasComSucesso.length
    ? chamadasComSucesso[chamadasComSucesso.length - 1].response || {}
    : {};
  resumo.totalInformadoPeloProvedor = Number(
    ultimaResposta.total_de_registros
      || ultimaResposta.totalDeRegistros
      || resumo.totalRecebidos,
  );
  resumo.message = resumo.erros.length
    ? `${resumo.sucessos} cadastro(s) processado(s), ${resumo.ignorados} ignorado(s) e ${resumo.erros.length} com erro.`
    : `${resumo.sucessos} cadastro(s) processado(s) e ${resumo.ignorados} ignorado(s), sem erro.`;
  return resumo;
}

async function salvarClienteImportado(registro, resumo) {
  const Cliente = model("ClienteFornecedor");
  const dados = mapearClienteDoOmie(registro);
  const documentoNormalizado = somenteDigitos(dados.documento);
  const filtros = [
    dados.codigoClienteOmie ? { codigoClienteOmie: dados.codigoClienteOmie } : null,
    dados.codigoClienteIntegracao
      ? { codigoClienteIntegracao: dados.codigoClienteIntegracao }
      : null,
    dados.documento ? { documento: dados.documento } : null,
    documentoNormalizado && documentoNormalizado !== dados.documento
      ? { documento: documentoNormalizado }
      : null,
  ].filter(Boolean);

  if (!filtros.length) {
    resumo.ignorados += 1;
    registrarItem(resumo, "sem-código", dados.nome, "Ignorado", {
      motivo: "Cadastro sem código Omie, código de integração ou documento.",
    });
    return false;
  }

  const atual = await Cliente.findOne({ $or: filtros }).lean();
  const agora = new Date();
  const payloadHash = hashPayload(registro);

  if (!atual) {
    const criado = await Cliente.create(
      {
        ...dados,
        origem: "Omie",
        omieSincronizadoEm: agora,
        omieStatusIntegracao: "Sincronizado",
        omieVersaoLocal: 1,
        omieVersaoLocalSincronizada: 1,
        omiePayloadHash: payloadHash,
        omieUltimoErro: "",
      },
      { skipOmieOutbox: true },
    );
    resumo.criados += 1;
    registrarItem(resumo, criado.codigoClienteOmie, criado.nome, "Criado");
    return true;
  }

  if (
    atual.omiePayloadHash === payloadHash
    && atual.omieStatusIntegracao === "Sincronizado"
  ) {
    resumo.semAlteracao += 1;
    registrarItem(resumo, atual.codigoClienteOmie, atual.nome, "Sem alteração");
    return true;
  }

  const conflito = Number(atual.omieVersaoLocal || 1)
    > Number(atual.omieVersaoLocalSincronizada || 0)
    && atual.omieStatusIntegracao === "Pendente";

  await Cliente.findByIdAndUpdate(
    atual._id,
    {
      $set: conflito
        ? {
          codigoClienteOmie: dados.codigoClienteOmie,
          origem: "Omie",
          omieAtualizadoEm: agora,
          omieStatusIntegracao: "Conflito",
          omieUltimoErro: "Cadastro alterado na Central e no Omie; revisão manual necessária.",
        }
        : {
          ...dados,
          origem: "Omie",
          omieSincronizadoEm: agora,
          omieStatusIntegracao: "Sincronizado",
          omieUltimoErro: "",
          omiePayloadHash: payloadHash,
          omieVersaoLocalSincronizada: Number(atual.omieVersaoLocal || 1),
        },
    },
    { skipOmieOutbox: true, new: true },
  );

  resumo.atualizados += 1;
  registrarItem(
    resumo,
    dados.codigoClienteOmie,
    dados.nome,
    conflito ? "Conflito" : "Atualizado",
  );
  return true;
}

async function importarClientes(opcoes = {}) {
  const { client, config } = await contexto(opcoes);
  const registros = await client.paginar(
    "clientes",
    "ListarClientes",
    { apenas_importado_api: "N" },
    (resposta) => resposta.clientes_cadastro
      || resposta.clientes_cadastro_resumido
      || [],
  );

  const resumo = resumoInicial();
  resumo.totalRecebidos = registros.length;
  for (const registro of registros) {
    try {
      const persistido = await salvarClienteImportado(registro, resumo);
      if (persistido) resumo.sucessos += 1;
    } catch (erro) {
      registrarErro(resumo, registro, erro, "persistir-cliente-prestador");
    } finally {
      resumo.processados += 1;
    }
  }

  const agora = new Date();
  await model("OmieConfiguracao").updateOne(
    { _id: config._id },
    {
      $set: {
        ultimaSincronizacaoCadastrosEm: agora,
        ultimaSincronizacaoClientesEm: agora,
      },
    },
  );
  return concluirResumo(resumo, client);
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

  const resumo = resumoInicial();
  resumo.totalRecebidos = registros.length;
  for (const registro of registros) {
    try {
      const dados = mapearCategoriaOmie(registro, agora);
      if (!dados.codigo || !dados.descricao) {
        resumo.ignorados += 1;
        registrarItem(resumo, dados.codigo, dados.descricao, "Ignorado", {
          motivo: "Categoria sem código ou descrição.",
        });
      } else {
        const payloadHash = hashPayload(registro);
        const atual = await OmieCategoria.findOne({ codigo: dados.codigo }).lean();
        if (!atual) resumo.criados += 1;
        else if (atual.payloadHash === payloadHash) resumo.semAlteracao += 1;
        else resumo.atualizados += 1;

        await OmieCategoria.findOneAndUpdate(
          { codigo: dados.codigo },
          {
            $set: {
              ...dados,
              payloadHash,
              status: dados.contaInativa ? "Inativo" : "Ativo",
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        registrarItem(
          resumo,
          dados.codigo,
          dados.descricao,
          atual
            ? (atual.payloadHash === payloadHash ? "Sem alteração" : "Atualizado")
            : "Criado",
        );
        resumo.sucessos += 1;
      }
    } catch (erro) {
      registrarErro(resumo, registro, erro, "persistir-categoria");
    } finally {
      resumo.processados += 1;
    }
  }

  await OmieCategoria.updateMany(
    { vistoEm: { $lt: agora }, status: "Ativo" },
    { $set: { status: "Inativo", contaInativa: true } },
  );
  await model("OmieConfiguracao").updateOne(
    { _id: config._id },
    {
      $set: {
        ultimaSincronizacaoCadastrosEm: agora,
        ultimaSincronizacaoCategoriasEm: agora,
      },
    },
  );
  return concluirResumo(resumo, client);
}

async function importarContasCorrentes(opcoes = {}) {
  const { client, config } = await contexto(opcoes);
  const Conta = model("OmieContaCorrente");
  const agora = new Date();
  const registros = await client.paginar(
    "contasCorrentes",
    "ListarContasCorrentes",
    { apenas_importado_api: "N" },
    (resposta) => resposta.ListarContasCorrentes
      || resposta.conta_corrente_lista
      || resposta.fin_conta_corrente_cadastro
      || resposta.contas_correntes
      || [],
  );

  const resumo = resumoInicial();
  resumo.totalRecebidos = registros.length;
  for (const registro of registros) {
    try {
      const dados = mapearContaCorrenteOmie(registro, agora);
      if (!dados.codigo) {
        resumo.ignorados += 1;
        registrarItem(resumo, "sem-código", dados.descricao, "Ignorado", {
          motivo: "Conta corrente sem código Omie.",
        });
      } else {
        const payloadHash = hashPayload(registro);
        const atual = await Conta.findOne({ codigo: dados.codigo }).lean();
        if (!atual) resumo.criados += 1;
        else if (atual.payloadHash === payloadHash) resumo.semAlteracao += 1;
        else resumo.atualizados += 1;

        await Conta.findOneAndUpdate(
          { codigo: dados.codigo },
          { $set: { ...dados, payloadHash } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        registrarItem(
          resumo,
          dados.codigo,
          dados.descricao,
          atual
            ? (atual.payloadHash === payloadHash ? "Sem alteração" : "Atualizado")
            : "Criado",
        );
        resumo.sucessos += 1;
      }
    } catch (erro) {
      registrarErro(resumo, registro, erro, "persistir-conta-corrente");
    } finally {
      resumo.processados += 1;
    }
  }

  await Conta.updateMany(
    { vistoEm: { $lt: agora }, status: "Ativo" },
    { $set: { status: "Inativo", inativa: true } },
  );
  await model("OmieConfiguracao").updateOne(
    { _id: config._id },
    {
      $set: {
        ultimaSincronizacaoCadastrosEm: agora,
        ultimaSincronizacaoContasCorrentesEm: agora,
      },
    },
  );
  return concluirResumo(resumo, client);
}

module.exports = {
  importarCategorias,
  importarClientes,
  importarContasCorrentes,
};
