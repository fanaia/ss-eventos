const CAMPOS_CALCULADOS = [
  "orcamentoTotalSemImpostos",
  "orcamentoFee",
  "orcamentoImposto",
  "orcamentoTotalComImpostoFee",
  "fechamentoTotalSemImpostos",
  "fechamentoFee",
  "fechamentoImposto",
  "fechamentoTotalComImpostoFee",
];

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function arredondarMoeda(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

function calcularBloco(dados, prefixo, faturamento, percentualFee, percentualImposto) {
  const quantidade = numero(dados[`${prefixo}Quantidade`]);
  const diarias = numero(dados[`${prefixo}Diarias`]);
  const valorUnitario = numero(dados[`${prefixo}ValorUnitario`]);

  const totalSemImpostos = arredondarMoeda(quantidade * diarias * valorUnitario);
  const fee =
    faturamento === "Agência Interna"
      ? 0
      : arredondarMoeda(totalSemImpostos * (numero(percentualFee) / 100));

  let baseImposto = 0;
  if (faturamento === "Agência") baseImposto = totalSemImpostos + fee;
  if (faturamento === "Agência Interna") baseImposto = totalSemImpostos;
  if (faturamento === "Faturamento Direto") baseImposto = fee;

  const imposto = arredondarMoeda(baseImposto * (numero(percentualImposto) / 100));
  const totalComImpostoFee = arredondarMoeda(totalSemImpostos + fee + imposto);

  return {
    [`${prefixo}TotalSemImpostos`]: totalSemImpostos,
    [`${prefixo}Fee`]: fee,
    [`${prefixo}Imposto`]: imposto,
    [`${prefixo}TotalComImpostoFee`]: totalComImpostoFee,
  };
}

function removerCamposCalculados(dados = {}) {
  const resultado = { ...dados };
  for (const campo of CAMPOS_CALCULADOS) delete resultado[campo];
  return resultado;
}

function calcularValoresItem(dados = {}, projeto = {}) {
  const limpos = removerCamposCalculados(dados);
  const faturamento = limpos.faturamento;
  const percentualFee = projeto.percentualFee;
  const percentualImposto = projeto.percentualImposto;

  return {
    ...limpos,
    ...calcularBloco(limpos, "orcamento", faturamento, percentualFee, percentualImposto),
    ...calcularBloco(limpos, "fechamento", faturamento, percentualFee, percentualImposto),
  };
}

module.exports = {
  CAMPOS_CALCULADOS,
  calcularValoresItem,
  removerCamposCalculados,
};
