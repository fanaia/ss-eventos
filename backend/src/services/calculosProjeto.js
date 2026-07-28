const CAMPOS_CALCULADOS = [
  "orcamentoTotal",
  "contratacaoTotal",
  "fechamentoValor",
  "fechamentoFee",
  "fechamentoImposto",
  "fechamentoTotal",
  "fechamentoLucroValor",
  "fechamentoLucroPercentual",
  "pagamentoValorPendente",
  "pagamentoResumo",

  // Campos legados removidos do contrato atual.
  "orcamentoTotalSemImpostos",
  "orcamentoFee",
  "orcamentoImposto",
  "orcamentoTotalComImpostoFee",
  "fechamentoTotalSemImpostos",
  "fechamentoTotalComImpostoFee",
];

const formatadorBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function arredondar(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

function formatarMoedaBRL(valor) {
  return formatadorBRL.format(arredondar(Math.max(0, numero(valor))));
}

function resumirPagamento({ status, pendente } = {}) {
  const saldo = arredondar(Math.max(0, numero(pendente)));
  if (String(status || "").trim() === "Pago" && saldo <= 0.01) return "Pago";
  return `Pendente: ${formatarMoedaBRL(saldo)}`;
}

function calcularTotal(dados, prefixo) {
  const quantidade = numero(dados[`${prefixo}Quantidade`]);
  const diarias = numero(dados[`${prefixo}Diarias`]);
  const valorUnitario = numero(dados[`${prefixo}ValorUnitario`]);

  return arredondar(quantidade * diarias * valorUnitario);
}

function calcularFechamento({
  orcamentoTotal,
  contratacaoTotal,
  faturamento,
  percentualFee,
  percentualImposto,
}) {
  const fee =
    faturamento === "Agência Interna"
      ? 0
      : arredondar(orcamentoTotal * (numero(percentualFee) / 100));

  let baseImposto = 0;
  if (faturamento === "Agência") baseImposto = orcamentoTotal + fee;
  if (faturamento === "Agência Interna") baseImposto = orcamentoTotal;
  if (faturamento === "Faturamento Direto") baseImposto = fee;

  const imposto = arredondar(baseImposto * (numero(percentualImposto) / 100));
  const total = arredondar(orcamentoTotal + fee + imposto);
  const lucroValor = arredondar(orcamentoTotal - contratacaoTotal + fee);
  const lucroPercentual =
    orcamentoTotal > 0
      ? arredondar((lucroValor / orcamentoTotal) * 100)
      : 0;

  return {
    fechamentoValor: orcamentoTotal,
    fechamentoFee: fee,
    fechamentoImposto: imposto,
    fechamentoTotal: total,
    fechamentoLucroValor: lucroValor,
    fechamentoLucroPercentual: lucroPercentual,
  };
}

function removerCamposCalculados(dados = {}) {
  const resultado = { ...dados };
  for (const campo of CAMPOS_CALCULADOS) delete resultado[campo];
  return resultado;
}

function calcularValoresItem(dados = {}, projeto = {}) {
  const limpos = removerCamposCalculados(dados);
  const orcamentoTotal = calcularTotal(limpos, "orcamento");
  const contratacaoTotal = calcularTotal(limpos, "contratacao");
  const pagamentoValorPendente = arredondar(
    Math.max(0, contratacaoTotal - numero(limpos.pagamentoTotalPago)),
  );

  return {
    ...limpos,
    orcamentoTotal,
    contratacaoTotal,
    pagamentoValorPendente,
    pagamentoResumo: resumirPagamento({
      status: limpos.pagamentoStatus,
      pendente: pagamentoValorPendente,
    }),
    ...calcularFechamento({
      orcamentoTotal,
      contratacaoTotal,
      faturamento: limpos.faturamento,
      percentualFee: projeto.percentualFee,
      percentualImposto: projeto.percentualImposto,
    }),
  };
}

module.exports = {
  CAMPOS_CALCULADOS,
  arredondar,
  calcularTotal,
  calcularFechamento,
  calcularValoresItem,
  formatarMoedaBRL,
  removerCamposCalculados,
  resumirPagamento,
};
