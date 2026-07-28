"use strict";

const {
  somenteDigitos,
  arredondarMoeda,
  codigoClienteIntegracao,
  codigoPagamentoIntegracao,
  dataOmie,
  deBooleanoOmie,
  primeiraChave,
} = require("./omieUtils");

function separarTelefone(valor) {
  const digitos = somenteDigitos(valor);
  if (!digitos) return {};
  const numero = digitos.startsWith("55") && digitos.length > 11
    ? digitos.slice(2)
    : digitos;
  const ddd = numero.length >= 10 ? numero.slice(0, 2) : "";
  return {
    ...(ddd ? { telefone1_ddd: ddd } : {}),
    telefone1_numero: ddd ? numero.slice(2) : numero,
  };
}

function mapearClienteParaOmie(cliente, contato) {
  const tags = [];
  if (cliente.cliente) tags.push({ tag: "Cliente" });
  if (cliente.fornecedor) tags.push({ tag: "Fornecedor" });

  return {
    codigo_cliente_integracao: cliente.codigoClienteIntegracao
      || codigoClienteIntegracao(cliente._id),
    razao_social: String(cliente.nome || "").slice(0, 60),
    nome_fantasia: String(cliente.nome || "").slice(0, 100),
    ...(cliente.tipo === "Est"
      ? { documento_exterior: String(cliente.documento || "").slice(0, 20) }
      : { cnpj_cpf: somenteDigitos(cliente.documento) }),
    ...(contato?.nome ? { contato: String(contato.nome).slice(0, 100) } : {}),
    ...(contato?.email ? { email: String(contato.email).slice(0, 500) } : {}),
    ...separarTelefone(contato?.telefone),
    tags,
    inativo: cliente.status === "Inativo" ? "S" : "N",
  };
}

function mapearClienteDoOmie(registro) {
  const tags = new Set(
    (registro.tags || [])
      .map((item) => String(item.tag || item.cTag || "").toLowerCase()),
  );
  const documento = registro.cnpj_cpf
    || registro.documento_exterior
    || registro.nif
    || "";
  const codigo = Number(
    registro.codigo_cliente_omie || registro.codigo_cliente || 0,
  ) || undefined;

  return {
    codigoClienteOmie: codigo,
    codigoClienteIntegracao: registro.codigo_cliente_integracao || undefined,
    nome: registro.nome_fantasia
      || registro.razao_social
      || `Cadastro Omie ${codigo || "sem código"}`,
    tipo: documento
      ? (
        registro.documento_exterior || registro.exterior === "S"
          ? "Est"
          : somenteDigitos(documento).length === 11
            ? "PF"
            : "PJ"
      )
      : "Est",
    documento,
    cliente: tags.has("cliente") || (!tags.has("fornecedor") && !tags.size),
    fornecedor: tags.has("fornecedor"),
    origem: "Omie",
    status: registro.inativo === "S" ? "Inativo" : "Ativo",
    omieAtualizadoEm: new Date(),
  };
}

function mapearCategoriaOmie(registro, data = new Date()) {
  return {
    codigo: String(registro.codigo || ""),
    descricao: registro.descricao || registro.descricao_padrao || "",
    natureza: registro.natureza || "",
    tipoCategoria: registro.tipo_categoria || "",
    categoriaSuperiorCodigo: registro.categoria_superior || "",
    totalizadora: deBooleanoOmie(registro.totalizadora),
    transferencia: deBooleanoOmie(registro.transferencia),
    contaInativa: deBooleanoOmie(registro.conta_inativa),
    contaDespesa: deBooleanoOmie(registro.conta_despesa),
    contaReceita: deBooleanoOmie(registro.conta_receita),
    naoExibir: deBooleanoOmie(registro.nao_exibir),
    sincronizadoEm: data,
    vistoEm: data,
  };
}

function mapearContaCorrenteOmie(registro, data = new Date()) {
  const codigo = Number(
    registro.nCodCC
    || registro.codigo_conta_corrente
    || registro.id_conta_corrente
    || 0,
  );
  const inativa = deBooleanoOmie(registro.inativo);
  return {
    codigo,
    codigoIntegracao: registro.cCodCCInt || registro.codigo_integracao || undefined,
    descricao: registro.descricao || registro.nome || `Conta ${codigo}`,
    tipo: registro.tipo_conta_corrente || registro.tipo || "",
    codigoBanco: String(registro.codigo_banco || ""),
    codigoAgencia: String(registro.codigo_agencia || ""),
    numeroConta: String(
      registro.numero_conta_corrente || registro.conta_corrente || "",
    ),
    inativa,
    bloqueada: deBooleanoOmie(registro.bloqueado),
    sincronizadoEm: data,
    vistoEm: data,
    status: inativa ? "Inativo" : "Ativo",
  };
}

function numeroDocumentoPagamento(pagamento) {
  return `SS-${String(pagamento._id || "").slice(-12).toUpperCase()}`.slice(0, 20);
}

function mapearContaPagar({
  pagamento,
  codigoFornecedorOmie,
  codigoCategoriaOmie,
  contaCorrenteId,
}) {
  const codigoConta = Number(contaCorrenteId || 0);
  if (!codigoConta) {
    throw new Error(
      "Relacione uma Conta Corrente Omie ativa à categoria ou subcategoria.",
    );
  }
  const data = dataOmie(pagamento.dataPrevisaoPagamento);
  return {
    codigo_lancamento_integracao: pagamento.codigoLancamentoIntegracao
      || codigoPagamentoIntegracao(pagamento._id),
    codigo_cliente_fornecedor: Number(codigoFornecedorOmie),
    data_vencimento: data,
    data_previsao: data,
    valor_documento: arredondarMoeda(pagamento.valor),
    codigo_categoria: String(codigoCategoriaOmie),
    id_conta_corrente: codigoConta,
    numero_documento: numeroDocumentoPagamento(pagamento),
    observacao: `Pagamento SS Eventos ${String(pagamento._id)}`,
  };
}

function extrairEstadoContaPagar(titulo) {
  const valorDocumento = arredondarMoeda(
    primeiraChave(
      titulo,
      ["valor_documento", "valor_documento_original", "valor"],
      0,
    ),
  );
  const valorPago = arredondarMoeda(
    primeiraChave(titulo, ["valor_pag", "valor_pago", "valor_baixado"], 0),
  );
  const liquidado = String(
    primeiraChave(titulo, ["liquidado"], "N"),
  ).toUpperCase() === "S"
    || String(titulo.status_titulo || titulo.status || "").toUpperCase() === "LIQUIDADO";
  const pago = liquidado && valorPago <= 0 ? valorDocumento : valorPago;

  return {
    codigoLancamentoOmie: Number(
      primeiraChave(titulo, ["codigo_lancamento_omie", "codigo_lancamento"], 0),
    ) || undefined,
    codigoLancamentoIntegracao: titulo.codigo_lancamento_integracao,
    valorDocumento,
    valorPago: pago,
    valorPendente: arredondarMoeda(Math.max(0, valorDocumento - pago)),
    liquidado: liquidado || (valorDocumento > 0 && pago >= valorDocumento),
    status: titulo.status_titulo || titulo.status || "",
    dataUltimaBaixa: titulo.data_ultima_baixa || titulo.data_pagamento || null,
  };
}

module.exports = {
  separarTelefone,
  mapearClienteParaOmie,
  mapearClienteDoOmie,
  mapearCategoriaOmie,
  mapearContaCorrenteOmie,
  mapearContaPagar,
  extrairEstadoContaPagar,
  numeroDocumentoPagamento,
};
