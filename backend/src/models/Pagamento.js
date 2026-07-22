const { defineModel, fields } = require("@oondemand/oon-core-back");

defineModel({
  name: "Pagamento",
  singular: "pagamento",
  basePath: "/pagamentos",
  schema: {
    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),
    projetoItemId: fields.ref("ProjetoItem", { required: true, label: "Item do Projeto" }),
    dataPrevisaoPagamento: fields.date({ required: true, label: "Data previsão pagamento" }),
    formaPagamento: fields.string({ required: true, label: "Forma de pagamento" }),
    valor: fields.currency({ required: true, label: "Valor" }),
    responsavelPagamentoId: fields.ref("Responsavel", {
      required: true,
      label: "Responsável Pagamento",
    }),
    nfRecebida: fields.boolean({ label: "NF Recebida", default: false }),
    etapa: fields.enum(
      ["Solicitado", "Aprovado", "Aguardando NF", "Enviado para Omie", "Pagamento Ok"],
      { required: true, label: "Etapa", default: "Solicitado" }
    ),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});
