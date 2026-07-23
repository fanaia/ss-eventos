const { GenericError } = require("@oondemand/oon-core-back");

function arredondar(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function calcularSaldoFinanceiro(totalContratado, pagamentos = []) {
  const total = arredondar(totalContratado || 0);
  const totalGerado = arredondar(
    pagamentos.reduce((soma, pagamento) => soma + Number(pagamento?.valor || 0), 0)
  );

  return {
    totalContratado: total,
    totalGerado,
    valorPendente: arredondar(Math.max(0, total - totalGerado)),
  };
}

function validarValorPagamento(valorInformado, saldo) {
  const valor = arredondar(valorInformado);

  if (saldo.totalContratado <= 0) {
    throw new GenericError("Informe a contratação do item antes de gerar pagamentos.");
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new GenericError("O valor do pagamento deve ser maior que zero.", {
      details: { field: "valor", message: "Informe um valor maior que zero." },
    });
  }
  if (valor > saldo.valorPendente) {
    throw new GenericError(
      `O valor informado excede o saldo pendente de R$ ${saldo.valorPendente.toFixed(2)}.`,
      { details: { field: "valor", message: "O valor não pode exceder o saldo pendente." } }
    );
  }

  return valor;
}

module.exports = {
  arredondar,
  calcularSaldoFinanceiro,
  validarValorPagamento,
};
