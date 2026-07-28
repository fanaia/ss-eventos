"use strict";

const { sanitizarErro } = require("./omieUtils");

const ENDPOINTS = Object.freeze({
  clientes: "https://app.omie.com.br/api/v1/geral/clientes/",
  categorias: "https://app.omie.com.br/api/v1/geral/categorias/",
  contasCorrentes: "https://app.omie.com.br/api/v1/geral/contacorrente/",
  contasPagar: "https://app.omie.com.br/api/v1/financas/contapagar/",
});

class OmieApiError extends Error {
  constructor(message, opcoes = {}) {
    super(message);
    this.name = "OmieApiError";
    this.statusCode = opcoes.statusCode;
    this.code = opcoes.code;
    this.retryable = Boolean(opcoes.retryable);
    this.response = opcoes.response;
    this.trace = opcoes.trace;
    this.traces = opcoes.traces;
  }
}

function numeroEnv(nome, padrao) {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deveRepetir(statusCode, erro) {
  return [408, 425, 429, 500, 502, 503, 504].includes(statusCode)
    || erro?.name === "AbortError"
    || ["ECONNRESET", "ETIMEDOUT"].includes(erro?.code);
}

function sanitizarValor(valor, nivel = 0) {
  if (valor == null || typeof valor === "number" || typeof valor === "boolean") return valor;
  if (typeof valor === "string") return valor.length > 2000 ? `${valor.slice(0, 2000)}…` : valor;
  if (nivel >= 5) return "[profundidade limitada]";
  if (Array.isArray(valor)) {
    return {
      total: valor.length,
      amostra: valor.slice(0, 10).map((item) => sanitizarValor(item, nivel + 1)),
      limitada: valor.length > 10,
    };
  }
  if (typeof valor === "object") {
    const segredo = /app[_-]?key|app[_-]?secret|authorization|token|senha|password/i;
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([chave]) => !segredo.test(chave))
        .slice(0, 40)
        .map(([chave, item]) => [chave, sanitizarValor(item, nivel + 1)]),
    );
  }
  return String(valor);
}

function normalizarErroResposta(body, statusCode) {
  const code = body?.faultcode ?? body?.code ?? body?.codigo_status;
  const description = body?.faultstring ?? body?.description ?? body?.descricao_status;
  if (!description && statusCode >= 200 && statusCode < 300) return null;
  const sucesso = String(code ?? "0") === "0";
  if (statusCode >= 200 && statusCode < 300 && sucesso && !body?.faultstring) return null;
  return new OmieApiError(description || `Omie retornou HTTP ${statusCode}.`, {
    statusCode,
    code,
    retryable: deveRepetir(statusCode),
    response: body,
  });
}

function criarOmieClient(opcoes = {}) {
  const appKey = opcoes.appKey || process.env.OMIE_APP_KEY;
  const appSecret = opcoes.appSecret || process.env.OMIE_APP_SECRET;
  const timeoutMs = opcoes.timeoutMs || numeroEnv("OMIE_TIMEOUT_MS", 30000);
  const maxTentativas = opcoes.maxTentativas || numeroEnv("OMIE_HTTP_ATTEMPTS", 3);
  const maxTraces = numeroEnv("OMIE_TRACE_LIMIT", 100);
  const fetchImpl = opcoes.fetchImpl || globalThis.fetch;
  const traces = [];

  if (!appKey || !appSecret) {
    throw new OmieApiError("Configure OMIE_APP_KEY e OMIE_APP_SECRET.");
  }
  if (typeof fetchImpl !== "function") {
    throw new OmieApiError("O runtime não oferece fetch para chamar a API Omie.");
  }

  function registrarTrace(trace) {
    if (traces.length < maxTraces) traces.push(trace);
    if (typeof opcoes.onTrace === "function") opcoes.onTrace(trace);
  }

  async function chamar(endpoint, call, param = [{}]) {
    const url = ENDPOINTS[endpoint] || endpoint;
    const parametros = Array.isArray(param) ? param : [param];
    const envelope = { app_key: appKey, app_secret: appSecret, call, param: parametros };
    let ultimoErro;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
      const iniciouEm = new Date();
      const trace = {
        endpoint,
        url,
        call,
        tentativa,
        iniciouEm,
        request: { call, param: sanitizarValor(parametros) },
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resposta = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(envelope),
          signal: controller.signal,
        });
        trace.httpStatus = resposta.status;
        const texto = await resposta.text();
        let body;
        try {
          body = texto ? JSON.parse(texto) : {};
        } catch {
          trace.response = { texto: sanitizarValor(texto) };
          throw new OmieApiError("Resposta inválida da API Omie.", {
            statusCode: resposta.status,
            retryable: resposta.status >= 500,
          });
        }
        trace.response = sanitizarValor(body);
        const erroResposta = normalizarErroResposta(body, resposta.status);
        if (erroResposta) throw erroResposta;
        trace.status = "Sucesso";
        trace.concluiuEm = new Date();
        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();
        registrarTrace(trace);
        return body;
      } catch (erro) {
        trace.status = "Erro";
        trace.erro = sanitizarErro(erro);
        trace.response = trace.response || sanitizarValor(erro?.response || {});
        trace.concluiuEm = new Date();
        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();
        registrarTrace(trace);

        const retryable = erro instanceof OmieApiError
          ? erro.retryable
          : deveRepetir(erro?.statusCode, erro);
        ultimoErro = erro instanceof OmieApiError
          ? erro
          : new OmieApiError(sanitizarErro(erro), { retryable, code: erro?.code });
        ultimoErro.trace = trace;
        ultimoErro.traces = [...traces];
        if (!retryable || tentativa >= maxTentativas) throw ultimoErro;
        await dormir(
          Math.min(5000, 500 * (2 ** (tentativa - 1))) + Math.floor(Math.random() * 250),
        );
      } finally {
        clearTimeout(timer);
      }
    }
    throw ultimoErro;
  }

  async function paginar(endpoint, call, paramBase = {}, extrairItens) {
    const itens = [];
    let pagina = 1;
    let totalPaginas = 1;
    do {
      const resposta = await chamar(endpoint, call, [{
        ...paramBase,
        pagina,
        registros_por_pagina: Math.min(
          100,
          Number(paramBase.registros_por_pagina || 100),
        ),
      }]);
      itens.push(...(extrairItens(resposta) || []));
      totalPaginas = Number(resposta.total_de_paginas || resposta.totalDePaginas || 1);
      pagina += 1;
    } while (pagina <= totalPaginas);
    return itens;
  }

  return {
    chamar,
    paginar,
    endpoints: ENDPOINTS,
    getTraces: () => [...traces],
  };
}

module.exports = {
  ENDPOINTS,
  OmieApiError,
  criarOmieClient,
  normalizarErroResposta,
  sanitizarValor,
};
