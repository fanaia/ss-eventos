"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  mapearClienteParaOmie,
  mapearClienteDoOmie,
  diagnosticarMapeamentoClienteDoOmie,
  mapearCategoriaOmie,
  mapearContaCorrenteOmie,
  mapearContaPagar,
  extrairEstadoContaPagar,
} = require("../src/services/omieMappers");

test("mapeia cliente/fornecedor com código estável, tags e documento", () => {
  const payload = mapearClienteParaOmie(
    {
      _id: "abc123",
      nome: "Fornecedor Exemplo",
      documento: "12.345.678/0001-90",
      tipo: "PJ",
      cliente: true,
      fornecedor: true,
      status: "Ativo",
    },
    {
      nome: "Maria",
      email: "maria@example.com",
      telefone: "(35) 99999-0000",
    },
  );
  assert.equal(payload.codigo_cliente_integracao, "SS-EVENTOS:CLIENTE_FORNECEDOR:abc123");
  assert.equal(payload.cnpj_cpf, "12345678000190");
  assert.deepEqual(payload.tags, [{ tag: "Cliente" }, { tag: "Fornecedor" }]);
  assert.equal(payload.telefone1_ddd, "35");
});

test("mapeia nome obrigatório do cliente Omie e registra o campo de origem", () => {
  const diagnostico = diagnosticarMapeamentoClienteDoOmie({
    codigo_cliente_omie: 4927823925,
    nome_fantasia: "SODEXO PASS DO BRASIL SERVIÇOS DE INOVAÇÃO LTDA",
    razao_social: "SODEXO PASS DO BRASIL SERVICOS DE INOVACAO LTDA",
    nome: "Nome alternativo",
    cnpj_cpf: "12345678000190",
    tags: [{ tag: "Fornecedor" }],
    inativo: "N",
  });

  assert.equal(
    diagnostico.destino.nome,
    "SODEXO PASS DO BRASIL SERVIÇOS DE INOVAÇÃO LTDA",
  );
  assert.equal(diagnostico.mapeamento.origem.nome.campoSelecionado, "nome_fantasia");
  assert.equal(
    diagnostico.mapeamento.origem.nome.candidatos.razao_social,
    "SODEXO PASS DO BRASIL SERVICOS DE INOVACAO LTDA",
  );
  assert.equal(diagnostico.mapeamento.destino.fornecedor, true);
  assert.equal(mapearClienteDoOmie({ codigo_cliente_omie: 1, nome: "Nome direto" }).nome, "Nome direto");
});

test("usa fallback não vazio quando o Omie não informa nenhum campo de nome", () => {
  const diagnostico = diagnosticarMapeamentoClienteDoOmie({
    codigo_cliente_omie: 123,
    nome_fantasia: "   ",
    razao_social: "",
  });
  assert.equal(diagnostico.destino.nome, "Cadastro Omie 123");
  assert.equal(diagnostico.mapeamento.origem.nome.campoSelecionado, "fallback");
});

test("mapeia categoria e conta corrente do Omie", () => {
  const categoria = mapearCategoriaOmie({
    codigo: "2.01.01",
    descricao: "Fornecedores",
    totalizadora: "N",
    transferencia: "N",
    conta_inativa: "N",
    conta_despesa: "S",
  });
  assert.equal(categoria.codigo, "2.01.01");
  assert.equal(categoria.contaDespesa, true);
  assert.equal(categoria.totalizadora, false);

  const conta = mapearContaCorrenteOmie({
    nCodCC: 456,
    descricao: "Banco principal",
    codigo_banco: "001",
    codigo_agencia: "1234",
    numero_conta_corrente: "9999-0",
    inativo: "N",
  });
  assert.equal(conta.codigo, 456);
  assert.equal(conta.descricao, "Banco principal");
  assert.equal(conta.status, "Ativo");
});

test("gera conta a pagar idempotente e interpreta baixa parcial", () => {
  const payload = mapearContaPagar({
    pagamento: {
      _id: "64abc",
      valor: 120.5,
      dataPrevisaoPagamento: "2026-07-27",
    },
    codigoFornecedorOmie: 123,
    codigoCategoriaOmie: "2.01.01",
    contaCorrenteId: 456,
  });
  assert.equal(payload.codigo_lancamento_integracao, "SS-EVENTOS:PAGAMENTO:64abc");
  assert.equal(payload.valor_documento, 120.5);
  assert.equal(payload.codigo_categoria, "2.01.01");
  assert.equal(payload.id_conta_corrente, 456);

  const estado = extrairEstadoContaPagar({
    codigo_lancamento_omie: 999,
    codigo_lancamento_integracao: payload.codigo_lancamento_integracao,
    valor_documento: 120.5,
    valor_pag: 20.5,
    liquidado: "N",
  });
  assert.equal(estado.valorPago, 20.5);
  assert.equal(estado.valorPendente, 100);
  assert.equal(estado.liquidado, false);
});
