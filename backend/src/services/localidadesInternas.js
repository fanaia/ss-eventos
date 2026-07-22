"use strict";

const localidades = require("../data/localidades-brasil.json");

const TAMANHO_LOTE = 500;

async function executarEmLotes(itens, executar, tamanho = TAMANHO_LOTE) {
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    await executar(itens.slice(inicio, inicio + tamanho));
  }
}

async function sincronizarEstados(Estado) {
  await Estado.updateMany({}, { $set: { status: "Inativo" } });

  await Estado.bulkWrite(
    localidades.estados.map((estado) => ({
      updateOne: {
        filter: { uf: estado.uf },
        update: {
          $set: {
            codigoIbge: estado.codigoIbge,
            uf: estado.uf,
            nome: estado.nome,
            status: "Ativo",
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  const estados = await Estado.find({ status: "Ativo" })
    .select("_id codigoIbge uf")
    .lean();

  return new Map(estados.map((estado) => [String(estado.codigoIbge), estado._id]));
}

async function sincronizarCidades(Cidade, estadosPorCodigo) {
  await Cidade.updateMany({}, { $set: { status: "Inativo" } });

  const operacoes = localidades.cidades.map((cidade) => {
    const estadoId = estadosPorCodigo.get(String(cidade.codigoUf));
    if (!estadoId) {
      throw new Error(`UF ${cidade.codigoUf} não encontrada para a cidade ${cidade.nome}.`);
    }

    return {
      updateOne: {
        filter: {
          $or: [
            { codigoIbge: cidade.codigoIbge },
            { nome: cidade.nome, estadoId },
          ],
        },
        update: {
          $set: {
            estadoId,
            nome: cidade.nome,
            codigoIbge: cidade.codigoIbge,
            status: "Ativo",
          },
        },
        upsert: true,
      },
    };
  });

  await executarEmLotes(
    operacoes,
    (lote) => Cidade.bulkWrite(lote, { ordered: false }),
  );
}

async function sincronizarLocalidades({ Estado, Cidade }) {
  if (!Estado || !Cidade) {
    throw new Error("Models Estado e Cidade precisam estar registradas antes da sincronização.");
  }

  const estadosPorCodigo = await sincronizarEstados(Estado);
  await sincronizarCidades(Cidade, estadosPorCodigo);

  console.log(
    `Localidades internas sincronizadas: ${localidades.estados.length} estados e ${localidades.cidades.length} cidades.`,
  );
}

function agendarSincronizacao({ connection, obterModels }) {
  let executada = false;

  const executar = async () => {
    if (executada) return;
    executada = true;

    try {
      await sincronizarLocalidades(obterModels());
    } catch (error) {
      executada = false;
      console.error("Falha ao sincronizar localidades internas:", error);
    }
  };

  if (connection.readyState === 1) setImmediate(executar);
  else connection.once("open", executar);
}

module.exports = {
  TAMANHO_LOTE,
  executarEmLotes,
  sincronizarEstados,
  sincronizarCidades,
  sincronizarLocalidades,
  agendarSincronizacao,
};
