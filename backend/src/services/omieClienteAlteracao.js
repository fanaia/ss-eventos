"use strict";

const { registry, GenericError } = require("@oondemand/oon-core-back");
const { criarOmieClient } = require("./omieClient");
const { mapearClienteParaOmie } = require("./omieMappers");
const { hashPayload, sanitizarErro } = require("./omieUtils");
const { obterCredenciaisConfiguracao } = require("../models/OmieConfiguracao");

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

async function criarContexto(opcoes = {}) {
  exigirIntegracaoAtiva();
  const { appKey, appSecret } = await obterCredenciaisConfiguracao();
  return {
    client: opcoes.client || criarOmieClient({ appKey, appSecret }),
  };
}

async function alterarClienteNoOmie(id, opcoes = {}) {
  const { client } = await criarContexto(opcoes);
  const Cliente = model("ClienteFornecedor");
  const cliente = await Cliente.findById(id).lean();

  if (!cliente) {
    throw new GenericError("Cliente/Fornecedor não encontrado.", { statusCode: 404 });
  }
  if (!cliente.codigoClienteOmie) {
    throw new GenericError(
      "O Cliente/Prestador precisa ter sido sincronizado do Omie antes de ser alterado.",
      { statusCode: 409 },
    );
  }

  const contato = await model("Contato")
    .findOne({ clienteFornecedorId: cliente._id, status: "Ativo" })
    .sort({ createdAt: 1 })
    .lean();
  const payload = {
    ...mapearClienteParaOmie(cliente, contato),
    codigo_cliente_omie: Number(cliente.codigoClienteOmie),
  };

  try {
    const resposta = await client.chamar("clientes", "AlterarCliente", [payload]);
    const codigo = Number(
      resposta.codigo_cliente_omie
      || resposta.codigo_cliente
      || cliente.codigoClienteOmie,
    );
    const sincronizadoEm = new Date();

    await Cliente.updateOne(
      { _id: cliente._id },
      {
        $set: {
          codigoClienteOmie: codigo,
          codigoClienteIntegracao: payload.codigo_cliente_integracao,
          omieSincronizadoEm: sincronizadoEm,
          omieStatusIntegracao: "Sincronizado",
          omieUltimoErro: "",
          omiePayloadHash: hashPayload(payload),
          omieVersaoLocalSincronizada: Number(cliente.omieVersaoLocal || 1),
        },
      },
    );

    return {
      operacao: "AlterarCliente",
      codigoClienteOmie: codigo,
      codigoClienteIntegracao: payload.codigo_cliente_integracao,
      sincronizadoEm,
    };
  } catch (erro) {
    await Cliente.updateOne(
      { _id: cliente._id },
      {
        $set: {
          omieStatusIntegracao: "Erro",
          omieUltimoErro: sanitizarErro(erro),
        },
      },
    );
    throw erro;
  }
}

module.exports = { alterarClienteNoOmie };
