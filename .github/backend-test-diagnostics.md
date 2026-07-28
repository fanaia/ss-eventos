# Diagnóstico dos testes backend

- Instalação: `0`
- Testes: `1`

```text
✔ usa o registro consolidado nas mutações parciais da esteira (1.785423ms)
✔ mantém compatibilidade quando a validação não recebe contexto (0.206444ms)
✔ interpreta subcategoria omitida como remoção quando a categoria foi enviada (0.281075ms)
✔ preserva subcategoria nas mutações rápidas que não enviam a categoria (0.193686ms)
✔ identifica subcategoria compatível e rejeita vínculo antigo (0.198673ms)
✖ validação permite que o model limpe vínculo incompatível (3.719845ms)
  AssertionError [ERR_ASSERTION]: The input was expected to not match the regular expression /A subcategoria selecionada não pertence à categoria informada/. Input:
  
  '"use strict";\n' +
    '\n' +
    'const { defineValidation, registry, GenericError } = require("@oondemand/oon-core-back");\n' +
    'const {\n' +
    '  dadosConsolidados,\n' +
    '  dadosComDependenciaOpcional,\n' +
    '  subcategoriaPertenceACategoria,\n' +
    '} = require("../services/dadosValidacao");\n' +
    '\n' +
    'function model(nome) {\n' +
    '  const Model = registry.getModel(nome)?.mongooseModel;\n' +
    '  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);\n' +
    '  return Model;\n' +
    '}\n' +
    '\n' +
    'function erroCampo(field, message) {\n' +
    '  throw new GenericError(message, { details: { field, message } });\n' +
    '}\n' +
    '\n' +
    'async function registroAtivo(nome, id, field, mensagem) {\n' +
    '  if (!id) erroCampo(field, mensagem);\n' +
    '  const registro = await model(nome).findById(id).lean();\n' +
    '  if (!registro || registro.status === "Inativo") erroCampo(field, mensagem);\n' +
    '  return registro;\n' +
    '}\n' +
    '\n' +
    'function porPrioridade(item, categorias) {\n' +
    '  const porId = new Map(categorias.map((categoria) => [String(categoria._id), categoria]));\n' +
    '  return [\n' +
    '    porId.get(String(item.subcategoriaId || "")),\n' +
    '    porId.get(String(item.categoriaId || "")),\n' +
    '  ].filter(Boolean);\n' +
    '}\n' +
    '\n' +
    'async function categoriaOmieValidaParaItem(item) {\n' +
    '  const categorias = await model("Categoria").find({\n' +
    '    _id: { $in: [item.subcategoriaId, item.categoriaId].filter(Boolean) },\n' +
    '  }).lean();\n' +
    '  const categoriaLocal = porPrioridade(item, categorias)\n' +
    '    .find((registro) => registro.omieCategoriaId);\n' +
    '  if (!categoriaLocal) return null;\n' +
    '\n' +
    '  const categoria = await model("OmieCategoria")\n' +
    '    .findById(categoriaLocal.omieCategoriaId)\n' +
    '    .lean();\n' +
    '  return categoria\n' +
    '    && categoria.status === "Ativo"\n' +
    '    && !categoria.contaInativa\n' +
    '    && !categoria.totalizadora\n' +
    '    && !categoria.transferencia\n' +
    '    && !categoria.naoExibir\n' +
    '    ? categoria\n' +
    '    : null;\n' +
    '}\n' +
    '\n' +
    'async function contaCorrenteOmieValida(id) {\n' +
    '  if (!id) return null;\n' +
    '  const conta = await model("OmieContaCorrente").findById(id).lean();\n' +
    '  return conta\n' +
    '    && conta.status === "Ativo"\n' +
    '    && !conta.inativa\n' +
    '    && !conta.bloqueada\n' +
    '    ? conta\n' +
    '    : null;\n' +
    '}\n' +
    '\n' +
    'defineValidation("Projeto", async (dados, contexto) => {\n' +
    '  const entrada = dadosConsolidados(dados, contexto);\n' +
    '  const cliente = await registroAtivo(\n' +
    '    "ClienteFornecedor",\n' +
    '    entrada.clienteId,\n' +
    '    "clienteId",\n' +
    '    "Selecione um cliente ativo.",\n' +
    '  );\n' +
    '  if (!cliente.cliente) {\n' +
    '    erroCampo("clienteId", "O cadastro selecionado não está marcado como Cliente.");\n' +
    '  }\n' +
    '\n' +
    '  const fornecedor = await registroAtivo(\n' +
    '    "ClienteFornecedor",\n' +
    '    entrada.fornecedorId,\n' +
    '    "fornecedorId",\n' +
    '    "Selecione um fornecedor ativo.",\n' +
    '  );\n' +
    '  if (!fornecedor.fornecedor) {\n' +
    '    erroCampo(\n' +
    '      "fornecedorId",\n' +
    '      "O cadastro selecionado não está marcado como Fornecedor.",\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  const contato = await registroAtivo(\n' +
    '    "Contato",\n' +
    '    entrada.contatoPrincipalId,\n' +
    '    "contatoPrincipalId",\n' +
    '    "Selecione um contato ativo.",\n' +
    '  );\n' +
    '  if (String(contato.clienteFornecedorId) !== String(entrada.clienteId)) {\n' +
    '    erroCampo(\n' +
    '      "contatoPrincipalId",\n' +
    '      "O contato principal deve pertencer ao cliente selecionado.",\n' +
    '    );\n' +
    '  }\n' +
    '});\n' +
    '\n' +
    'defineValidation("ProjetoItem", async (dados, contexto) => {\n' +
    '  const entrada = dadosComDependenciaOpcional(\n' +
    '    dados,\n' +
    '    contexto,\n' +
    '    "categoriaId",\n' +
    '    "subcategoriaId",\n' +
    '  );\n' +
    '  await registroAtivo(\n' +
    '    "Projeto",\n' +
    '    entrada.projetoId,\n' +
    '    "projetoId",\n' +
    '    "Selecione um projeto ativo.",\n' +
    '  );\n' +
    '  await registroAtivo(\n' +
    '    "Responsavel",\n' +
    '    entrada.responsavelId,\n' +
    '    "responsavelId",\n' +
    '    "Selecione um responsável ativo.",\n' +
    '  );\n' +
    '  const estado = await registroAtivo(\n' +
    '    "Estado",\n' +
    '    entrada.estadoId,\n' +
    '    "estadoId",\n' +
    '    "Selecione um estado ativo.",\n' +
    '  );\n' +
    '  const cidade = await registroAtivo(\n' +
    '    "Cidade",\n' +
    '    entrada.cidadeId,\n' +
    '    "cidadeId",\n' +
    '    "Selecione uma cidade ativa.",\n' +
    '  );\n' +
    '  if (String(cidade.estadoId) !== String(estado._id)) {\n' +
    '    erroCampo("cidadeId", "A cidade selecionada não pertence ao estado informado.");\n' +
    '  }\n' +
    '\n' +
    '  const categoria = await registroAtivo(\n' +
    '    "Categoria",\n' +
    '    entrada.categoriaId,\n' +
    '    "categoriaId",\n' +
    '    "Selecione uma categoria ativa.",\n' +
    '  );\n' +
    '  if (categoria.categoriaPaiId) {\n' +
    '    erroCampo("categoriaId", "Selecione uma categoria principal, sem categoria pai.");\n' +
    '  }\n' +
    '  if (entrada.subcategoriaId) {\n' +
    '    const subcategoria = await registroAtivo(\n' +
    '      "Categoria",\n' +
    '      entrada.subcategoriaId,\n' +
    '      "subcategoriaId",\n' +
    '      "Selecione uma subcategoria ativa.",\n' +
    '    );\n' +
    '    if (!subcategoriaPertenceACategoria(categoria._id, subcategoria)) {\n' +
    '      erroCampo(\n' +
    '        "subcategoriaId",\n' +
    '        "A subcategoria selecionada não pertence à categoria informada.",\n' +
    '      );\n' +
    '    }\n' +
    '  }\n' +
    '});\n' +
    '\n' +
    'defineValidation("Pagamento", async (dados, contexto) => {\n' +
    '  const entrada = dadosConsolidados(dados, contexto);\n' +
    '  const item = await model("ProjetoItem").findById(entrada.projetoItemId).lean();\n' +
    '  if (!item) erroCampo("projetoItemId", "Item do projeto não encontrado.");\n' +
    '  if (String(item.projetoId) !== String(entrada.projetoId)) {\n' +
    '    erroCampo(\n' +
    '      "projetoItemId",\n' +
    '      "O pagamento deve estar vinculado ao mesmo projeto do item.",\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  const responsavel = await registroAtivo(\n' +
    '    "Responsavel",\n' +
    '    entrada.responsavelPagamentoId,\n' +
    '    "responsavelPagamentoId",\n' +
    '    "Selecione um responsável de pagamento ativo.",\n' +
    '  );\n' +
    '  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {\n' +
    '    erroCampo(\n' +
    '      "responsavelPagamentoId",\n' +
    '      "O responsável selecionado não está habilitado para pagamentos.",\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  if (\n' +
    '    entrada.omieContaCorrenteId\n' +
    '    && !await contaCorrenteOmieValida(entrada.omieContaCorrenteId)\n' +
    '  ) {\n' +
    '    erroCampo(\n' +
    '      "omieContaCorrenteId",\n' +
    '      "Selecione uma Conta Corrente Omie ativa e não bloqueada.",\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  if (entrada.etapa === "Aprovado") {\n' +
    '    if (!await categoriaOmieValidaParaItem(item)) {\n' +
    '      erroCampo(\n' +
    '        "projetoItemId",\n' +
    '        "Relacione a categoria ou subcategoria do item com uma Categoria Omie válida antes de aprovar.",\n' +
    '      );\n' +
    '    }\n' +
    '    if (!await contaCorrenteOmieValida(entrada.omieContaCorrenteId)) {\n' +
    '      erroCampo(\n' +
    '        "omieContaCorrenteId",\n' +
    '        "Selecione a Conta Corrente Omie do pagamento antes de aprovar.",\n' +
    '      );\n' +
    '    }\n' +
    '  }\n' +
    '  if (entrada.etapa === "Pagamento Ok" && !entrada.omieLiquidado) {\n' +
    '    erroCampo(\n' +
    '      "etapa",\n' +
    '      "O status Pagamento Ok é definido somente após a baixa confirmada no Omie.",\n' +
    '    );\n' +
    '  }\n' +
    '});\n' +
    '\n' +
    'module.exports = {\n' +
    '  categoriaOmieValidaParaItem,\n' +
    '  contaCorrenteOmieValida,\n' +
    '};\n'
  
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/acoes-validacao-subcategoria.test.js:63:10)
      at Test.runInAsyncScope (node:async_hooks:206:9)
      at Test.run (node:internal/test_runner/test:796:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:526:18)
      at Test.postRun (node:internal/test_runner/test:889:19)
      at Test.run (node:internal/test_runner/test:835:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:526:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: '"use strict";\n\nconst { defineValidation, registry, GenericError } = require("@oondemand/oon-core-back");\nconst {\n  dadosConsolidados,\n  dadosComDependenciaOpcional,\n  subcategoriaPertenceACategoria,\n} = require("../services/dadosValidacao");\n\nfunction model(nome) {\n  const Model = registry.getModel(nome)?.mongooseModel;\n  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);\n  return Model;\n}\n\nfunction erroCampo(field, message) {\n  throw new GenericError(message, { details: { field, message } });\n}\n\nasync function registroAtivo(nome, id, field, mensagem) {\n  if (!id) erroCampo(field, mensagem);\n  const registro = await model(nome).findById(id).lean();\n  if (!registro || registro.status === "Inativo") erroCampo(field, mensagem);\n  return registro;\n}\n\nfunction porPrioridade(item, categorias) {\n  const porId = new Map(categorias.map((categoria) => [String(categoria._id), categoria]));\n  return [\n    porId.get(String(item.subcategoriaId || "")),\n    porId.get(String(item.categoriaId || "")),\n  ].filter(Boolean);\n}\n\nasync function categoriaOmieValidaParaItem(item) {\n  const categorias = await model("Categoria").find({\n    _id: { $in: [item.subcategoriaId, item.categoriaId].filter(Boolean) },\n  }).lean();\n  const categoriaLocal = porPrioridade(item, categorias)\n    .find((registro) => registro.omieCategoriaId);\n  if (!categoriaLocal) return null;\n\n  const categoria = await model("OmieCategoria")\n    .findById(categoriaLocal.omieCategoriaId)\n    .lean();\n  return categoria\n    && categoria.status === "Ativo"\n    && !categoria.contaInativa\n    && !categoria.totalizadora\n    && !categoria.transferencia\n    && !categoria.naoExibir\n    ? categoria\n    : null;\n}\n\nasync function contaCorrenteOmieValida(id) {\n  if (!id) return null;\n  const conta = await model("OmieContaCorrente").findById(id).lean();\n  return conta\n    && conta.status === "Ativo"\n    && !conta.inativa\n    && !conta.bloqueada\n    ? conta\n    : null;\n}\n\ndefineValidation("Projeto", async (dados, contexto) => {\n  const entrada = dadosConsolidados(dados, contexto);\n  const cliente = await registroAtivo(\n    "ClienteFornecedor",\n    entrada.clienteId,\n    "clienteId",\n    "Selecione um cliente ativo.",\n  );\n  if (!cliente.cliente) {\n    erroCampo("clienteId", "O cadastro selecionado não está marcado como Cliente.");\n  }\n\n  const fornecedor = await registroAtivo(\n    "ClienteFornecedor",\n    entrada.fornecedorId,\n    "fornecedorId",\n    "Selecione um fornecedor ativo.",\n  );\n  if (!fornecedor.fornecedor) {\n    erroCampo(\n      "fornecedorId",\n      "O cadastro selecionado não está marcado como Fornecedor.",\n    );\n  }\n\n  const contato = await registroAtivo(\n    "Contato",\n    entrada.contatoPrincipalId,\n    "contatoPrincipalId",\n    "Selecione um contato ativo.",\n  );\n  if (String(contato.clienteFornecedorId) !== String(entrada.clienteId)) {\n    erroCampo(\n      "contatoPrincipalId",\n      "O contato principal deve pertencer ao cliente selecionado.",\n    );\n  }\n});\n\ndefineValidation("ProjetoItem", async (dados, contexto) => {\n  const entrada = dadosComDependenciaOpcional(\n    dados,\n    contexto,\n    "categoriaId",\n    "subcategoriaId",\n  );\n  await registroAtivo(\n    "Projeto",\n    entrada.projetoId,\n    "projetoId",\n    "Selecione um projeto ativo.",\n  );\n  await registroAtivo(\n    "Responsavel",\n    entrada.responsavelId,\n    "responsavelId",\n    "Selecione um responsável ativo.",\n  );\n  const estado = await registroAtivo(\n    "Estado",\n    entrada.estadoId,\n    "estadoId",\n    "Selecione um estado ativo.",\n  );\n  const cidade = await registroAtivo(\n    "Cidade",\n    entrada.cidadeId,\n    "cidadeId",\n    "Selecione uma cidade ativa.",\n  );\n  if (String(cidade.estadoId) !== String(estado._id)) {\n    erroCampo("cidadeId", "A cidade selecionada não pertence ao estado informado.");\n  }\n\n  const categoria = await registroAtivo(\n    "Categoria",\n    entrada.categoriaId,\n    "categoriaId",\n    "Selecione uma categoria ativa.",\n  );\n  if (categoria.categoriaPaiId) {\n    erroCampo("categoriaId", "Selecione uma categoria principal, sem categoria pai.");\n  }\n  if (entrada.subcategoriaId) {\n    const subcategoria = await registroAtivo(\n      "Categoria",\n      entrada.subcategoriaId,\n      "subcategoriaId",\n      "Selecione uma subcategoria ativa.",\n    );\n    if (!subcategoriaPertenceACategoria(categoria._id, subcategoria)) {\n      erroCampo(\n        "subcategoriaId",\n        "A subcategoria selecionada não pertence à categoria informada.",\n      );\n    }\n  }\n});\n\ndefineValidation("Pagamento", async (dados, contexto) => {\n  const entrada = dadosConsolidados(dados, contexto);\n  const item = await model("ProjetoItem").findById(entrada.projetoItemId).lean();\n  if (!item) erroCampo("projetoItemId", "Item do projeto não encontrado.");\n  if (String(item.projetoId) !== String(entrada.projetoId)) {\n    erroCampo(\n      "projetoItemId",\n      "O pagamento deve estar vinculado ao mesmo projeto do item.",\n    );\n  }\n\n  const responsavel = await registroAtivo(\n    "Responsavel",\n    entrada.responsavelPagamentoId,\n    "responsavelPagamentoId",\n    "Selecione um responsável de pagamento ativo.",\n  );\n  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {\n    erroCampo(\n      "responsavelPagamentoId",\n      "O responsável selecionado não está habilitado para pagamentos.",\n    );\n  }\n\n  if (\n    entrada.omieContaCorrenteId\n    && !await contaCorrenteOmieValida(entrada.omieContaCorrenteId)\n  ) {\n    erroCampo(\n      "omieContaCorrenteId",\n      "Selecione uma Conta Corrente Omie ativa e não bloqueada.",\n    );\n  }\n\n  if (entrada.etapa === "Aprovado") {\n    if (!await categoriaOmieValidaParaItem(item)) {\n      erroCampo(\n        "projetoItemId",\n        "Relacione a categoria ou subcategoria do item com uma Categoria Omie válida antes de aprovar.",\n      );\n    }\n    if (!await contaCorrenteOmieValida(entrada.omieContaCorrenteId)) {\n      erroCampo(\n        "omieContaCorrenteId",\n        "Selecione a Conta Corrente Omie do pagamento antes de aprovar.",\n      );\n    }\n  }\n  if (entrada.etapa === "Pagamento Ok" && !entrada.omieLiquidado) {\n    erroCampo(\n      "etapa",\n      "O status Pagamento Ok é definido somente após a baixa confirmada no Omie.",\n    );\n  }\n});\n\nmodule.exports = {\n  categoriaOmieValidaParaItem,\n  contaCorrenteOmieValida,\n};\n',
    expected: /A subcategoria selecionada não pertence à categoria informada/,
    operator: 'doesNotMatch'
  }

✔ subcategoria permanece opcional (2.414518ms)
✔ Pagamento agenda o Omie somente ao entrar na etapa automática (1.419325ms)
✔ etapas automáticas bloqueiam alterações manuais (0.228197ms)
✔ conciliação é um comando permitido somente na etapa Enviado para Omie (0.374264ms)
✔ automação muda status para Trabalhando e Revisão em caso de erro (0.301945ms)
✔ frontend remove Enviar ao Omie e mantém somente conciliação na etapa automática (0.394618ms)
✔ frontend bloqueia campos e oculta Salvar nas etapas automáticas (0.193246ms)
✔ calcula orçamento, contratação, fechamento e lucro (1.939048ms)
✔ não calcula fee no faturamento por Agência Interna (0.35714ms)
✔ remove campos calculados enviados pelo cliente e recalcula pelo servidor (0.243036ms)
✔ formata CPF, CNPJ e preserva documento estrangeiro no DataGrid (13.571847ms)
✔ associa o renderer à coluna Documento sem alterar as demais colunas (1.485576ms)
✔ registra o renderer no bootstrap atual da Central (0.46345ms)
✔ remove ação textual que abre a mesma aba padrão do ícone de editar (9.956249ms)
✔ preserva ações diferentes e atalhos para outra aba (0.692337ms)
✖ backend cadastra formas de pagamento e preserva uma forma padrão ativa (1.875354ms)
  Error: ENOENT: no such file or directory, open '/home/runner/work/ss-eventos/ss-eventos/backend/src/models/FormaPagamento.js'
      at Object.readFileSync (node:fs:448:20)
      at ler (/home/runner/work/ss-eventos/ss-eventos/backend/test/formas-pagamento.test.js:12:13)
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/formas-pagamento.test.js:16:17)
      at Test.runInAsyncScope (node:async_hooks:206:9)
      at Test.run (node:internal/test_runner/test:796:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:526:18)
      at node:internal/test_runner/harness:255:12
      at node:internal/process/task_queues:140:7
      at AsyncResource.runInAsyncScope (node:async_hooks:206:9)
      at AsyncResource.runMicrotask (node:internal/process/task_queues:137:8) {
    errno: -2,
    code: 'ENOENT',
    syscall: 'open',
    path: '/home/runner/work/ss-eventos/ss-eventos/backend/src/models/FormaPagamento.js'
  }

✖ pagamento usa referência configurada e mantém descrição histórica (5.185346ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /formaPagamentoId:\s*fields\.ref\("FormaPagamento"/. Input:
  
  '"use strict";\n' +
    '\n' +
    'const { defineModel, fields, GenericError } = require("@oondemand/oon-core-back");\n' +
    'const { enfileirarIntegracao } = require("./IntegrationOutbox");\n' +
    'const { codigoPagamentoIntegracao } = require("../services/omieUtils");\n' +
    '\n' +
    'const ETAPA_ENVIO_AUTOMATICO = "Enviado para Omie";\n' +
    'const ETAPA_PAGAMENTO_OK = "Pagamento Ok";\n' +
    'const ETAPAS_AUTOMATICAS = new Set([\n' +
    '  ETAPA_ENVIO_AUTOMATICO,\n' +
    '  ETAPA_PAGAMENTO_OK,\n' +
    ']);\n' +
    '\n' +
    'function etapaAutomatica(etapa) {\n' +
    '  return ETAPAS_AUTOMATICAS.has(String(etapa || ""));\n' +
    '}\n' +
    '\n' +
    'const entry = defineModel({\n' +
    '  name: "Pagamento",\n' +
    '  singular: "pagamento",\n' +
    '  basePath: "/pagamentos",\n' +
    '  schema: {\n' +
    '    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),\n' +
    '    projetoItemId: fields.ref("ProjetoItem", {\n' +
    '      required: true,\n' +
    '      label: "Item do Projeto",\n' +
    '    }),\n' +
    '    dataPrevisaoPagamento: fields.date({\n' +
    '      required: true,\n' +
    '      label: "Data previsão pagamento",\n' +
    '    }),\n' +
    '    omieContaCorrenteId: fields.ref("OmieContaCorrente", {\n' +
    '      label: "Conta corrente Omie",\n' +
    '    }),\n' +
    '    valor: fields.currency({ required: true, label: "Valor" }),\n' +
    '    responsavelPagamentoId: fields.ref("Responsavel", {\n' +
    '      required: true,\n' +
    '      label: "Responsável Pagamento",\n' +
    '    }),\n' +
    '    nfRecebida: fields.boolean({ label: "NF Recebida", default: false }),\n' +
    '    etapa: fields.enum(\n' +
    '      ["Solicitado", "Aprovado", "Aguardando NF", ETAPA_ENVIO_AUTOMATICO, ETAPA_PAGAMENTO_OK],\n' +
    '      { required: true, label: "Etapa", default: "Solicitado" },\n' +
    '    ),\n' +
    '    statusTrabalho: fields.enum(\n' +
    '      ["Aguardando início", "Trabalhando", "Revisar"],\n' +
    '      {\n' +
    '        required: true,\n' +
    '        label: "Status de trabalho",\n' +
    '        default: "Aguardando início",\n' +
    '      },\n' +
    '    ),\n' +
    '    codigoLancamentoIntegracao: fields.string({\n' +
    '      label: "Código de integração Omie",\n' +
    '      searchable: true,\n' +
    '    }),\n' +
    '    codigoLancamentoOmie: {\n' +
    '      type: Number,\n' +
    '      __meta: {\n' +
    '        kind: "number",\n' +
    '        label: "Lançamento Omie",\n' +
    '        readonly: true,\n' +
    '        readOnly: true,\n' +
    '      },\n' +
    '    },\n' +
    '    omieCodigoCategoriaEnviado: fields.string({\n' +
    '      label: "Categoria enviada ao Omie",\n' +
    '    }),\n' +
    '    omieCodigoClienteFornecedorEnviado: {\n' +
    '      type: Number,\n' +
    '      __meta: {\n' +
    '        kind: "number",\n' +
    '        label: "Fornecedor enviado ao Omie",\n' +
    '        readonly: true,\n' +
    '        readOnly: true,\n' +
    '      },\n' +
    '    },\n' +
    '    omieContaCorrenteEnviada: {\n' +
    '      type: Number,\n' +
    '      __meta: {\n' +
    '        kind: "number",\n' +
    '        label: "Conta corrente enviada ao Omie",\n' +
    '        readonly: true,\n' +
    '        readOnly: true,\n' +
    '      },\n' +
    '    },\n' +
    '    omieNumeroDocumentoEnviado: fields.string({\n' +
    '      label: "Documento enviado ao Omie",\n' +
    '    }),\n' +
    '    omieValorTitulo: fields.currency({ label: "Valor do título Omie" }),\n' +
    '    omieValorPago: fields.currency({ label: "Valor pago no Omie" }),\n' +
    '    omieValorPendente: fields.currency({ label: "Valor pendente no Omie" }),\n' +
    '    omieDataUltimaBaixa: fields.date({ label: "Última baixa no Omie" }),\n' +
    '    omieLiquidado: fields.boolean({\n' +
    '      label: "Liquidado no Omie",\n' +
    '      default: false,\n' +
    '    }),\n' +
    '    omieStatusIntegracao: fields.enum(\n' +
    '      ["Não enviado", "Pendente", "Processando", "Enviado", "Erro", "Cancelado"],\n' +
    '      {\n' +
    '        label: "Status integração Omie",\n' +
    '        default: "Não enviado",\n' +
    '      },\n' +
    '    ),\n' +
    '    omieUltimoErro: fields.string({\n' +
    '      label: "Último erro Omie",\n' +
    '      searchable: true,\n' +
    '    }),\n' +
    '    omieErroArquivado: fields.boolean({\n' +
    '      label: "Erro Omie arquivado",\n' +
    '      default: false,\n' +
    '    }),\n' +
    '    omieErroArquivadoEm: fields.date({ label: "Erro Omie arquivado em" }),\n' +
    '    omieErroArquivadoMotivo: fields.string({\n' +
    '      label: "Motivo do arquivamento do erro Omie",\n' +
    '    }),\n' +
    '    omieUltimaSincronizacaoEm: fields.date({\n' +
    '      label: "Última sincronização Omie",\n' +
    '    }),\n' +
    '    omiePayloadHash: fields.string({ label: "Hash enviado ao Omie" }),\n' +
    '    canceladoNaCentral: fields.boolean({\n' +
    '      label: "Cancelado na Central",\n' +
    '      default: false,\n' +
    '    }),\n' +
    '  },\n' +
    '  crud: {\n' +
    '    enabled: true,\n' +
    '    roles: { write: ["admin", "desenvolvedor"] },\n' +
    '    populateRefs: true,\n' +
    '  },\n' +
    '});\n' +
    '\n' +
    'const Model = entry.mongooseModel;\n' +
    'Model.schema.index({ codigoLancamentoIntegracao: 1 }, { unique: true, sparse: true });\n' +
    'Model.schema.index({ codigoLancamentoOmie: 1 }, { unique: true, sparse: true });\n' +
    '\n' +
    'const createOriginal = Model.create.bind(Model);\n' +
    'const updateOriginal = Model.findByIdAndUpdate.bind(Model);\n' +
    'const insertManyOriginal = Model.insertMany.bind(Model);\n' +
    '\n' +
    'function prepararCriacao(dados = {}) {\n' +
    '  const etapa = dados.etapa || "Solicitado";\n' +
    '  const envioAutomatico = etapa === ETAPA_ENVIO_AUTOMATICO;\n' +
    '  return {\n' +
    '    ...dados,\n' +
    '    etapa,\n' +
    '    statusTrabalho: etapaAutomatica(etapa)\n' +
    '      ? "Trabalhando"\n' +
    '      : dados.statusTrabalho || "Aguardando início",\n' +
    '    codigoLancamentoIntegracao: dados.codigoLancamentoIntegracao\n' +
    '      || (dados._id ? codigoPagamentoIntegracao(dados._id) : undefined),\n' +
    '    omieValorTitulo: Number(dados.valor || 0),\n' +
    '    omieValorPago: 0,\n' +
    '    omieValorPendente: Number(dados.valor || 0),\n' +
    '    omieStatusIntegracao: envioAutomatico\n' +
    '      ? "Pendente"\n' +
    '      : dados.omieStatusIntegracao || "Não enviado",\n' +
    '    omieUltimoErro: envioAutomatico ? "" : dados.omieUltimoErro || "",\n' +
    '    omieErroArquivado: false,\n' +
    '    omieErroArquivadoEm: null,\n' +
    '    omieErroArquivadoMotivo: "",\n' +
    '  };\n' +
    '}\n' +
    '\n' +
    'async function agendarContaPagar(pagamento) {\n' +
    '  if (\n' +
    '    !pagamento?._id\n' +
    '    || pagamento.etapa !== ETAPA_ENVIO_AUTOMATICO\n' +
    '    || pagamento.codigoLancamentoOmie\n' +
    '  ) {\n' +
    '    return;\n' +
    '  }\n' +
    '\n' +
    '  const codigo = pagamento.codigoLancamentoIntegracao\n' +
    '    || codigoPagamentoIntegracao(pagamento._id);\n' +
    '  await Model.updateOne(\n' +
    '    { _id: pagamento._id },\n' +
    '    {\n' +
    '      $set: {\n' +
    '        codigoLancamentoIntegracao: codigo,\n' +
    '        statusTrabalho: "Trabalhando",\n' +
    '        omieStatusIntegracao: "Pendente",\n' +
    '        omieUltimoErro: "",\n' +
    '        omieErroArquivado: false,\n' +
    '        omieErroArquivadoEm: null,\n' +
    '        omieErroArquivadoMotivo: "",\n' +
    '      },\n' +
    '    },\n' +
    '  );\n' +
    '\n' +
    '  await enfileirarIntegracao({\n' +
    '    provider: "omie",\n' +
    '    handler: "OMIE_CONTA_PAGAR_UPSERT",\n' +
    '    tipo: "OMIE_CONTA_PAGAR_UPSERT",\n' +
    '    resource: "contas-pagar",\n' +
    '    operation: "upsert",\n' +
    '    aggregateType: "Pagamento",\n' +
    '    aggregateId: pagamento._id,\n' +
    '    idempotencyKey: `omie:conta-pagar:${pagamento._id}`,\n' +
    '    payload: { pagamentoId: String(pagamento._id) },\n' +
    '  });\n' +
    '}\n' +
    '\n' +
    'Model.create = async function criarPagamento(dados, opcoes = {}) {\n' +
    '  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n' +
    '  if (Array.isArray(dados)) {\n' +
    '    const criados = await createOriginal(dados.map(prepararCriacao), mongoOptions);\n' +
    '    if (!skipOmieOutbox) {\n' +
    '      for (const criado of criados) await agendarContaPagar(criado);\n' +
    '    }\n' +
    '    return criados;\n' +
    '  }\n' +
    '\n' +
    '  const [criado] = await createOriginal([prepararCriacao(dados)], mongoOptions);\n' +
    '  if (!skipOmieOutbox) await agendarContaPagar(criado);\n' +
    '  return criado;\n' +
    '};\n' +
    '\n' +
    'Model.findByIdAndUpdate = async function atualizarPagamento(\n' +
    '  id,\n' +
    '  alteracoes = {},\n' +
    '  opcoes = {},\n' +
    ') {\n' +
    '  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n' +
    '  const atual = await Model.findById(id).lean();\n' +
    '  if (!atual) return null;\n' +
    '\n' +
    '  const usaSet = Boolean(alteracoes?.$set);\n' +
    '  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };\n' +
    '  const conciliarAgora = entrada._conciliarOmie === true\n' +
    '    || entrada._conciliarOmie === "true";\n' +
    '  delete entrada._conciliarOmie;\n' +
    '\n' +
    '  if (conciliarAgora) {\n' +
    '    if (atual.etapa !== ETAPA_ENVIO_AUTOMATICO) {\n' +
    '      throw new GenericError(\n' +
    '        "A conciliação manual somente está disponível em Enviado para Omie.",\n' +
    '        { statusCode: 409 },\n' +
    '      );\n' +
    '    }\n' +
    '    const {\n' +
    '      conciliarPagamentoAutomatico,\n' +
    '    } = require("../services/omiePagamentoAutomatico");\n' +
    '    await conciliarPagamentoAutomatico(id);\n' +
    '    return Model.findById(id);\n' +
    '  }\n' +
    '\n' +
    '  if (etapaAutomatica(atual.etapa) && !skipOmieOutbox) {\n' +
    '    throw new GenericError(\n' +
    '      "Esta é uma etapa automática. Os campos e as ações do pagamento ficam bloqueados.",\n' +
    '      { statusCode: 409 },\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  if (entrada.etapa === ETAPA_PAGAMENTO_OK && !skipOmieOutbox) {\n' +
    '    throw new GenericError(\n' +
    '      "A etapa Pagamento Ok somente pode ser definida pela conciliação com o Omie.",\n' +
    '      { statusCode: 409 },\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  if (\n' +
    '    entrada.etapa === ETAPA_ENVIO_AUTOMATICO\n' +
    '    && atual.etapa !== ETAPA_ENVIO_AUTOMATICO\n' +
    '  ) {\n' +
    '    if (atual.etapa !== "Aguardando NF") {\n' +
    '      throw new GenericError(\n' +
    '        "O pagamento somente pode entrar em Enviado para Omie após Aguardando NF.",\n' +
    '        { statusCode: 409 },\n' +
    '      );\n' +
    '    }\n' +
    '    entrada.statusTrabalho = "Trabalhando";\n' +
    '    entrada.omieStatusIntegracao = "Pendente";\n' +
    '    entrada.omieUltimoErro = "";\n' +
    '    entrada.omieErroArquivado = false;\n' +
    '    entrada.omieErroArquivadoEm = null;\n' +
    '    entrada.omieErroArquivadoMotivo = "";\n' +
    '  }\n' +
    '\n' +
    '  if (atual.codigoLancamentoOmie && !skipOmieOutbox) {\n' +
    '    const protegidos = ["valor", "projetoId", "projetoItemId", "omieContaCorrenteId"];\n' +
    '    const alterado = protegidos.find(\n' +
    '      (campo) => Object.prototype.hasOwnProperty.call(entrada, campo)\n' +
    '        && String(entrada[campo]) !== String(atual[campo]),\n' +
    '    );\n' +
    '    if (alterado) {\n' +
    '      throw new GenericError(\n' +
    '        "O título já foi enviado ao Omie. Cancele ou estorne antes de alterar dados financeiros.",\n' +
    '        { statusCode: 409 },\n' +
    '      );\n' +
    '    }\n' +
    '  }\n' +
    '\n' +
    '  if (!atual.codigoLancamentoIntegracao) {\n' +
    '    entrada.codigoLancamentoIntegracao = codigoPagamentoIntegracao(id);\n' +
    '  }\n' +
    '  if (Object.prototype.hasOwnProperty.call(entrada, "valor") && !atual.codigoLancamentoOmie) {\n' +
    '    entrada.omieValorTitulo = Number(entrada.valor || 0);\n' +
    '    entrada.omieValorPendente = Number(entrada.valor || 0);\n' +
    '  }\n' +
    '\n' +
    '  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;\n' +
    '  const atualizado = await updateOriginal(id, payload, {\n' +
    '    ...mongoOptions,\n' +
    '    new: true,\n' +
    '  });\n' +
    '  if (!skipOmieOutbox) await agendarContaPagar(atualizado);\n' +
    '  return atualizado;\n' +
    '};\n' +
    '\n' +
    'Model.insertMany = async function inserirPagamentos(registros = [], opcoes = {}) {\n' +
    '  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n' +
    '  const criados = await insertManyOriginal(\n' +
    '    registros.map(prepararCriacao),\n' +
    '    mongoOptions,\n' +
    '  );\n' +
    '  if (!skip'... 239 more characters
  
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/formas-pagamento.test.js:32:10)
      at Test.runInAsyncScope (node:async_hooks:206:9)
      at Test.run (node:internal/test_runner/test:796:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:526:18)
      at Test.postRun (node:internal/test_runner/test:889:19)
      at Test.run (node:internal/test_runner/test:835:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:526:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: '"use strict";\n\nconst { defineModel, fields, GenericError } = require("@oondemand/oon-core-back");\nconst { enfileirarIntegracao } = require("./IntegrationOutbox");\nconst { codigoPagamentoIntegracao } = require("../services/omieUtils");\n\nconst ETAPA_ENVIO_AUTOMATICO = "Enviado para Omie";\nconst ETAPA_PAGAMENTO_OK = "Pagamento Ok";\nconst ETAPAS_AUTOMATICAS = new Set([\n  ETAPA_ENVIO_AUTOMATICO,\n  ETAPA_PAGAMENTO_OK,\n]);\n\nfunction etapaAutomatica(etapa) {\n  return ETAPAS_AUTOMATICAS.has(String(etapa || ""));\n}\n\nconst entry = defineModel({\n  name: "Pagamento",\n  singular: "pagamento",\n  basePath: "/pagamentos",\n  schema: {\n    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),\n    projetoItemId: fields.ref("ProjetoItem", {\n      required: true,\n      label: "Item do Projeto",\n    }),\n    dataPrevisaoPagamento: fields.date({\n      required: true,\n      label: "Data previsão pagamento",\n    }),\n    omieContaCorrenteId: fields.ref("OmieContaCorrente", {\n      label: "Conta corrente Omie",\n    }),\n    valor: fields.currency({ required: true, label: "Valor" }),\n    responsavelPagamentoId: fields.ref("Responsavel", {\n      required: true,\n      label: "Responsável Pagamento",\n    }),\n    nfRecebida: fields.boolean({ label: "NF Recebida", default: false }),\n    etapa: fields.enum(\n      ["Solicitado", "Aprovado", "Aguardando NF", ETAPA_ENVIO_AUTOMATICO, ETAPA_PAGAMENTO_OK],\n      { required: true, label: "Etapa", default: "Solicitado" },\n    ),\n    statusTrabalho: fields.enum(\n      ["Aguardando início", "Trabalhando", "Revisar"],\n      {\n        required: true,\n        label: "Status de trabalho",\n        default: "Aguardando início",\n      },\n    ),\n    codigoLancamentoIntegracao: fields.string({\n      label: "Código de integração Omie",\n      searchable: true,\n    }),\n    codigoLancamentoOmie: {\n      type: Number,\n      __meta: {\n        kind: "number",\n        label: "Lançamento Omie",\n        readonly: true,\n        readOnly: true,\n      },\n    },\n    omieCodigoCategoriaEnviado: fields.string({\n      label: "Categoria enviada ao Omie",\n    }),\n    omieCodigoClienteFornecedorEnviado: {\n      type: Number,\n      __meta: {\n        kind: "number",\n        label: "Fornecedor enviado ao Omie",\n        readonly: true,\n        readOnly: true,\n      },\n    },\n    omieContaCorrenteEnviada: {\n      type: Number,\n      __meta: {\n        kind: "number",\n        label: "Conta corrente enviada ao Omie",\n        readonly: true,\n        readOnly: true,\n      },\n    },\n    omieNumeroDocumentoEnviado: fields.string({\n      label: "Documento enviado ao Omie",\n    }),\n    omieValorTitulo: fields.currency({ label: "Valor do título Omie" }),\n    omieValorPago: fields.currency({ label: "Valor pago no Omie" }),\n    omieValorPendente: fields.currency({ label: "Valor pendente no Omie" }),\n    omieDataUltimaBaixa: fields.date({ label: "Última baixa no Omie" }),\n    omieLiquidado: fields.boolean({\n      label: "Liquidado no Omie",\n      default: false,\n    }),\n    omieStatusIntegracao: fields.enum(\n      ["Não enviado", "Pendente", "Processando", "Enviado", "Erro", "Cancelado"],\n      {\n        label: "Status integração Omie",\n        default: "Não enviado",\n      },\n    ),\n    omieUltimoErro: fields.string({\n      label: "Último erro Omie",\n      searchable: true,\n    }),\n    omieErroArquivado: fields.boolean({\n      label: "Erro Omie arquivado",\n      default: false,\n    }),\n    omieErroArquivadoEm: fields.date({ label: "Erro Omie arquivado em" }),\n    omieErroArquivadoMotivo: fields.string({\n      label: "Motivo do arquivamento do erro Omie",\n    }),\n    omieUltimaSincronizacaoEm: fields.date({\n      label: "Última sincronização Omie",\n    }),\n    omiePayloadHash: fields.string({ label: "Hash enviado ao Omie" }),\n    canceladoNaCentral: fields.boolean({\n      label: "Cancelado na Central",\n      default: false,\n    }),\n  },\n  crud: {\n    enabled: true,\n    roles: { write: ["admin", "desenvolvedor"] },\n    populateRefs: true,\n  },\n});\n\nconst Model = entry.mongooseModel;\nModel.schema.index({ codigoLancamentoIntegracao: 1 }, { unique: true, sparse: true });\nModel.schema.index({ codigoLancamentoOmie: 1 }, { unique: true, sparse: true });\n\nconst createOriginal = Model.create.bind(Model);\nconst updateOriginal = Model.findByIdAndUpdate.bind(Model);\nconst insertManyOriginal = Model.insertMany.bind(Model);\n\nfunction prepararCriacao(dados = {}) {\n  const etapa = dados.etapa || "Solicitado";\n  const envioAutomatico = etapa === ETAPA_ENVIO_AUTOMATICO;\n  return {\n    ...dados,\n    etapa,\n    statusTrabalho: etapaAutomatica(etapa)\n      ? "Trabalhando"\n      : dados.statusTrabalho || "Aguardando início",\n    codigoLancamentoIntegracao: dados.codigoLancamentoIntegracao\n      || (dados._id ? codigoPagamentoIntegracao(dados._id) : undefined),\n    omieValorTitulo: Number(dados.valor || 0),\n    omieValorPago: 0,\n    omieValorPendente: Number(dados.valor || 0),\n    omieStatusIntegracao: envioAutomatico\n      ? "Pendente"\n      : dados.omieStatusIntegracao || "Não enviado",\n    omieUltimoErro: envioAutomatico ? "" : dados.omieUltimoErro || "",\n    omieErroArquivado: false,\n    omieErroArquivadoEm: null,\n    omieErroArquivadoMotivo: "",\n  };\n}\n\nasync function agendarContaPagar(pagamento) {\n  if (\n    !pagamento?._id\n    || pagamento.etapa !== ETAPA_ENVIO_AUTOMATICO\n    || pagamento.codigoLancamentoOmie\n  ) {\n    return;\n  }\n\n  const codigo = pagamento.codigoLancamentoIntegracao\n    || codigoPagamentoIntegracao(pagamento._id);\n  await Model.updateOne(\n    { _id: pagamento._id },\n    {\n      $set: {\n        codigoLancamentoIntegracao: codigo,\n        statusTrabalho: "Trabalhando",\n        omieStatusIntegracao: "Pendente",\n        omieUltimoErro: "",\n        omieErroArquivado: false,\n        omieErroArquivadoEm: null,\n        omieErroArquivadoMotivo: "",\n      },\n    },\n  );\n\n  await enfileirarIntegracao({\n    provider: "omie",\n    handler: "OMIE_CONTA_PAGAR_UPSERT",\n    tipo: "OMIE_CONTA_PAGAR_UPSERT",\n    resource: "contas-pagar",\n    operation: "upsert",\n    aggregateType: "Pagamento",\n    aggregateId: pagamento._id,\n    idempotencyKey: `omie:conta-pagar:${pagamento._id}`,\n    payload: { pagamentoId: String(pagamento._id) },\n  });\n}\n\nModel.create = async function criarPagamento(dados, opcoes = {}) {\n  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n  if (Array.isArray(dados)) {\n    const criados = await createOriginal(dados.map(prepararCriacao), mongoOptions);\n    if (!skipOmieOutbox) {\n      for (const criado of criados) await agendarContaPagar(criado);\n    }\n    return criados;\n  }\n\n  const [criado] = await createOriginal([prepararCriacao(dados)], mongoOptions);\n  if (!skipOmieOutbox) await agendarContaPagar(criado);\n  return criado;\n};\n\nModel.findByIdAndUpdate = async function atualizarPagamento(\n  id,\n  alteracoes = {},\n  opcoes = {},\n) {\n  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n  const atual = await Model.findById(id).lean();\n  if (!atual) return null;\n\n  const usaSet = Boolean(alteracoes?.$set);\n  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };\n  const conciliarAgora = entrada._conciliarOmie === true\n    || entrada._conciliarOmie === "true";\n  delete entrada._conciliarOmie;\n\n  if (conciliarAgora) {\n    if (atual.etapa !== ETAPA_ENVIO_AUTOMATICO) {\n      throw new GenericError(\n        "A conciliação manual somente está disponível em Enviado para Omie.",\n        { statusCode: 409 },\n      );\n    }\n    const {\n      conciliarPagamentoAutomatico,\n    } = require("../services/omiePagamentoAutomatico");\n    await conciliarPagamentoAutomatico(id);\n    return Model.findById(id);\n  }\n\n  if (etapaAutomatica(atual.etapa) && !skipOmieOutbox) {\n    throw new GenericError(\n      "Esta é uma etapa automática. Os campos e as ações do pagamento ficam bloqueados.",\n      { statusCode: 409 },\n    );\n  }\n\n  if (entrada.etapa === ETAPA_PAGAMENTO_OK && !skipOmieOutbox) {\n    throw new GenericError(\n      "A etapa Pagamento Ok somente pode ser definida pela conciliação com o Omie.",\n      { statusCode: 409 },\n    );\n  }\n\n  if (\n    entrada.etapa === ETAPA_ENVIO_AUTOMATICO\n    && atual.etapa !== ETAPA_ENVIO_AUTOMATICO\n  ) {\n    if (atual.etapa !== "Aguardando NF") {\n      throw new GenericError(\n        "O pagamento somente pode entrar em Enviado para Omie após Aguardando NF.",\n        { statusCode: 409 },\n      );\n    }\n    entrada.statusTrabalho = "Trabalhando";\n    entrada.omieStatusIntegracao = "Pendente";\n    entrada.omieUltimoErro = "";\n    entrada.omieErroArquivado = false;\n    entrada.omieErroArquivadoEm = null;\n    entrada.omieErroArquivadoMotivo = "";\n  }\n\n  if (atual.codigoLancamentoOmie && !skipOmieOutbox) {\n    const protegidos = ["valor", "projetoId", "projetoItemId", "omieContaCorrenteId"];\n    const alterado = protegidos.find(\n      (campo) => Object.prototype.hasOwnProperty.call(entrada, campo)\n        && String(entrada[campo]) !== String(atual[campo]),\n    );\n    if (alterado) {\n      throw new GenericError(\n        "O título já foi enviado ao Omie. Cancele ou estorne antes de alterar dados financeiros.",\n        { statusCode: 409 },\n      );\n    }\n  }\n\n  if (!atual.codigoLancamentoIntegracao) {\n    entrada.codigoLancamentoIntegracao = codigoPagamentoIntegracao(id);\n  }\n  if (Object.prototype.hasOwnProperty.call(entrada, "valor") && !atual.codigoLancamentoOmie) {\n    entrada.omieValorTitulo = Number(entrada.valor || 0);\n    entrada.omieValorPendente = Number(entrada.valor || 0);\n  }\n\n  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;\n  const atualizado = await updateOriginal(id, payload, {\n    ...mongoOptions,\n    new: true,\n  });\n  if (!skipOmieOutbox) await agendarContaPagar(atualizado);\n  return atualizado;\n};\n\nModel.insertMany = async function inserirPagamentos(registros = [], opcoes = {}) {\n  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n  const criados = await insertManyOriginal(\n    registros.map(prepararCriacao),\n    mongoOptions,\n  );\n  if (!skip'... 239 more characters,
    expected: /formaPagamentoId:\s*fields\.ref\("FormaPagamento"/,
    operator: 'match'
  }

✖ frontend adiciona Configurações e usa selector nas entradas de pagamento (2.477841ms)
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/runner/work/ss-eventos/ss-eventos/frontend/src/paymentMethodsAdjustments.js' imported from /home/runner/work/ss-eventos/ss-eventos/backend/test/formas-pagamento.test.js
      at finalizeResolution (node:internal/modules/esm/resolve:283:11)
      at moduleResolve (node:internal/modules/esm/resolve:952:10)
      at defaultResolve (node:internal/modules/esm/resolve:1188:11)
      at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)
      at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
      at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
      at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
      at ModuleLoader.import (node:internal/modules/esm/loader:605:34)
      at defaultImportModuleDynamicallyForScript (node:internal/modules/esm/utils:234:31)
      at importModuleDynamicallyCallback (node:internal/modules/esm/utils:256:12) {
    code: 'ERR_MODULE_NOT_FOUND',
    url: 'file:///home/runner/work/ss-eventos/ss-eventos/frontend/src/paymentMethodsAdjustments.js'
  }

✔ componente genérico registra provedores e resolve handlers (1.987624ms)
✔ adaptador Omie expõe somente o contrato atual (0.30613ms)
✔ categoria define categoria Omie e pagamento define conta corrente (0.608072ms)
✔ configuração Omie contém apenas credenciais e conectividade (0.546028ms)
✔ pagamento não expõe rotas ou ações manuais de envio (0.624221ms)
✖ sincronização continua após erro individual e guarda rastreabilidade (5.054275ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /request: \{ call, param:/. Input:
  
  '"use strict";\n' +
    '\n' +
    'const { sanitizarErro } = require("./omieUtils");\n' +
    '\n' +
    'const ENDPOINTS = Object.freeze({\n' +
    '  clientes: "https://app.omie.com.br/api/v1/geral/clientes/",\n' +
    '  categorias: "https://app.omie.com.br/api/v1/geral/categorias/",\n' +
    '  contasCorrentes: "https://app.omie.com.br/api/v1/geral/contacorrente/",\n' +
    '  contasPagar: "https://app.omie.com.br/api/v1/financas/contapagar/",\n' +
    '});\n' +
    '\n' +
    'class OmieApiError extends Error {\n' +
    '  constructor(message, opcoes = {}) {\n' +
    '    super(message);\n' +
    '    this.name = "OmieApiError";\n' +
    '    this.statusCode = opcoes.statusCode;\n' +
    '    this.code = opcoes.code;\n' +
    '    this.retryable = Boolean(opcoes.retryable);\n' +
    '    this.response = opcoes.response;\n' +
    '    this.trace = opcoes.trace;\n' +
    '    this.traces = opcoes.traces;\n' +
    '  }\n' +
    '}\n' +
    '\n' +
    'function numeroEnv(nome, padrao) {\n' +
    '  const valor = Number(process.env[nome]);\n' +
    '  return Number.isFinite(valor) && valor > 0 ? valor : padrao;\n' +
    '}\n' +
    '\n' +
    'function dormir(ms) {\n' +
    '  return new Promise((resolve) => setTimeout(resolve, ms));\n' +
    '}\n' +
    '\n' +
    'function deveRepetir(statusCode, erro) {\n' +
    '  return [408, 425, 429, 500, 502, 503, 504].includes(statusCode)\n' +
    '    || erro?.name === "AbortError"\n' +
    '    || ["ECONNRESET", "ETIMEDOUT"].includes(erro?.code);\n' +
    '}\n' +
    '\n' +
    'function sanitizarValor(valor, nivel = 0) {\n' +
    '  if (valor == null || typeof valor === "number" || typeof valor === "boolean") return valor;\n' +
    '  if (typeof valor === "string") return valor.length > 2000 ? `${valor.slice(0, 2000)}…` : valor;\n' +
    '  if (nivel >= 5) return "[profundidade limitada]";\n' +
    '  if (Array.isArray(valor)) {\n' +
    '    return {\n' +
    '      total: valor.length,\n' +
    '      amostra: valor.slice(0, 10).map((item) => sanitizarValor(item, nivel + 1)),\n' +
    '      limitada: valor.length > 10,\n' +
    '    };\n' +
    '  }\n' +
    '  if (typeof valor === "object") {\n' +
    '    const segredo = /app[_-]?key|app[_-]?secret|authorization|token|senha|password/i;\n' +
    '    return Object.fromEntries(\n' +
    '      Object.entries(valor)\n' +
    '        .filter(([chave]) => !segredo.test(chave))\n' +
    '        .slice(0, 40)\n' +
    '        .map(([chave, item]) => [chave, sanitizarValor(item, nivel + 1)]),\n' +
    '    );\n' +
    '  }\n' +
    '  return String(valor);\n' +
    '}\n' +
    '\n' +
    'function normalizarErroResposta(body, statusCode) {\n' +
    '  const code = body?.faultcode ?? body?.code ?? body?.codigo_status;\n' +
    '  const description = body?.faultstring ?? body?.description ?? body?.descricao_status;\n' +
    '  if (!description && statusCode >= 200 && statusCode < 300) return null;\n' +
    '  const sucesso = String(code ?? "0") === "0";\n' +
    '  if (statusCode >= 200 && statusCode < 300 && sucesso && !body?.faultstring) return null;\n' +
    '  return new OmieApiError(description || `Omie retornou HTTP ${statusCode}.`, {\n' +
    '    statusCode,\n' +
    '    code,\n' +
    '    retryable: deveRepetir(statusCode),\n' +
    '    response: body,\n' +
    '  });\n' +
    '}\n' +
    '\n' +
    'function normalizarCall(endpoint, call) {\n' +
    '  // Cliente/Prestador já existe no Omie e deve ser alterado explicitamente.\n' +
    '  // A proteção no transporte impede que um fluxo residual execute UpsertCliente.\n' +
    '  if (endpoint === "clientes" && call === "UpsertCliente") return "AlterarCliente";\n' +
    '  return call;\n' +
    '}\n' +
    '\n' +
    'function criarOmieClient(opcoes = {}) {\n' +
    '  const appKey = opcoes.appKey || process.env.OMIE_APP_KEY;\n' +
    '  const appSecret = opcoes.appSecret || process.env.OMIE_APP_SECRET;\n' +
    '  const timeoutMs = opcoes.timeoutMs || numeroEnv("OMIE_TIMEOUT_MS", 30000);\n' +
    '  const maxTentativas = opcoes.maxTentativas || numeroEnv("OMIE_HTTP_ATTEMPTS", 3);\n' +
    '  const maxTraces = numeroEnv("OMIE_TRACE_LIMIT", 100);\n' +
    '  const fetchImpl = opcoes.fetchImpl || globalThis.fetch;\n' +
    '  const traces = [];\n' +
    '\n' +
    '  if (!appKey || !appSecret) {\n' +
    '    throw new OmieApiError("Configure OMIE_APP_KEY e OMIE_APP_SECRET.");\n' +
    '  }\n' +
    '  if (typeof fetchImpl !== "function") {\n' +
    '    throw new OmieApiError("O runtime não oferece fetch para chamar a API Omie.");\n' +
    '  }\n' +
    '\n' +
    '  function registrarTrace(trace) {\n' +
    '    if (traces.length < maxTraces) traces.push(trace);\n' +
    '    if (typeof opcoes.onTrace === "function") opcoes.onTrace(trace);\n' +
    '  }\n' +
    '\n' +
    '  async function chamar(endpoint, call, param = [{}]) {\n' +
    '    const url = ENDPOINTS[endpoint] || endpoint;\n' +
    '    const callEfetivo = normalizarCall(endpoint, call);\n' +
    '    const parametros = Array.isArray(param) ? param : [param];\n' +
    '    const envelope = {\n' +
    '      app_key: appKey,\n' +
    '      app_secret: appSecret,\n' +
    '      call: callEfetivo,\n' +
    '      param: parametros,\n' +
    '    };\n' +
    '    let ultimoErro;\n' +
    '\n' +
    '    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {\n' +
    '      const iniciouEm = new Date();\n' +
    '      const trace = {\n' +
    '        endpoint,\n' +
    '        url,\n' +
    '        call: callEfetivo,\n' +
    '        tentativa,\n' +
    '        iniciouEm,\n' +
    '        request: { call: callEfetivo, param: sanitizarValor(parametros) },\n' +
    '      };\n' +
    '      const controller = new AbortController();\n' +
    '      const timer = setTimeout(() => controller.abort(), timeoutMs);\n' +
    '\n' +
    '      try {\n' +
    '        const resposta = await fetchImpl(url, {\n' +
    '          method: "POST",\n' +
    '          headers: { "content-type": "application/json", accept: "application/json" },\n' +
    '          body: JSON.stringify(envelope),\n' +
    '          signal: controller.signal,\n' +
    '        });\n' +
    '        trace.httpStatus = resposta.status;\n' +
    '        const texto = await resposta.text();\n' +
    '        let body;\n' +
    '        try {\n' +
    '          body = texto ? JSON.parse(texto) : {};\n' +
    '        } catch {\n' +
    '          trace.response = { texto: sanitizarValor(texto) };\n' +
    '          throw new OmieApiError("Resposta inválida da API Omie.", {\n' +
    '            statusCode: resposta.status,\n' +
    '            retryable: resposta.status >= 500,\n' +
    '          });\n' +
    '        }\n' +
    '        trace.response = sanitizarValor(body);\n' +
    '        const erroResposta = normalizarErroResposta(body, resposta.status);\n' +
    '        if (erroResposta) throw erroResposta;\n' +
    '        trace.status = "Sucesso";\n' +
    '        trace.concluiuEm = new Date();\n' +
    '        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();\n' +
    '        registrarTrace(trace);\n' +
    '        return body;\n' +
    '      } catch (erro) {\n' +
    '        trace.status = "Erro";\n' +
    '        trace.erro = sanitizarErro(erro);\n' +
    '        trace.response = trace.response || sanitizarValor(erro?.response || {});\n' +
    '        trace.concluiuEm = new Date();\n' +
    '        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();\n' +
    '        registrarTrace(trace);\n' +
    '\n' +
    '        const retryable = erro instanceof OmieApiError\n' +
    '          ? erro.retryable\n' +
    '          : deveRepetir(erro?.statusCode, erro);\n' +
    '        ultimoErro = erro instanceof OmieApiError\n' +
    '          ? erro\n' +
    '          : new OmieApiError(sanitizarErro(erro), { retryable, code: erro?.code });\n' +
    '        ultimoErro.trace = trace;\n' +
    '        ultimoErro.traces = [...traces];\n' +
    '        if (!retryable || tentativa >= maxTentativas) throw ultimoErro;\n' +
    '        await dormir(\n' +
    '          Math.min(5000, 500 * (2 ** (tentativa - 1))) + Math.floor(Math.random() * 250),\n' +
    '        );\n' +
    '      } finally {\n' +
    '        clearTimeout(timer);\n' +
    '      }\n' +
    '    }\n' +
    '    throw ultimoErro;\n' +
    '  }\n' +
    '\n' +
    '  async function paginar(endpoint, call, paramBase = {}, extrairItens) {\n' +
    '    const itens = [];\n' +
    '    let pagina = 1;\n' +
    '    let totalPaginas = 1;\n' +
    '    do {\n' +
    '      const resposta = await chamar(endpoint, call, [{\n' +
    '        ...paramBase,\n' +
    '        pagina,\n' +
    '        registros_por_pagina: Math.min(\n' +
    '          100,\n' +
    '          Number(paramBase.registros_por_pagina || 100),\n' +
    '        ),\n' +
    '      }]);\n' +
    '      itens.push(...(extrairItens(resposta) || []));\n' +
    '      totalPaginas = Number(resposta.total_de_paginas || resposta.totalDePaginas || 1);\n' +
    '      pagina += 1;\n' +
    '    } while (pagina <= totalPaginas);\n' +
    '    return itens;\n' +
    '  }\n' +
    '\n' +
    '  return {\n' +
    '    chamar,\n' +
    '    paginar,\n' +
    '    endpoints: ENDPOINTS,\n' +
    '    getTraces: () => [...traces],\n' +
    '  };\n' +
    '}\n' +
    '\n' +
    'module.exports = {\n' +
    '  ENDPOINTS,\n' +
    '  OmieApiError,\n' +
    '  criarOmieClient,\n' +
    '  normalizarCall,\n' +
    '  normalizarErroResposta,\n' +
    '  sanitizarValor,\n' +
    '};\n'
  
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/integration-architecture.test.js:90:10)
      at Test.runInAsyncScope (node:async_hooks:206:9)
      at Test.run (node:internal/test_runner/test:796:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:526:18)
      at Test.postRun (node:internal/test_runner/test:889:19)
      at Test.run (node:internal/test_runner/test:835:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:526:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: '"use strict";\n\nconst { sanitizarErro } = require("./omieUtils");\n\nconst ENDPOINTS = Object.freeze({\n  clientes: "https://app.omie.com.br/api/v1/geral/clientes/",\n  categorias: "https://app.omie.com.br/api/v1/geral/categorias/",\n  contasCorrentes: "https://app.omie.com.br/api/v1/geral/contacorrente/",\n  contasPagar: "https://app.omie.com.br/api/v1/financas/contapagar/",\n});\n\nclass OmieApiError extends Error {\n  constructor(message, opcoes = {}) {\n    super(message);\n    this.name = "OmieApiError";\n    this.statusCode = opcoes.statusCode;\n    this.code = opcoes.code;\n    this.retryable = Boolean(opcoes.retryable);\n    this.response = opcoes.response;\n    this.trace = opcoes.trace;\n    this.traces = opcoes.traces;\n  }\n}\n\nfunction numeroEnv(nome, padrao) {\n  const valor = Number(process.env[nome]);\n  return Number.isFinite(valor) && valor > 0 ? valor : padrao;\n}\n\nfunction dormir(ms) {\n  return new Promise((resolve) => setTimeout(resolve, ms));\n}\n\nfunction deveRepetir(statusCode, erro) {\n  return [408, 425, 429, 500, 502, 503, 504].includes(statusCode)\n    || erro?.name === "AbortError"\n    || ["ECONNRESET", "ETIMEDOUT"].includes(erro?.code);\n}\n\nfunction sanitizarValor(valor, nivel = 0) {\n  if (valor == null || typeof valor === "number" || typeof valor === "boolean") return valor;\n  if (typeof valor === "string") return valor.length > 2000 ? `${valor.slice(0, 2000)}…` : valor;\n  if (nivel >= 5) return "[profundidade limitada]";\n  if (Array.isArray(valor)) {\n    return {\n      total: valor.length,\n      amostra: valor.slice(0, 10).map((item) => sanitizarValor(item, nivel + 1)),\n      limitada: valor.length > 10,\n    };\n  }\n  if (typeof valor === "object") {\n    const segredo = /app[_-]?key|app[_-]?secret|authorization|token|senha|password/i;\n    return Object.fromEntries(\n      Object.entries(valor)\n        .filter(([chave]) => !segredo.test(chave))\n        .slice(0, 40)\n        .map(([chave, item]) => [chave, sanitizarValor(item, nivel + 1)]),\n    );\n  }\n  return String(valor);\n}\n\nfunction normalizarErroResposta(body, statusCode) {\n  const code = body?.faultcode ?? body?.code ?? body?.codigo_status;\n  const description = body?.faultstring ?? body?.description ?? body?.descricao_status;\n  if (!description && statusCode >= 200 && statusCode < 300) return null;\n  const sucesso = String(code ?? "0") === "0";\n  if (statusCode >= 200 && statusCode < 300 && sucesso && !body?.faultstring) return null;\n  return new OmieApiError(description || `Omie retornou HTTP ${statusCode}.`, {\n    statusCode,\n    code,\n    retryable: deveRepetir(statusCode),\n    response: body,\n  });\n}\n\nfunction normalizarCall(endpoint, call) {\n  // Cliente/Prestador já existe no Omie e deve ser alterado explicitamente.\n  // A proteção no transporte impede que um fluxo residual execute UpsertCliente.\n  if (endpoint === "clientes" && call === "UpsertCliente") return "AlterarCliente";\n  return call;\n}\n\nfunction criarOmieClient(opcoes = {}) {\n  const appKey = opcoes.appKey || process.env.OMIE_APP_KEY;\n  const appSecret = opcoes.appSecret || process.env.OMIE_APP_SECRET;\n  const timeoutMs = opcoes.timeoutMs || numeroEnv("OMIE_TIMEOUT_MS", 30000);\n  const maxTentativas = opcoes.maxTentativas || numeroEnv("OMIE_HTTP_ATTEMPTS", 3);\n  const maxTraces = numeroEnv("OMIE_TRACE_LIMIT", 100);\n  const fetchImpl = opcoes.fetchImpl || globalThis.fetch;\n  const traces = [];\n\n  if (!appKey || !appSecret) {\n    throw new OmieApiError("Configure OMIE_APP_KEY e OMIE_APP_SECRET.");\n  }\n  if (typeof fetchImpl !== "function") {\n    throw new OmieApiError("O runtime não oferece fetch para chamar a API Omie.");\n  }\n\n  function registrarTrace(trace) {\n    if (traces.length < maxTraces) traces.push(trace);\n    if (typeof opcoes.onTrace === "function") opcoes.onTrace(trace);\n  }\n\n  async function chamar(endpoint, call, param = [{}]) {\n    const url = ENDPOINTS[endpoint] || endpoint;\n    const callEfetivo = normalizarCall(endpoint, call);\n    const parametros = Array.isArray(param) ? param : [param];\n    const envelope = {\n      app_key: appKey,\n      app_secret: appSecret,\n      call: callEfetivo,\n      param: parametros,\n    };\n    let ultimoErro;\n\n    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {\n      const iniciouEm = new Date();\n      const trace = {\n        endpoint,\n        url,\n        call: callEfetivo,\n        tentativa,\n        iniciouEm,\n        request: { call: callEfetivo, param: sanitizarValor(parametros) },\n      };\n      const controller = new AbortController();\n      const timer = setTimeout(() => controller.abort(), timeoutMs);\n\n      try {\n        const resposta = await fetchImpl(url, {\n          method: "POST",\n          headers: { "content-type": "application/json", accept: "application/json" },\n          body: JSON.stringify(envelope),\n          signal: controller.signal,\n        });\n        trace.httpStatus = resposta.status;\n        const texto = await resposta.text();\n        let body;\n        try {\n          body = texto ? JSON.parse(texto) : {};\n        } catch {\n          trace.response = { texto: sanitizarValor(texto) };\n          throw new OmieApiError("Resposta inválida da API Omie.", {\n            statusCode: resposta.status,\n            retryable: resposta.status >= 500,\n          });\n        }\n        trace.response = sanitizarValor(body);\n        const erroResposta = normalizarErroResposta(body, resposta.status);\n        if (erroResposta) throw erroResposta;\n        trace.status = "Sucesso";\n        trace.concluiuEm = new Date();\n        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();\n        registrarTrace(trace);\n        return body;\n      } catch (erro) {\n        trace.status = "Erro";\n        trace.erro = sanitizarErro(erro);\n        trace.response = trace.response || sanitizarValor(erro?.response || {});\n        trace.concluiuEm = new Date();\n        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();\n        registrarTrace(trace);\n\n        const retryable = erro instanceof OmieApiError\n          ? erro.retryable\n          : deveRepetir(erro?.statusCode, erro);\n        ultimoErro = erro instanceof OmieApiError\n          ? erro\n          : new OmieApiError(sanitizarErro(erro), { retryable, code: erro?.code });\n        ultimoErro.trace = trace;\n        ultimoErro.traces = [...traces];\n        if (!retryable || tentativa >= maxTentativas) throw ultimoErro;\n        await dormir(\n          Math.min(5000, 500 * (2 ** (tentativa - 1))) + Math.floor(Math.random() * 250),\n        );\n      } finally {\n        clearTimeout(timer);\n      }\n    }\n    throw ultimoErro;\n  }\n\n  async function paginar(endpoint, call, paramBase = {}, extrairItens) {\n    const itens = [];\n    let pagina = 1;\n    let totalPaginas = 1;\n    do {\n      const resposta = await chamar(endpoint, call, [{\n        ...paramBase,\n        pagina,\n        registros_por_pagina: Math.min(\n          100,\n          Number(paramBase.registros_por_pagina || 100),\n        ),\n      }]);\n      itens.push(...(extrairItens(resposta) || []));\n      totalPaginas = Number(resposta.total_de_paginas || resposta.totalDePaginas || 1);\n      pagina += 1;\n    } while (pagina <= totalPaginas);\n    return itens;\n  }\n\n  return {\n    chamar,\n    paginar,\n    endpoints: ENDPOINTS,\n    getTraces: () => [...traces],\n  };\n}\n\nmodule.exports = {\n  ENDPOINTS,\n  OmieApiError,\n  criarOmieClient,\n  normalizarCall,\n  normalizarErroResposta,\n  sanitizarValor,\n};\n',
    expected: /request: \{ call, param:/,
    operator: 'match'
  }

✔ criação unitária não trata opções do Mongoose como segundo documento (0.414902ms)
✔ frontend mapeia categoria e seleciona conta no pagamento (0.707087ms)
✔ forma de pagamento e componentes legados foram removidos (0.71635ms)
✔ card prioriza Valor Orçado, Valor Contratado e Pagamento (1.466044ms)
✔ resumo informa Pago ou o saldo pendente em pt-BR (0.60011ms)
✔ alteração da contratação recalcula o valor pendente do card (0.630769ms)
API do IBGE indisponível; mantendo a lista interna existente. Motivo: serviço indisponível
✔ normaliza e valida a estrutura oficial de estados e municípios (41.937012ms)
✔ rejeita resposta incompleta da fonte de localidades (0.673953ms)
✔ mantém a lista interna quando o IBGE está indisponível e o cache é válido (2.561875ms)
✔ Estado, Cidade e Contato são removidos do menu automático (0.560835ms)
✔ prepara recursos operacionais de contatos, projetos e esteiras (17.47887ms)
✔ models de localidades restringem escrita ao perfil interno (0.667506ms)
✖ organiza o menu e direciona itens e pagamentos para as esteiras (11.718995ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected ... Lines skipped
  
    [
      {
  +     label: 'Clientes/Prestadores',
  -     label: 'Clientes Fornecedores',
        model: 'ClienteFornecedor',
        section: 'Cadastros'
  ...
      },
      {
  +     label: 'Categorias/Subcategorias',
  -     label: 'Categorias/SubCategorias',
        model: 'Categoria',
  ...
        section: 'Configurações'
      }
    ]
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/navigation-menu.test.js:32:10)
      at async Test.run (node:internal/test_runner/test:797:9)
      at async Test.processPendingSubtests (node:internal/test_runner/test:526:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ { model: 'ClienteFornecedor', label: 'Clientes/Prestadores', section: 'Cadastros' }, { model: 'Projeto', label: 'Projetos', section: 'Operação' }, { model: 'Categoria', label: 'Categorias/Subcategorias', section: 'Configurações' }, { model: 'Responsavel', label: 'Responsáveis', section: 'Configurações' } ],
    expected: [ { model: 'ClienteFornecedor', label: 'Clientes Fornecedores', section: 'Cadastros' }, { model: 'Projeto', label: 'Projetos', section: 'Operação' }, { model: 'Categoria', label: 'Categorias/SubCategorias', section: 'Configurações' }, { model: 'Responsavel', label: 'Responsáveis', section: 'Configurações' } ],
    operator: 'deepStrictEqual'
  }

✔ ordena as views por Cadastros, Operação, Financeiro e Configurações (1.049676ms)
✔ o bootstrap converte o manifesto, ordena as views e inicia o OonCore (0.253799ms)
✔ cliente Omie envia credenciais, mas o diagnóstico não as persiste (3.826696ms)
✔ sanitização remove segredos em objetos aninhados (0.899727ms)
✔ mensagens de erro não mantêm segredos em texto ou JSON (1.910331ms)
✔ erro funcional registra endpoint request response e status (1.315571ms)
✔ erro funcional em HTTP 200 é tratado como OmieApiError (0.238598ms)
✔ normaliza qualquer chamada residual de UpsertCliente para AlterarCliente (1.621552ms)
✔ envia AlterarCliente e registra a mesma operação no diagnóstico (2.305149ms)
✔ integração usa outbox, inbox e chaves determinísticas (1.530201ms)
✔ credenciais são criptografadas e não aparecem no diagnóstico (0.792848ms)
✔ categorias e contas correntes são listas Omie somente leitura (0.428716ms)
✔ alterações locais usam AlterarCliente e nunca UpsertCliente no Omie (1.582424ms)
✔ categoria define categoria Omie e pagamento define conta corrente (0.588083ms)
✔ reconciliação interpreta saldo e retorna pelo próprio ticket (0.367576ms)
✔ Clientes e Prestadores usam ListarClientes sem loop outbound (0.452439ms)
✔ não existem arquivos ou rotas de compatibilidade (0.54406ms)
✔ frontend usa Integrações, abas, modais, fila e eventos (0.826195ms)
✔ mapeia cliente/fornecedor com código estável, tags e documento (2.013696ms)
✔ mapeia nome obrigatório do cliente Omie e registra o campo de origem (0.886844ms)
✔ usa fallback não vazio quando o Omie não informa nenhum campo de nome (1.229596ms)
✔ mapeia categoria e conta corrente do Omie (0.390773ms)
✔ gera conta a pagar idempotente e interpreta valor_pag como saldo pendente (0.82976ms)
✔ reconhece pagamento confirmado pelos status oficiais do Omie (0.310038ms)
✔ integração usa outbox, inbox e chaves determinísticas (2.123061ms)
✔ credenciais são criptografadas e não aparecem no diagnóstico (0.80144ms)
✔ categorias e contas correntes são listas Omie somente leitura (0.444662ms)
✔ categoria define categoria Omie e pagamento define conta corrente (1.642451ms)
✔ Clientes e Prestadores processam todos os registros e detalham erros (0.759343ms)
✔ pagamento usa exclusivamente as etapas automáticas (0.529213ms)
✔ não existem arquivos ou rotas de compatibilidade (0.600966ms)
✔ frontend usa Integrações, abas, modais e diagnóstico (0.757458ms)
✔ calcula o valor pendente descontando pagamentos já gerados (1.718772ms)
✔ não retorna saldo negativo quando pagamentos atingem o total (0.168905ms)
✔ aceita pagamento parcial e arredonda para duas casas (0.203145ms)
✔ rejeita geração sem contratação (0.412238ms)
✔ rejeita valor zero e valor acima do saldo (0.234147ms)
✔ ticket de item usa modal declarativo com abas (1.781193ms)
✔ ticket preserva filtros dependentes e relação de pagamentos (0.426518ms)
✔ campos calculados aparecem apenas no resumo (0.262592ms)
✔ menu principal mantém Cadastros, Operação e Financeiro (2.19011ms)
✔ home de configurações concentra cadastros auxiliares, integrações e auditoria (0.636745ms)
✔ botão Configurações fica no cabeçalho e recursos técnicos saem do menu lateral (0.372513ms)
✔ salva somente os campos da aba Orçamento (4.73458ms)
✔ salva somente os campos da aba Fechamento (1.063082ms)
✔ novo projeto abre em dados e registros existentes preservam resumo (14.446486ms)
✔ pagamentos do item ficam somente leitura na colecao e na esteira (0.874598ms)
✔ organiza as abas e regras financeiras do item (15.347012ms)
✔ calcula os totais no formulário e identifica lucro ou prejuízo (3.142353ms)
✔ o pagamento usa o total contratado como saldo (0.464468ms)
ℹ tests 93
ℹ suites 0
ℹ pass 87
ℹ fail 6
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 775.906634

✖ failing tests:

test at test/acoes-validacao-subcategoria.test.js:59:1
✖ validação permite que o model limpe vínculo incompatível (3.719845ms)
  AssertionError [ERR_ASSERTION]: The input was expected to not match the regular expression /A subcategoria selecionada não pertence à categoria informada/. Input:
  
  '"use strict";\n' +
    '\n' +
    'const { defineValidation, registry, GenericError } = require("@oondemand/oon-core-back");\n' +
    'const {\n' +
    '  dadosConsolidados,\n' +
    '  dadosComDependenciaOpcional,\n' +
    '  subcategoriaPertenceACategoria,\n' +
    '} = require("../services/dadosValidacao");\n' +
    '\n' +
    'function model(nome) {\n' +
    '  const Model = registry.getModel(nome)?.mongooseModel;\n' +
    '  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);\n' +
    '  return Model;\n' +
    '}\n' +
    '\n' +
    'function erroCampo(field, message) {\n' +
    '  throw new GenericError(message, { details: { field, message } });\n' +
    '}\n' +
    '\n' +
    'async function registroAtivo(nome, id, field, mensagem) {\n' +
    '  if (!id) erroCampo(field, mensagem);\n' +
    '  const registro = await model(nome).findById(id).lean();\n' +
    '  if (!registro || registro.status === "Inativo") erroCampo(field, mensagem);\n' +
    '  return registro;\n' +
    '}\n' +
    '\n' +
    'function porPrioridade(item, categorias) {\n' +
    '  const porId = new Map(categorias.map((categoria) => [String(categoria._id), categoria]));\n' +
    '  return [\n' +
    '    porId.get(String(item.subcategoriaId || "")),\n' +
    '    porId.get(String(item.categoriaId || "")),\n' +
    '  ].filter(Boolean);\n' +
    '}\n' +
    '\n' +
    'async function categoriaOmieValidaParaItem(item) {\n' +
    '  const categorias = await model("Categoria").find({\n' +
    '    _id: { $in: [item.subcategoriaId, item.categoriaId].filter(Boolean) },\n' +
    '  }).lean();\n' +
    '  const categoriaLocal = porPrioridade(item, categorias)\n' +
    '    .find((registro) => registro.omieCategoriaId);\n' +
    '  if (!categoriaLocal) return null;\n' +
    '\n' +
    '  const categoria = await model("OmieCategoria")\n' +
    '    .findById(categoriaLocal.omieCategoriaId)\n' +
    '    .lean();\n' +
    '  return categoria\n' +
    '    && categoria.status === "Ativo"\n' +
    '    && !categoria.contaInativa\n' +
    '    && !categoria.totalizadora\n' +
    '    && !categoria.transferencia\n' +
    '    && !categoria.naoExibir\n' +
    '    ? categoria\n' +
    '    : null;\n' +
    '}\n' +
    '\n' +
    'async function contaCorrenteOmieValida(id) {\n' +
    '  if (!id) return null;\n' +
    '  const conta = await model("OmieContaCorrente").findById(id).lean();\n' +
    '  return conta\n' +
    '    && conta.status === "Ativo"\n' +
    '    && !conta.inativa\n' +
    '    && !conta.bloqueada\n' +
    '    ? conta\n' +
    '    : null;\n' +
    '}\n' +
    '\n' +
    'defineValidation("Projeto", async (dados, contexto) => {\n' +
    '  const entrada = dadosConsolidados(dados, contexto);\n' +
    '  const cliente = await registroAtivo(\n' +
    '    "ClienteFornecedor",\n' +
    '    entrada.clienteId,\n' +
    '    "clienteId",\n' +
    '    "Selecione um cliente ativo.",\n' +
    '  );\n' +
    '  if (!cliente.cliente) {\n' +
    '    erroCampo("clienteId", "O cadastro selecionado não está marcado como Cliente.");\n' +
    '  }\n' +
    '\n' +
    '  const fornecedor = await registroAtivo(\n' +
    '    "ClienteFornecedor",\n' +
    '    entrada.fornecedorId,\n' +
    '    "fornecedorId",\n' +
    '    "Selecione um fornecedor ativo.",\n' +
    '  );\n' +
    '  if (!fornecedor.fornecedor) {\n' +
    '    erroCampo(\n' +
    '      "fornecedorId",\n' +
    '      "O cadastro selecionado não está marcado como Fornecedor.",\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  const contato = await registroAtivo(\n' +
    '    "Contato",\n' +
    '    entrada.contatoPrincipalId,\n' +
    '    "contatoPrincipalId",\n' +
    '    "Selecione um contato ativo.",\n' +
    '  );\n' +
    '  if (String(contato.clienteFornecedorId) !== String(entrada.clienteId)) {\n' +
    '    erroCampo(\n' +
    '      "contatoPrincipalId",\n' +
    '      "O contato principal deve pertencer ao cliente selecionado.",\n' +
    '    );\n' +
    '  }\n' +
    '});\n' +
    '\n' +
    'defineValidation("ProjetoItem", async (dados, contexto) => {\n' +
    '  const entrada = dadosComDependenciaOpcional(\n' +
    '    dados,\n' +
    '    contexto,\n' +
    '    "categoriaId",\n' +
    '    "subcategoriaId",\n' +
    '  );\n' +
    '  await registroAtivo(\n' +
    '    "Projeto",\n' +
    '    entrada.projetoId,\n' +
    '    "projetoId",\n' +
    '    "Selecione um projeto ativo.",\n' +
    '  );\n' +
    '  await registroAtivo(\n' +
    '    "Responsavel",\n' +
    '    entrada.responsavelId,\n' +
    '    "responsavelId",\n' +
    '    "Selecione um responsável ativo.",\n' +
    '  );\n' +
    '  const estado = await registroAtivo(\n' +
    '    "Estado",\n' +
    '    entrada.estadoId,\n' +
    '    "estadoId",\n' +
    '    "Selecione um estado ativo.",\n' +
    '  );\n' +
    '  const cidade = await registroAtivo(\n' +
    '    "Cidade",\n' +
    '    entrada.cidadeId,\n' +
    '    "cidadeId",\n' +
    '    "Selecione uma cidade ativa.",\n' +
    '  );\n' +
    '  if (String(cidade.estadoId) !== String(estado._id)) {\n' +
    '    erroCampo("cidadeId", "A cidade selecionada não pertence ao estado informado.");\n' +
    '  }\n' +
    '\n' +
    '  const categoria = await registroAtivo(\n' +
    '    "Categoria",\n' +
    '    entrada.categoriaId,\n' +
    '    "categoriaId",\n' +
    '    "Selecione uma categoria ativa.",\n' +
    '  );\n' +
    '  if (categoria.categoriaPaiId) {\n' +
    '    erroCampo("categoriaId", "Selecione uma categoria principal, sem categoria pai.");\n' +
    '  }\n' +
    '  if (entrada.subcategoriaId) {\n' +
    '    const subcategoria = await registroAtivo(\n' +
    '      "Categoria",\n' +
    '      entrada.subcategoriaId,\n' +
    '      "subcategoriaId",\n' +
    '      "Selecione uma subcategoria ativa.",\n' +
    '    );\n' +
    '    if (!subcategoriaPertenceACategoria(categoria._id, subcategoria)) {\n' +
    '      erroCampo(\n' +
    '        "subcategoriaId",\n' +
    '        "A subcategoria selecionada não pertence à categoria informada.",\n' +
    '      );\n' +
    '    }\n' +
    '  }\n' +
    '});\n' +
    '\n' +
    'defineValidation("Pagamento", async (dados, contexto) => {\n' +
    '  const entrada = dadosConsolidados(dados, contexto);\n' +
    '  const item = await model("ProjetoItem").findById(entrada.projetoItemId).lean();\n' +
    '  if (!item) erroCampo("projetoItemId", "Item do projeto não encontrado.");\n' +
    '  if (String(item.projetoId) !== String(entrada.projetoId)) {\n' +
    '    erroCampo(\n' +
    '      "projetoItemId",\n' +
    '      "O pagamento deve estar vinculado ao mesmo projeto do item.",\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  const responsavel = await registroAtivo(\n' +
    '    "Responsavel",\n' +
    '    entrada.responsavelPagamentoId,\n' +
    '    "responsavelPagamentoId",\n' +
    '    "Selecione um responsável de pagamento ativo.",\n' +
    '  );\n' +
    '  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {\n' +
    '    erroCampo(\n' +
    '      "responsavelPagamentoId",\n' +
    '      "O responsável selecionado não está habilitado para pagamentos.",\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  if (\n' +
    '    entrada.omieContaCorrenteId\n' +
    '    && !await contaCorrenteOmieValida(entrada.omieContaCorrenteId)\n' +
    '  ) {\n' +
    '    erroCampo(\n' +
    '      "omieContaCorrenteId",\n' +
    '      "Selecione uma Conta Corrente Omie ativa e não bloqueada.",\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  if (entrada.etapa === "Aprovado") {\n' +
    '    if (!await categoriaOmieValidaParaItem(item)) {\n' +
    '      erroCampo(\n' +
    '        "projetoItemId",\n' +
    '        "Relacione a categoria ou subcategoria do item com uma Categoria Omie válida antes de aprovar.",\n' +
    '      );\n' +
    '    }\n' +
    '    if (!await contaCorrenteOmieValida(entrada.omieContaCorrenteId)) {\n' +
    '      erroCampo(\n' +
    '        "omieContaCorrenteId",\n' +
    '        "Selecione a Conta Corrente Omie do pagamento antes de aprovar.",\n' +
    '      );\n' +
    '    }\n' +
    '  }\n' +
    '  if (entrada.etapa === "Pagamento Ok" && !entrada.omieLiquidado) {\n' +
    '    erroCampo(\n' +
    '      "etapa",\n' +
    '      "O status Pagamento Ok é definido somente após a baixa confirmada no Omie.",\n' +
    '    );\n' +
    '  }\n' +
    '});\n' +
    '\n' +
    'module.exports = {\n' +
    '  categoriaOmieValidaParaItem,\n' +
    '  contaCorrenteOmieValida,\n' +
    '};\n'
  
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/acoes-validacao-subcategoria.test.js:63:10)
      at Test.runInAsyncScope (node:async_hooks:206:9)
      at Test.run (node:internal/test_runner/test:796:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:526:18)
      at Test.postRun (node:internal/test_runner/test:889:19)
      at Test.run (node:internal/test_runner/test:835:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:526:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: '"use strict";\n\nconst { defineValidation, registry, GenericError } = require("@oondemand/oon-core-back");\nconst {\n  dadosConsolidados,\n  dadosComDependenciaOpcional,\n  subcategoriaPertenceACategoria,\n} = require("../services/dadosValidacao");\n\nfunction model(nome) {\n  const Model = registry.getModel(nome)?.mongooseModel;\n  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);\n  return Model;\n}\n\nfunction erroCampo(field, message) {\n  throw new GenericError(message, { details: { field, message } });\n}\n\nasync function registroAtivo(nome, id, field, mensagem) {\n  if (!id) erroCampo(field, mensagem);\n  const registro = await model(nome).findById(id).lean();\n  if (!registro || registro.status === "Inativo") erroCampo(field, mensagem);\n  return registro;\n}\n\nfunction porPrioridade(item, categorias) {\n  const porId = new Map(categorias.map((categoria) => [String(categoria._id), categoria]));\n  return [\n    porId.get(String(item.subcategoriaId || "")),\n    porId.get(String(item.categoriaId || "")),\n  ].filter(Boolean);\n}\n\nasync function categoriaOmieValidaParaItem(item) {\n  const categorias = await model("Categoria").find({\n    _id: { $in: [item.subcategoriaId, item.categoriaId].filter(Boolean) },\n  }).lean();\n  const categoriaLocal = porPrioridade(item, categorias)\n    .find((registro) => registro.omieCategoriaId);\n  if (!categoriaLocal) return null;\n\n  const categoria = await model("OmieCategoria")\n    .findById(categoriaLocal.omieCategoriaId)\n    .lean();\n  return categoria\n    && categoria.status === "Ativo"\n    && !categoria.contaInativa\n    && !categoria.totalizadora\n    && !categoria.transferencia\n    && !categoria.naoExibir\n    ? categoria\n    : null;\n}\n\nasync function contaCorrenteOmieValida(id) {\n  if (!id) return null;\n  const conta = await model("OmieContaCorrente").findById(id).lean();\n  return conta\n    && conta.status === "Ativo"\n    && !conta.inativa\n    && !conta.bloqueada\n    ? conta\n    : null;\n}\n\ndefineValidation("Projeto", async (dados, contexto) => {\n  const entrada = dadosConsolidados(dados, contexto);\n  const cliente = await registroAtivo(\n    "ClienteFornecedor",\n    entrada.clienteId,\n    "clienteId",\n    "Selecione um cliente ativo.",\n  );\n  if (!cliente.cliente) {\n    erroCampo("clienteId", "O cadastro selecionado não está marcado como Cliente.");\n  }\n\n  const fornecedor = await registroAtivo(\n    "ClienteFornecedor",\n    entrada.fornecedorId,\n    "fornecedorId",\n    "Selecione um fornecedor ativo.",\n  );\n  if (!fornecedor.fornecedor) {\n    erroCampo(\n      "fornecedorId",\n      "O cadastro selecionado não está marcado como Fornecedor.",\n    );\n  }\n\n  const contato = await registroAtivo(\n    "Contato",\n    entrada.contatoPrincipalId,\n    "contatoPrincipalId",\n    "Selecione um contato ativo.",\n  );\n  if (String(contato.clienteFornecedorId) !== String(entrada.clienteId)) {\n    erroCampo(\n      "contatoPrincipalId",\n      "O contato principal deve pertencer ao cliente selecionado.",\n    );\n  }\n});\n\ndefineValidation("ProjetoItem", async (dados, contexto) => {\n  const entrada = dadosComDependenciaOpcional(\n    dados,\n    contexto,\n    "categoriaId",\n    "subcategoriaId",\n  );\n  await registroAtivo(\n    "Projeto",\n    entrada.projetoId,\n    "projetoId",\n    "Selecione um projeto ativo.",\n  );\n  await registroAtivo(\n    "Responsavel",\n    entrada.responsavelId,\n    "responsavelId",\n    "Selecione um responsável ativo.",\n  );\n  const estado = await registroAtivo(\n    "Estado",\n    entrada.estadoId,\n    "estadoId",\n    "Selecione um estado ativo.",\n  );\n  const cidade = await registroAtivo(\n    "Cidade",\n    entrada.cidadeId,\n    "cidadeId",\n    "Selecione uma cidade ativa.",\n  );\n  if (String(cidade.estadoId) !== String(estado._id)) {\n    erroCampo("cidadeId", "A cidade selecionada não pertence ao estado informado.");\n  }\n\n  const categoria = await registroAtivo(\n    "Categoria",\n    entrada.categoriaId,\n    "categoriaId",\n    "Selecione uma categoria ativa.",\n  );\n  if (categoria.categoriaPaiId) {\n    erroCampo("categoriaId", "Selecione uma categoria principal, sem categoria pai.");\n  }\n  if (entrada.subcategoriaId) {\n    const subcategoria = await registroAtivo(\n      "Categoria",\n      entrada.subcategoriaId,\n      "subcategoriaId",\n      "Selecione uma subcategoria ativa.",\n    );\n    if (!subcategoriaPertenceACategoria(categoria._id, subcategoria)) {\n      erroCampo(\n        "subcategoriaId",\n        "A subcategoria selecionada não pertence à categoria informada.",\n      );\n    }\n  }\n});\n\ndefineValidation("Pagamento", async (dados, contexto) => {\n  const entrada = dadosConsolidados(dados, contexto);\n  const item = await model("ProjetoItem").findById(entrada.projetoItemId).lean();\n  if (!item) erroCampo("projetoItemId", "Item do projeto não encontrado.");\n  if (String(item.projetoId) !== String(entrada.projetoId)) {\n    erroCampo(\n      "projetoItemId",\n      "O pagamento deve estar vinculado ao mesmo projeto do item.",\n    );\n  }\n\n  const responsavel = await registroAtivo(\n    "Responsavel",\n    entrada.responsavelPagamentoId,\n    "responsavelPagamentoId",\n    "Selecione um responsável de pagamento ativo.",\n  );\n  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {\n    erroCampo(\n      "responsavelPagamentoId",\n      "O responsável selecionado não está habilitado para pagamentos.",\n    );\n  }\n\n  if (\n    entrada.omieContaCorrenteId\n    && !await contaCorrenteOmieValida(entrada.omieContaCorrenteId)\n  ) {\n    erroCampo(\n      "omieContaCorrenteId",\n      "Selecione uma Conta Corrente Omie ativa e não bloqueada.",\n    );\n  }\n\n  if (entrada.etapa === "Aprovado") {\n    if (!await categoriaOmieValidaParaItem(item)) {\n      erroCampo(\n        "projetoItemId",\n        "Relacione a categoria ou subcategoria do item com uma Categoria Omie válida antes de aprovar.",\n      );\n    }\n    if (!await contaCorrenteOmieValida(entrada.omieContaCorrenteId)) {\n      erroCampo(\n        "omieContaCorrenteId",\n        "Selecione a Conta Corrente Omie do pagamento antes de aprovar.",\n      );\n    }\n  }\n  if (entrada.etapa === "Pagamento Ok" && !entrada.omieLiquidado) {\n    erroCampo(\n      "etapa",\n      "O status Pagamento Ok é definido somente após a baixa confirmada no Omie.",\n    );\n  }\n});\n\nmodule.exports = {\n  categoriaOmieValidaParaItem,\n  contaCorrenteOmieValida,\n};\n',
    expected: /A subcategoria selecionada não pertence à categoria informada/,
    operator: 'doesNotMatch'
  }

test at test/formas-pagamento.test.js:15:1
✖ backend cadastra formas de pagamento e preserva uma forma padrão ativa (1.875354ms)
  Error: ENOENT: no such file or directory, open '/home/runner/work/ss-eventos/ss-eventos/backend/src/models/FormaPagamento.js'
      at Object.readFileSync (node:fs:448:20)
      at ler (/home/runner/work/ss-eventos/ss-eventos/backend/test/formas-pagamento.test.js:12:13)
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/formas-pagamento.test.js:16:17)
      at Test.runInAsyncScope (node:async_hooks:206:9)
      at Test.run (node:internal/test_runner/test:796:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:526:18)
      at node:internal/test_runner/harness:255:12
      at node:internal/process/task_queues:140:7
      at AsyncResource.runInAsyncScope (node:async_hooks:206:9)
      at AsyncResource.runMicrotask (node:internal/process/task_queues:137:8) {
    errno: -2,
    code: 'ENOENT',
    syscall: 'open',
    path: '/home/runner/work/ss-eventos/ss-eventos/backend/src/models/FormaPagamento.js'
  }

test at test/formas-pagamento.test.js:27:1
✖ pagamento usa referência configurada e mantém descrição histórica (5.185346ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /formaPagamentoId:\s*fields\.ref\("FormaPagamento"/. Input:
  
  '"use strict";\n' +
    '\n' +
    'const { defineModel, fields, GenericError } = require("@oondemand/oon-core-back");\n' +
    'const { enfileirarIntegracao } = require("./IntegrationOutbox");\n' +
    'const { codigoPagamentoIntegracao } = require("../services/omieUtils");\n' +
    '\n' +
    'const ETAPA_ENVIO_AUTOMATICO = "Enviado para Omie";\n' +
    'const ETAPA_PAGAMENTO_OK = "Pagamento Ok";\n' +
    'const ETAPAS_AUTOMATICAS = new Set([\n' +
    '  ETAPA_ENVIO_AUTOMATICO,\n' +
    '  ETAPA_PAGAMENTO_OK,\n' +
    ']);\n' +
    '\n' +
    'function etapaAutomatica(etapa) {\n' +
    '  return ETAPAS_AUTOMATICAS.has(String(etapa || ""));\n' +
    '}\n' +
    '\n' +
    'const entry = defineModel({\n' +
    '  name: "Pagamento",\n' +
    '  singular: "pagamento",\n' +
    '  basePath: "/pagamentos",\n' +
    '  schema: {\n' +
    '    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),\n' +
    '    projetoItemId: fields.ref("ProjetoItem", {\n' +
    '      required: true,\n' +
    '      label: "Item do Projeto",\n' +
    '    }),\n' +
    '    dataPrevisaoPagamento: fields.date({\n' +
    '      required: true,\n' +
    '      label: "Data previsão pagamento",\n' +
    '    }),\n' +
    '    omieContaCorrenteId: fields.ref("OmieContaCorrente", {\n' +
    '      label: "Conta corrente Omie",\n' +
    '    }),\n' +
    '    valor: fields.currency({ required: true, label: "Valor" }),\n' +
    '    responsavelPagamentoId: fields.ref("Responsavel", {\n' +
    '      required: true,\n' +
    '      label: "Responsável Pagamento",\n' +
    '    }),\n' +
    '    nfRecebida: fields.boolean({ label: "NF Recebida", default: false }),\n' +
    '    etapa: fields.enum(\n' +
    '      ["Solicitado", "Aprovado", "Aguardando NF", ETAPA_ENVIO_AUTOMATICO, ETAPA_PAGAMENTO_OK],\n' +
    '      { required: true, label: "Etapa", default: "Solicitado" },\n' +
    '    ),\n' +
    '    statusTrabalho: fields.enum(\n' +
    '      ["Aguardando início", "Trabalhando", "Revisar"],\n' +
    '      {\n' +
    '        required: true,\n' +
    '        label: "Status de trabalho",\n' +
    '        default: "Aguardando início",\n' +
    '      },\n' +
    '    ),\n' +
    '    codigoLancamentoIntegracao: fields.string({\n' +
    '      label: "Código de integração Omie",\n' +
    '      searchable: true,\n' +
    '    }),\n' +
    '    codigoLancamentoOmie: {\n' +
    '      type: Number,\n' +
    '      __meta: {\n' +
    '        kind: "number",\n' +
    '        label: "Lançamento Omie",\n' +
    '        readonly: true,\n' +
    '        readOnly: true,\n' +
    '      },\n' +
    '    },\n' +
    '    omieCodigoCategoriaEnviado: fields.string({\n' +
    '      label: "Categoria enviada ao Omie",\n' +
    '    }),\n' +
    '    omieCodigoClienteFornecedorEnviado: {\n' +
    '      type: Number,\n' +
    '      __meta: {\n' +
    '        kind: "number",\n' +
    '        label: "Fornecedor enviado ao Omie",\n' +
    '        readonly: true,\n' +
    '        readOnly: true,\n' +
    '      },\n' +
    '    },\n' +
    '    omieContaCorrenteEnviada: {\n' +
    '      type: Number,\n' +
    '      __meta: {\n' +
    '        kind: "number",\n' +
    '        label: "Conta corrente enviada ao Omie",\n' +
    '        readonly: true,\n' +
    '        readOnly: true,\n' +
    '      },\n' +
    '    },\n' +
    '    omieNumeroDocumentoEnviado: fields.string({\n' +
    '      label: "Documento enviado ao Omie",\n' +
    '    }),\n' +
    '    omieValorTitulo: fields.currency({ label: "Valor do título Omie" }),\n' +
    '    omieValorPago: fields.currency({ label: "Valor pago no Omie" }),\n' +
    '    omieValorPendente: fields.currency({ label: "Valor pendente no Omie" }),\n' +
    '    omieDataUltimaBaixa: fields.date({ label: "Última baixa no Omie" }),\n' +
    '    omieLiquidado: fields.boolean({\n' +
    '      label: "Liquidado no Omie",\n' +
    '      default: false,\n' +
    '    }),\n' +
    '    omieStatusIntegracao: fields.enum(\n' +
    '      ["Não enviado", "Pendente", "Processando", "Enviado", "Erro", "Cancelado"],\n' +
    '      {\n' +
    '        label: "Status integração Omie",\n' +
    '        default: "Não enviado",\n' +
    '      },\n' +
    '    ),\n' +
    '    omieUltimoErro: fields.string({\n' +
    '      label: "Último erro Omie",\n' +
    '      searchable: true,\n' +
    '    }),\n' +
    '    omieErroArquivado: fields.boolean({\n' +
    '      label: "Erro Omie arquivado",\n' +
    '      default: false,\n' +
    '    }),\n' +
    '    omieErroArquivadoEm: fields.date({ label: "Erro Omie arquivado em" }),\n' +
    '    omieErroArquivadoMotivo: fields.string({\n' +
    '      label: "Motivo do arquivamento do erro Omie",\n' +
    '    }),\n' +
    '    omieUltimaSincronizacaoEm: fields.date({\n' +
    '      label: "Última sincronização Omie",\n' +
    '    }),\n' +
    '    omiePayloadHash: fields.string({ label: "Hash enviado ao Omie" }),\n' +
    '    canceladoNaCentral: fields.boolean({\n' +
    '      label: "Cancelado na Central",\n' +
    '      default: false,\n' +
    '    }),\n' +
    '  },\n' +
    '  crud: {\n' +
    '    enabled: true,\n' +
    '    roles: { write: ["admin", "desenvolvedor"] },\n' +
    '    populateRefs: true,\n' +
    '  },\n' +
    '});\n' +
    '\n' +
    'const Model = entry.mongooseModel;\n' +
    'Model.schema.index({ codigoLancamentoIntegracao: 1 }, { unique: true, sparse: true });\n' +
    'Model.schema.index({ codigoLancamentoOmie: 1 }, { unique: true, sparse: true });\n' +
    '\n' +
    'const createOriginal = Model.create.bind(Model);\n' +
    'const updateOriginal = Model.findByIdAndUpdate.bind(Model);\n' +
    'const insertManyOriginal = Model.insertMany.bind(Model);\n' +
    '\n' +
    'function prepararCriacao(dados = {}) {\n' +
    '  const etapa = dados.etapa || "Solicitado";\n' +
    '  const envioAutomatico = etapa === ETAPA_ENVIO_AUTOMATICO;\n' +
    '  return {\n' +
    '    ...dados,\n' +
    '    etapa,\n' +
    '    statusTrabalho: etapaAutomatica(etapa)\n' +
    '      ? "Trabalhando"\n' +
    '      : dados.statusTrabalho || "Aguardando início",\n' +
    '    codigoLancamentoIntegracao: dados.codigoLancamentoIntegracao\n' +
    '      || (dados._id ? codigoPagamentoIntegracao(dados._id) : undefined),\n' +
    '    omieValorTitulo: Number(dados.valor || 0),\n' +
    '    omieValorPago: 0,\n' +
    '    omieValorPendente: Number(dados.valor || 0),\n' +
    '    omieStatusIntegracao: envioAutomatico\n' +
    '      ? "Pendente"\n' +
    '      : dados.omieStatusIntegracao || "Não enviado",\n' +
    '    omieUltimoErro: envioAutomatico ? "" : dados.omieUltimoErro || "",\n' +
    '    omieErroArquivado: false,\n' +
    '    omieErroArquivadoEm: null,\n' +
    '    omieErroArquivadoMotivo: "",\n' +
    '  };\n' +
    '}\n' +
    '\n' +
    'async function agendarContaPagar(pagamento) {\n' +
    '  if (\n' +
    '    !pagamento?._id\n' +
    '    || pagamento.etapa !== ETAPA_ENVIO_AUTOMATICO\n' +
    '    || pagamento.codigoLancamentoOmie\n' +
    '  ) {\n' +
    '    return;\n' +
    '  }\n' +
    '\n' +
    '  const codigo = pagamento.codigoLancamentoIntegracao\n' +
    '    || codigoPagamentoIntegracao(pagamento._id);\n' +
    '  await Model.updateOne(\n' +
    '    { _id: pagamento._id },\n' +
    '    {\n' +
    '      $set: {\n' +
    '        codigoLancamentoIntegracao: codigo,\n' +
    '        statusTrabalho: "Trabalhando",\n' +
    '        omieStatusIntegracao: "Pendente",\n' +
    '        omieUltimoErro: "",\n' +
    '        omieErroArquivado: false,\n' +
    '        omieErroArquivadoEm: null,\n' +
    '        omieErroArquivadoMotivo: "",\n' +
    '      },\n' +
    '    },\n' +
    '  );\n' +
    '\n' +
    '  await enfileirarIntegracao({\n' +
    '    provider: "omie",\n' +
    '    handler: "OMIE_CONTA_PAGAR_UPSERT",\n' +
    '    tipo: "OMIE_CONTA_PAGAR_UPSERT",\n' +
    '    resource: "contas-pagar",\n' +
    '    operation: "upsert",\n' +
    '    aggregateType: "Pagamento",\n' +
    '    aggregateId: pagamento._id,\n' +
    '    idempotencyKey: `omie:conta-pagar:${pagamento._id}`,\n' +
    '    payload: { pagamentoId: String(pagamento._id) },\n' +
    '  });\n' +
    '}\n' +
    '\n' +
    'Model.create = async function criarPagamento(dados, opcoes = {}) {\n' +
    '  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n' +
    '  if (Array.isArray(dados)) {\n' +
    '    const criados = await createOriginal(dados.map(prepararCriacao), mongoOptions);\n' +
    '    if (!skipOmieOutbox) {\n' +
    '      for (const criado of criados) await agendarContaPagar(criado);\n' +
    '    }\n' +
    '    return criados;\n' +
    '  }\n' +
    '\n' +
    '  const [criado] = await createOriginal([prepararCriacao(dados)], mongoOptions);\n' +
    '  if (!skipOmieOutbox) await agendarContaPagar(criado);\n' +
    '  return criado;\n' +
    '};\n' +
    '\n' +
    'Model.findByIdAndUpdate = async function atualizarPagamento(\n' +
    '  id,\n' +
    '  alteracoes = {},\n' +
    '  opcoes = {},\n' +
    ') {\n' +
    '  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n' +
    '  const atual = await Model.findById(id).lean();\n' +
    '  if (!atual) return null;\n' +
    '\n' +
    '  const usaSet = Boolean(alteracoes?.$set);\n' +
    '  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };\n' +
    '  const conciliarAgora = entrada._conciliarOmie === true\n' +
    '    || entrada._conciliarOmie === "true";\n' +
    '  delete entrada._conciliarOmie;\n' +
    '\n' +
    '  if (conciliarAgora) {\n' +
    '    if (atual.etapa !== ETAPA_ENVIO_AUTOMATICO) {\n' +
    '      throw new GenericError(\n' +
    '        "A conciliação manual somente está disponível em Enviado para Omie.",\n' +
    '        { statusCode: 409 },\n' +
    '      );\n' +
    '    }\n' +
    '    const {\n' +
    '      conciliarPagamentoAutomatico,\n' +
    '    } = require("../services/omiePagamentoAutomatico");\n' +
    '    await conciliarPagamentoAutomatico(id);\n' +
    '    return Model.findById(id);\n' +
    '  }\n' +
    '\n' +
    '  if (etapaAutomatica(atual.etapa) && !skipOmieOutbox) {\n' +
    '    throw new GenericError(\n' +
    '      "Esta é uma etapa automática. Os campos e as ações do pagamento ficam bloqueados.",\n' +
    '      { statusCode: 409 },\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  if (entrada.etapa === ETAPA_PAGAMENTO_OK && !skipOmieOutbox) {\n' +
    '    throw new GenericError(\n' +
    '      "A etapa Pagamento Ok somente pode ser definida pela conciliação com o Omie.",\n' +
    '      { statusCode: 409 },\n' +
    '    );\n' +
    '  }\n' +
    '\n' +
    '  if (\n' +
    '    entrada.etapa === ETAPA_ENVIO_AUTOMATICO\n' +
    '    && atual.etapa !== ETAPA_ENVIO_AUTOMATICO\n' +
    '  ) {\n' +
    '    if (atual.etapa !== "Aguardando NF") {\n' +
    '      throw new GenericError(\n' +
    '        "O pagamento somente pode entrar em Enviado para Omie após Aguardando NF.",\n' +
    '        { statusCode: 409 },\n' +
    '      );\n' +
    '    }\n' +
    '    entrada.statusTrabalho = "Trabalhando";\n' +
    '    entrada.omieStatusIntegracao = "Pendente";\n' +
    '    entrada.omieUltimoErro = "";\n' +
    '    entrada.omieErroArquivado = false;\n' +
    '    entrada.omieErroArquivadoEm = null;\n' +
    '    entrada.omieErroArquivadoMotivo = "";\n' +
    '  }\n' +
    '\n' +
    '  if (atual.codigoLancamentoOmie && !skipOmieOutbox) {\n' +
    '    const protegidos = ["valor", "projetoId", "projetoItemId", "omieContaCorrenteId"];\n' +
    '    const alterado = protegidos.find(\n' +
    '      (campo) => Object.prototype.hasOwnProperty.call(entrada, campo)\n' +
    '        && String(entrada[campo]) !== String(atual[campo]),\n' +
    '    );\n' +
    '    if (alterado) {\n' +
    '      throw new GenericError(\n' +
    '        "O título já foi enviado ao Omie. Cancele ou estorne antes de alterar dados financeiros.",\n' +
    '        { statusCode: 409 },\n' +
    '      );\n' +
    '    }\n' +
    '  }\n' +
    '\n' +
    '  if (!atual.codigoLancamentoIntegracao) {\n' +
    '    entrada.codigoLancamentoIntegracao = codigoPagamentoIntegracao(id);\n' +
    '  }\n' +
    '  if (Object.prototype.hasOwnProperty.call(entrada, "valor") && !atual.codigoLancamentoOmie) {\n' +
    '    entrada.omieValorTitulo = Number(entrada.valor || 0);\n' +
    '    entrada.omieValorPendente = Number(entrada.valor || 0);\n' +
    '  }\n' +
    '\n' +
    '  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;\n' +
    '  const atualizado = await updateOriginal(id, payload, {\n' +
    '    ...mongoOptions,\n' +
    '    new: true,\n' +
    '  });\n' +
    '  if (!skipOmieOutbox) await agendarContaPagar(atualizado);\n' +
    '  return atualizado;\n' +
    '};\n' +
    '\n' +
    'Model.insertMany = async function inserirPagamentos(registros = [], opcoes = {}) {\n' +
    '  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n' +
    '  const criados = await insertManyOriginal(\n' +
    '    registros.map(prepararCriacao),\n' +
    '    mongoOptions,\n' +
    '  );\n' +
    '  if (!skip'... 239 more characters
  
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/formas-pagamento.test.js:32:10)
      at Test.runInAsyncScope (node:async_hooks:206:9)
      at Test.run (node:internal/test_runner/test:796:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:526:18)
      at Test.postRun (node:internal/test_runner/test:889:19)
      at Test.run (node:internal/test_runner/test:835:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:526:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: '"use strict";\n\nconst { defineModel, fields, GenericError } = require("@oondemand/oon-core-back");\nconst { enfileirarIntegracao } = require("./IntegrationOutbox");\nconst { codigoPagamentoIntegracao } = require("../services/omieUtils");\n\nconst ETAPA_ENVIO_AUTOMATICO = "Enviado para Omie";\nconst ETAPA_PAGAMENTO_OK = "Pagamento Ok";\nconst ETAPAS_AUTOMATICAS = new Set([\n  ETAPA_ENVIO_AUTOMATICO,\n  ETAPA_PAGAMENTO_OK,\n]);\n\nfunction etapaAutomatica(etapa) {\n  return ETAPAS_AUTOMATICAS.has(String(etapa || ""));\n}\n\nconst entry = defineModel({\n  name: "Pagamento",\n  singular: "pagamento",\n  basePath: "/pagamentos",\n  schema: {\n    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),\n    projetoItemId: fields.ref("ProjetoItem", {\n      required: true,\n      label: "Item do Projeto",\n    }),\n    dataPrevisaoPagamento: fields.date({\n      required: true,\n      label: "Data previsão pagamento",\n    }),\n    omieContaCorrenteId: fields.ref("OmieContaCorrente", {\n      label: "Conta corrente Omie",\n    }),\n    valor: fields.currency({ required: true, label: "Valor" }),\n    responsavelPagamentoId: fields.ref("Responsavel", {\n      required: true,\n      label: "Responsável Pagamento",\n    }),\n    nfRecebida: fields.boolean({ label: "NF Recebida", default: false }),\n    etapa: fields.enum(\n      ["Solicitado", "Aprovado", "Aguardando NF", ETAPA_ENVIO_AUTOMATICO, ETAPA_PAGAMENTO_OK],\n      { required: true, label: "Etapa", default: "Solicitado" },\n    ),\n    statusTrabalho: fields.enum(\n      ["Aguardando início", "Trabalhando", "Revisar"],\n      {\n        required: true,\n        label: "Status de trabalho",\n        default: "Aguardando início",\n      },\n    ),\n    codigoLancamentoIntegracao: fields.string({\n      label: "Código de integração Omie",\n      searchable: true,\n    }),\n    codigoLancamentoOmie: {\n      type: Number,\n      __meta: {\n        kind: "number",\n        label: "Lançamento Omie",\n        readonly: true,\n        readOnly: true,\n      },\n    },\n    omieCodigoCategoriaEnviado: fields.string({\n      label: "Categoria enviada ao Omie",\n    }),\n    omieCodigoClienteFornecedorEnviado: {\n      type: Number,\n      __meta: {\n        kind: "number",\n        label: "Fornecedor enviado ao Omie",\n        readonly: true,\n        readOnly: true,\n      },\n    },\n    omieContaCorrenteEnviada: {\n      type: Number,\n      __meta: {\n        kind: "number",\n        label: "Conta corrente enviada ao Omie",\n        readonly: true,\n        readOnly: true,\n      },\n    },\n    omieNumeroDocumentoEnviado: fields.string({\n      label: "Documento enviado ao Omie",\n    }),\n    omieValorTitulo: fields.currency({ label: "Valor do título Omie" }),\n    omieValorPago: fields.currency({ label: "Valor pago no Omie" }),\n    omieValorPendente: fields.currency({ label: "Valor pendente no Omie" }),\n    omieDataUltimaBaixa: fields.date({ label: "Última baixa no Omie" }),\n    omieLiquidado: fields.boolean({\n      label: "Liquidado no Omie",\n      default: false,\n    }),\n    omieStatusIntegracao: fields.enum(\n      ["Não enviado", "Pendente", "Processando", "Enviado", "Erro", "Cancelado"],\n      {\n        label: "Status integração Omie",\n        default: "Não enviado",\n      },\n    ),\n    omieUltimoErro: fields.string({\n      label: "Último erro Omie",\n      searchable: true,\n    }),\n    omieErroArquivado: fields.boolean({\n      label: "Erro Omie arquivado",\n      default: false,\n    }),\n    omieErroArquivadoEm: fields.date({ label: "Erro Omie arquivado em" }),\n    omieErroArquivadoMotivo: fields.string({\n      label: "Motivo do arquivamento do erro Omie",\n    }),\n    omieUltimaSincronizacaoEm: fields.date({\n      label: "Última sincronização Omie",\n    }),\n    omiePayloadHash: fields.string({ label: "Hash enviado ao Omie" }),\n    canceladoNaCentral: fields.boolean({\n      label: "Cancelado na Central",\n      default: false,\n    }),\n  },\n  crud: {\n    enabled: true,\n    roles: { write: ["admin", "desenvolvedor"] },\n    populateRefs: true,\n  },\n});\n\nconst Model = entry.mongooseModel;\nModel.schema.index({ codigoLancamentoIntegracao: 1 }, { unique: true, sparse: true });\nModel.schema.index({ codigoLancamentoOmie: 1 }, { unique: true, sparse: true });\n\nconst createOriginal = Model.create.bind(Model);\nconst updateOriginal = Model.findByIdAndUpdate.bind(Model);\nconst insertManyOriginal = Model.insertMany.bind(Model);\n\nfunction prepararCriacao(dados = {}) {\n  const etapa = dados.etapa || "Solicitado";\n  const envioAutomatico = etapa === ETAPA_ENVIO_AUTOMATICO;\n  return {\n    ...dados,\n    etapa,\n    statusTrabalho: etapaAutomatica(etapa)\n      ? "Trabalhando"\n      : dados.statusTrabalho || "Aguardando início",\n    codigoLancamentoIntegracao: dados.codigoLancamentoIntegracao\n      || (dados._id ? codigoPagamentoIntegracao(dados._id) : undefined),\n    omieValorTitulo: Number(dados.valor || 0),\n    omieValorPago: 0,\n    omieValorPendente: Number(dados.valor || 0),\n    omieStatusIntegracao: envioAutomatico\n      ? "Pendente"\n      : dados.omieStatusIntegracao || "Não enviado",\n    omieUltimoErro: envioAutomatico ? "" : dados.omieUltimoErro || "",\n    omieErroArquivado: false,\n    omieErroArquivadoEm: null,\n    omieErroArquivadoMotivo: "",\n  };\n}\n\nasync function agendarContaPagar(pagamento) {\n  if (\n    !pagamento?._id\n    || pagamento.etapa !== ETAPA_ENVIO_AUTOMATICO\n    || pagamento.codigoLancamentoOmie\n  ) {\n    return;\n  }\n\n  const codigo = pagamento.codigoLancamentoIntegracao\n    || codigoPagamentoIntegracao(pagamento._id);\n  await Model.updateOne(\n    { _id: pagamento._id },\n    {\n      $set: {\n        codigoLancamentoIntegracao: codigo,\n        statusTrabalho: "Trabalhando",\n        omieStatusIntegracao: "Pendente",\n        omieUltimoErro: "",\n        omieErroArquivado: false,\n        omieErroArquivadoEm: null,\n        omieErroArquivadoMotivo: "",\n      },\n    },\n  );\n\n  await enfileirarIntegracao({\n    provider: "omie",\n    handler: "OMIE_CONTA_PAGAR_UPSERT",\n    tipo: "OMIE_CONTA_PAGAR_UPSERT",\n    resource: "contas-pagar",\n    operation: "upsert",\n    aggregateType: "Pagamento",\n    aggregateId: pagamento._id,\n    idempotencyKey: `omie:conta-pagar:${pagamento._id}`,\n    payload: { pagamentoId: String(pagamento._id) },\n  });\n}\n\nModel.create = async function criarPagamento(dados, opcoes = {}) {\n  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n  if (Array.isArray(dados)) {\n    const criados = await createOriginal(dados.map(prepararCriacao), mongoOptions);\n    if (!skipOmieOutbox) {\n      for (const criado of criados) await agendarContaPagar(criado);\n    }\n    return criados;\n  }\n\n  const [criado] = await createOriginal([prepararCriacao(dados)], mongoOptions);\n  if (!skipOmieOutbox) await agendarContaPagar(criado);\n  return criado;\n};\n\nModel.findByIdAndUpdate = async function atualizarPagamento(\n  id,\n  alteracoes = {},\n  opcoes = {},\n) {\n  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n  const atual = await Model.findById(id).lean();\n  if (!atual) return null;\n\n  const usaSet = Boolean(alteracoes?.$set);\n  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };\n  const conciliarAgora = entrada._conciliarOmie === true\n    || entrada._conciliarOmie === "true";\n  delete entrada._conciliarOmie;\n\n  if (conciliarAgora) {\n    if (atual.etapa !== ETAPA_ENVIO_AUTOMATICO) {\n      throw new GenericError(\n        "A conciliação manual somente está disponível em Enviado para Omie.",\n        { statusCode: 409 },\n      );\n    }\n    const {\n      conciliarPagamentoAutomatico,\n    } = require("../services/omiePagamentoAutomatico");\n    await conciliarPagamentoAutomatico(id);\n    return Model.findById(id);\n  }\n\n  if (etapaAutomatica(atual.etapa) && !skipOmieOutbox) {\n    throw new GenericError(\n      "Esta é uma etapa automática. Os campos e as ações do pagamento ficam bloqueados.",\n      { statusCode: 409 },\n    );\n  }\n\n  if (entrada.etapa === ETAPA_PAGAMENTO_OK && !skipOmieOutbox) {\n    throw new GenericError(\n      "A etapa Pagamento Ok somente pode ser definida pela conciliação com o Omie.",\n      { statusCode: 409 },\n    );\n  }\n\n  if (\n    entrada.etapa === ETAPA_ENVIO_AUTOMATICO\n    && atual.etapa !== ETAPA_ENVIO_AUTOMATICO\n  ) {\n    if (atual.etapa !== "Aguardando NF") {\n      throw new GenericError(\n        "O pagamento somente pode entrar em Enviado para Omie após Aguardando NF.",\n        { statusCode: 409 },\n      );\n    }\n    entrada.statusTrabalho = "Trabalhando";\n    entrada.omieStatusIntegracao = "Pendente";\n    entrada.omieUltimoErro = "";\n    entrada.omieErroArquivado = false;\n    entrada.omieErroArquivadoEm = null;\n    entrada.omieErroArquivadoMotivo = "";\n  }\n\n  if (atual.codigoLancamentoOmie && !skipOmieOutbox) {\n    const protegidos = ["valor", "projetoId", "projetoItemId", "omieContaCorrenteId"];\n    const alterado = protegidos.find(\n      (campo) => Object.prototype.hasOwnProperty.call(entrada, campo)\n        && String(entrada[campo]) !== String(atual[campo]),\n    );\n    if (alterado) {\n      throw new GenericError(\n        "O título já foi enviado ao Omie. Cancele ou estorne antes de alterar dados financeiros.",\n        { statusCode: 409 },\n      );\n    }\n  }\n\n  if (!atual.codigoLancamentoIntegracao) {\n    entrada.codigoLancamentoIntegracao = codigoPagamentoIntegracao(id);\n  }\n  if (Object.prototype.hasOwnProperty.call(entrada, "valor") && !atual.codigoLancamentoOmie) {\n    entrada.omieValorTitulo = Number(entrada.valor || 0);\n    entrada.omieValorPendente = Number(entrada.valor || 0);\n  }\n\n  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;\n  const atualizado = await updateOriginal(id, payload, {\n    ...mongoOptions,\n    new: true,\n  });\n  if (!skipOmieOutbox) await agendarContaPagar(atualizado);\n  return atualizado;\n};\n\nModel.insertMany = async function inserirPagamentos(registros = [], opcoes = {}) {\n  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;\n  const criados = await insertManyOriginal(\n    registros.map(prepararCriacao),\n    mongoOptions,\n  );\n  if (!skip'... 239 more characters,
    expected: /formaPagamentoId:\s*fields\.ref\("FormaPagamento"/,
    operator: 'match'
  }

test at test/formas-pagamento.test.js:41:1
✖ frontend adiciona Configurações e usa selector nas entradas de pagamento (2.477841ms)
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/runner/work/ss-eventos/ss-eventos/frontend/src/paymentMethodsAdjustments.js' imported from /home/runner/work/ss-eventos/ss-eventos/backend/test/formas-pagamento.test.js
      at finalizeResolution (node:internal/modules/esm/resolve:283:11)
      at moduleResolve (node:internal/modules/esm/resolve:952:10)
      at defaultResolve (node:internal/modules/esm/resolve:1188:11)
      at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)
      at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
      at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
      at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
      at ModuleLoader.import (node:internal/modules/esm/loader:605:34)
      at defaultImportModuleDynamicallyForScript (node:internal/modules/esm/utils:234:31)
      at importModuleDynamicallyCallback (node:internal/modules/esm/utils:256:12) {
    code: 'ERR_MODULE_NOT_FOUND',
    url: 'file:///home/runner/work/ss-eventos/ss-eventos/frontend/src/paymentMethodsAdjustments.js'
  }

test at test/integration-architecture.test.js:76:1
✖ sincronização continua após erro individual e guarda rastreabilidade (5.054275ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /request: \{ call, param:/. Input:
  
  '"use strict";\n' +
    '\n' +
    'const { sanitizarErro } = require("./omieUtils");\n' +
    '\n' +
    'const ENDPOINTS = Object.freeze({\n' +
    '  clientes: "https://app.omie.com.br/api/v1/geral/clientes/",\n' +
    '  categorias: "https://app.omie.com.br/api/v1/geral/categorias/",\n' +
    '  contasCorrentes: "https://app.omie.com.br/api/v1/geral/contacorrente/",\n' +
    '  contasPagar: "https://app.omie.com.br/api/v1/financas/contapagar/",\n' +
    '});\n' +
    '\n' +
    'class OmieApiError extends Error {\n' +
    '  constructor(message, opcoes = {}) {\n' +
    '    super(message);\n' +
    '    this.name = "OmieApiError";\n' +
    '    this.statusCode = opcoes.statusCode;\n' +
    '    this.code = opcoes.code;\n' +
    '    this.retryable = Boolean(opcoes.retryable);\n' +
    '    this.response = opcoes.response;\n' +
    '    this.trace = opcoes.trace;\n' +
    '    this.traces = opcoes.traces;\n' +
    '  }\n' +
    '}\n' +
    '\n' +
    'function numeroEnv(nome, padrao) {\n' +
    '  const valor = Number(process.env[nome]);\n' +
    '  return Number.isFinite(valor) && valor > 0 ? valor : padrao;\n' +
    '}\n' +
    '\n' +
    'function dormir(ms) {\n' +
    '  return new Promise((resolve) => setTimeout(resolve, ms));\n' +
    '}\n' +
    '\n' +
    'function deveRepetir(statusCode, erro) {\n' +
    '  return [408, 425, 429, 500, 502, 503, 504].includes(statusCode)\n' +
    '    || erro?.name === "AbortError"\n' +
    '    || ["ECONNRESET", "ETIMEDOUT"].includes(erro?.code);\n' +
    '}\n' +
    '\n' +
    'function sanitizarValor(valor, nivel = 0) {\n' +
    '  if (valor == null || typeof valor === "number" || typeof valor === "boolean") return valor;\n' +
    '  if (typeof valor === "string") return valor.length > 2000 ? `${valor.slice(0, 2000)}…` : valor;\n' +
    '  if (nivel >= 5) return "[profundidade limitada]";\n' +
    '  if (Array.isArray(valor)) {\n' +
    '    return {\n' +
    '      total: valor.length,\n' +
    '      amostra: valor.slice(0, 10).map((item) => sanitizarValor(item, nivel + 1)),\n' +
    '      limitada: valor.length > 10,\n' +
    '    };\n' +
    '  }\n' +
    '  if (typeof valor === "object") {\n' +
    '    const segredo = /app[_-]?key|app[_-]?secret|authorization|token|senha|password/i;\n' +
    '    return Object.fromEntries(\n' +
    '      Object.entries(valor)\n' +
    '        .filter(([chave]) => !segredo.test(chave))\n' +
    '        .slice(0, 40)\n' +
    '        .map(([chave, item]) => [chave, sanitizarValor(item, nivel + 1)]),\n' +
    '    );\n' +
    '  }\n' +
    '  return String(valor);\n' +
    '}\n' +
    '\n' +
    'function normalizarErroResposta(body, statusCode) {\n' +
    '  const code = body?.faultcode ?? body?.code ?? body?.codigo_status;\n' +
    '  const description = body?.faultstring ?? body?.description ?? body?.descricao_status;\n' +
    '  if (!description && statusCode >= 200 && statusCode < 300) return null;\n' +
    '  const sucesso = String(code ?? "0") === "0";\n' +
    '  if (statusCode >= 200 && statusCode < 300 && sucesso && !body?.faultstring) return null;\n' +
    '  return new OmieApiError(description || `Omie retornou HTTP ${statusCode}.`, {\n' +
    '    statusCode,\n' +
    '    code,\n' +
    '    retryable: deveRepetir(statusCode),\n' +
    '    response: body,\n' +
    '  });\n' +
    '}\n' +
    '\n' +
    'function normalizarCall(endpoint, call) {\n' +
    '  // Cliente/Prestador já existe no Omie e deve ser alterado explicitamente.\n' +
    '  // A proteção no transporte impede que um fluxo residual execute UpsertCliente.\n' +
    '  if (endpoint === "clientes" && call === "UpsertCliente") return "AlterarCliente";\n' +
    '  return call;\n' +
    '}\n' +
    '\n' +
    'function criarOmieClient(opcoes = {}) {\n' +
    '  const appKey = opcoes.appKey || process.env.OMIE_APP_KEY;\n' +
    '  const appSecret = opcoes.appSecret || process.env.OMIE_APP_SECRET;\n' +
    '  const timeoutMs = opcoes.timeoutMs || numeroEnv("OMIE_TIMEOUT_MS", 30000);\n' +
    '  const maxTentativas = opcoes.maxTentativas || numeroEnv("OMIE_HTTP_ATTEMPTS", 3);\n' +
    '  const maxTraces = numeroEnv("OMIE_TRACE_LIMIT", 100);\n' +
    '  const fetchImpl = opcoes.fetchImpl || globalThis.fetch;\n' +
    '  const traces = [];\n' +
    '\n' +
    '  if (!appKey || !appSecret) {\n' +
    '    throw new OmieApiError("Configure OMIE_APP_KEY e OMIE_APP_SECRET.");\n' +
    '  }\n' +
    '  if (typeof fetchImpl !== "function") {\n' +
    '    throw new OmieApiError("O runtime não oferece fetch para chamar a API Omie.");\n' +
    '  }\n' +
    '\n' +
    '  function registrarTrace(trace) {\n' +
    '    if (traces.length < maxTraces) traces.push(trace);\n' +
    '    if (typeof opcoes.onTrace === "function") opcoes.onTrace(trace);\n' +
    '  }\n' +
    '\n' +
    '  async function chamar(endpoint, call, param = [{}]) {\n' +
    '    const url = ENDPOINTS[endpoint] || endpoint;\n' +
    '    const callEfetivo = normalizarCall(endpoint, call);\n' +
    '    const parametros = Array.isArray(param) ? param : [param];\n' +
    '    const envelope = {\n' +
    '      app_key: appKey,\n' +
    '      app_secret: appSecret,\n' +
    '      call: callEfetivo,\n' +
    '      param: parametros,\n' +
    '    };\n' +
    '    let ultimoErro;\n' +
    '\n' +
    '    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {\n' +
    '      const iniciouEm = new Date();\n' +
    '      const trace = {\n' +
    '        endpoint,\n' +
    '        url,\n' +
    '        call: callEfetivo,\n' +
    '        tentativa,\n' +
    '        iniciouEm,\n' +
    '        request: { call: callEfetivo, param: sanitizarValor(parametros) },\n' +
    '      };\n' +
    '      const controller = new AbortController();\n' +
    '      const timer = setTimeout(() => controller.abort(), timeoutMs);\n' +
    '\n' +
    '      try {\n' +
    '        const resposta = await fetchImpl(url, {\n' +
    '          method: "POST",\n' +
    '          headers: { "content-type": "application/json", accept: "application/json" },\n' +
    '          body: JSON.stringify(envelope),\n' +
    '          signal: controller.signal,\n' +
    '        });\n' +
    '        trace.httpStatus = resposta.status;\n' +
    '        const texto = await resposta.text();\n' +
    '        let body;\n' +
    '        try {\n' +
    '          body = texto ? JSON.parse(texto) : {};\n' +
    '        } catch {\n' +
    '          trace.response = { texto: sanitizarValor(texto) };\n' +
    '          throw new OmieApiError("Resposta inválida da API Omie.", {\n' +
    '            statusCode: resposta.status,\n' +
    '            retryable: resposta.status >= 500,\n' +
    '          });\n' +
    '        }\n' +
    '        trace.response = sanitizarValor(body);\n' +
    '        const erroResposta = normalizarErroResposta(body, resposta.status);\n' +
    '        if (erroResposta) throw erroResposta;\n' +
    '        trace.status = "Sucesso";\n' +
    '        trace.concluiuEm = new Date();\n' +
    '        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();\n' +
    '        registrarTrace(trace);\n' +
    '        return body;\n' +
    '      } catch (erro) {\n' +
    '        trace.status = "Erro";\n' +
    '        trace.erro = sanitizarErro(erro);\n' +
    '        trace.response = trace.response || sanitizarValor(erro?.response || {});\n' +
    '        trace.concluiuEm = new Date();\n' +
    '        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();\n' +
    '        registrarTrace(trace);\n' +
    '\n' +
    '        const retryable = erro instanceof OmieApiError\n' +
    '          ? erro.retryable\n' +
    '          : deveRepetir(erro?.statusCode, erro);\n' +
    '        ultimoErro = erro instanceof OmieApiError\n' +
    '          ? erro\n' +
    '          : new OmieApiError(sanitizarErro(erro), { retryable, code: erro?.code });\n' +
    '        ultimoErro.trace = trace;\n' +
    '        ultimoErro.traces = [...traces];\n' +
    '        if (!retryable || tentativa >= maxTentativas) throw ultimoErro;\n' +
    '        await dormir(\n' +
    '          Math.min(5000, 500 * (2 ** (tentativa - 1))) + Math.floor(Math.random() * 250),\n' +
    '        );\n' +
    '      } finally {\n' +
    '        clearTimeout(timer);\n' +
    '      }\n' +
    '    }\n' +
    '    throw ultimoErro;\n' +
    '  }\n' +
    '\n' +
    '  async function paginar(endpoint, call, paramBase = {}, extrairItens) {\n' +
    '    const itens = [];\n' +
    '    let pagina = 1;\n' +
    '    let totalPaginas = 1;\n' +
    '    do {\n' +
    '      const resposta = await chamar(endpoint, call, [{\n' +
    '        ...paramBase,\n' +
    '        pagina,\n' +
    '        registros_por_pagina: Math.min(\n' +
    '          100,\n' +
    '          Number(paramBase.registros_por_pagina || 100),\n' +
    '        ),\n' +
    '      }]);\n' +
    '      itens.push(...(extrairItens(resposta) || []));\n' +
    '      totalPaginas = Number(resposta.total_de_paginas || resposta.totalDePaginas || 1);\n' +
    '      pagina += 1;\n' +
    '    } while (pagina <= totalPaginas);\n' +
    '    return itens;\n' +
    '  }\n' +
    '\n' +
    '  return {\n' +
    '    chamar,\n' +
    '    paginar,\n' +
    '    endpoints: ENDPOINTS,\n' +
    '    getTraces: () => [...traces],\n' +
    '  };\n' +
    '}\n' +
    '\n' +
    'module.exports = {\n' +
    '  ENDPOINTS,\n' +
    '  OmieApiError,\n' +
    '  criarOmieClient,\n' +
    '  normalizarCall,\n' +
    '  normalizarErroResposta,\n' +
    '  sanitizarValor,\n' +
    '};\n'
  
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/integration-architecture.test.js:90:10)
      at Test.runInAsyncScope (node:async_hooks:206:9)
      at Test.run (node:internal/test_runner/test:796:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:526:18)
      at Test.postRun (node:internal/test_runner/test:889:19)
      at Test.run (node:internal/test_runner/test:835:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:526:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: '"use strict";\n\nconst { sanitizarErro } = require("./omieUtils");\n\nconst ENDPOINTS = Object.freeze({\n  clientes: "https://app.omie.com.br/api/v1/geral/clientes/",\n  categorias: "https://app.omie.com.br/api/v1/geral/categorias/",\n  contasCorrentes: "https://app.omie.com.br/api/v1/geral/contacorrente/",\n  contasPagar: "https://app.omie.com.br/api/v1/financas/contapagar/",\n});\n\nclass OmieApiError extends Error {\n  constructor(message, opcoes = {}) {\n    super(message);\n    this.name = "OmieApiError";\n    this.statusCode = opcoes.statusCode;\n    this.code = opcoes.code;\n    this.retryable = Boolean(opcoes.retryable);\n    this.response = opcoes.response;\n    this.trace = opcoes.trace;\n    this.traces = opcoes.traces;\n  }\n}\n\nfunction numeroEnv(nome, padrao) {\n  const valor = Number(process.env[nome]);\n  return Number.isFinite(valor) && valor > 0 ? valor : padrao;\n}\n\nfunction dormir(ms) {\n  return new Promise((resolve) => setTimeout(resolve, ms));\n}\n\nfunction deveRepetir(statusCode, erro) {\n  return [408, 425, 429, 500, 502, 503, 504].includes(statusCode)\n    || erro?.name === "AbortError"\n    || ["ECONNRESET", "ETIMEDOUT"].includes(erro?.code);\n}\n\nfunction sanitizarValor(valor, nivel = 0) {\n  if (valor == null || typeof valor === "number" || typeof valor === "boolean") return valor;\n  if (typeof valor === "string") return valor.length > 2000 ? `${valor.slice(0, 2000)}…` : valor;\n  if (nivel >= 5) return "[profundidade limitada]";\n  if (Array.isArray(valor)) {\n    return {\n      total: valor.length,\n      amostra: valor.slice(0, 10).map((item) => sanitizarValor(item, nivel + 1)),\n      limitada: valor.length > 10,\n    };\n  }\n  if (typeof valor === "object") {\n    const segredo = /app[_-]?key|app[_-]?secret|authorization|token|senha|password/i;\n    return Object.fromEntries(\n      Object.entries(valor)\n        .filter(([chave]) => !segredo.test(chave))\n        .slice(0, 40)\n        .map(([chave, item]) => [chave, sanitizarValor(item, nivel + 1)]),\n    );\n  }\n  return String(valor);\n}\n\nfunction normalizarErroResposta(body, statusCode) {\n  const code = body?.faultcode ?? body?.code ?? body?.codigo_status;\n  const description = body?.faultstring ?? body?.description ?? body?.descricao_status;\n  if (!description && statusCode >= 200 && statusCode < 300) return null;\n  const sucesso = String(code ?? "0") === "0";\n  if (statusCode >= 200 && statusCode < 300 && sucesso && !body?.faultstring) return null;\n  return new OmieApiError(description || `Omie retornou HTTP ${statusCode}.`, {\n    statusCode,\n    code,\n    retryable: deveRepetir(statusCode),\n    response: body,\n  });\n}\n\nfunction normalizarCall(endpoint, call) {\n  // Cliente/Prestador já existe no Omie e deve ser alterado explicitamente.\n  // A proteção no transporte impede que um fluxo residual execute UpsertCliente.\n  if (endpoint === "clientes" && call === "UpsertCliente") return "AlterarCliente";\n  return call;\n}\n\nfunction criarOmieClient(opcoes = {}) {\n  const appKey = opcoes.appKey || process.env.OMIE_APP_KEY;\n  const appSecret = opcoes.appSecret || process.env.OMIE_APP_SECRET;\n  const timeoutMs = opcoes.timeoutMs || numeroEnv("OMIE_TIMEOUT_MS", 30000);\n  const maxTentativas = opcoes.maxTentativas || numeroEnv("OMIE_HTTP_ATTEMPTS", 3);\n  const maxTraces = numeroEnv("OMIE_TRACE_LIMIT", 100);\n  const fetchImpl = opcoes.fetchImpl || globalThis.fetch;\n  const traces = [];\n\n  if (!appKey || !appSecret) {\n    throw new OmieApiError("Configure OMIE_APP_KEY e OMIE_APP_SECRET.");\n  }\n  if (typeof fetchImpl !== "function") {\n    throw new OmieApiError("O runtime não oferece fetch para chamar a API Omie.");\n  }\n\n  function registrarTrace(trace) {\n    if (traces.length < maxTraces) traces.push(trace);\n    if (typeof opcoes.onTrace === "function") opcoes.onTrace(trace);\n  }\n\n  async function chamar(endpoint, call, param = [{}]) {\n    const url = ENDPOINTS[endpoint] || endpoint;\n    const callEfetivo = normalizarCall(endpoint, call);\n    const parametros = Array.isArray(param) ? param : [param];\n    const envelope = {\n      app_key: appKey,\n      app_secret: appSecret,\n      call: callEfetivo,\n      param: parametros,\n    };\n    let ultimoErro;\n\n    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {\n      const iniciouEm = new Date();\n      const trace = {\n        endpoint,\n        url,\n        call: callEfetivo,\n        tentativa,\n        iniciouEm,\n        request: { call: callEfetivo, param: sanitizarValor(parametros) },\n      };\n      const controller = new AbortController();\n      const timer = setTimeout(() => controller.abort(), timeoutMs);\n\n      try {\n        const resposta = await fetchImpl(url, {\n          method: "POST",\n          headers: { "content-type": "application/json", accept: "application/json" },\n          body: JSON.stringify(envelope),\n          signal: controller.signal,\n        });\n        trace.httpStatus = resposta.status;\n        const texto = await resposta.text();\n        let body;\n        try {\n          body = texto ? JSON.parse(texto) : {};\n        } catch {\n          trace.response = { texto: sanitizarValor(texto) };\n          throw new OmieApiError("Resposta inválida da API Omie.", {\n            statusCode: resposta.status,\n            retryable: resposta.status >= 500,\n          });\n        }\n        trace.response = sanitizarValor(body);\n        const erroResposta = normalizarErroResposta(body, resposta.status);\n        if (erroResposta) throw erroResposta;\n        trace.status = "Sucesso";\n        trace.concluiuEm = new Date();\n        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();\n        registrarTrace(trace);\n        return body;\n      } catch (erro) {\n        trace.status = "Erro";\n        trace.erro = sanitizarErro(erro);\n        trace.response = trace.response || sanitizarValor(erro?.response || {});\n        trace.concluiuEm = new Date();\n        trace.duracaoMs = trace.concluiuEm.getTime() - iniciouEm.getTime();\n        registrarTrace(trace);\n\n        const retryable = erro instanceof OmieApiError\n          ? erro.retryable\n          : deveRepetir(erro?.statusCode, erro);\n        ultimoErro = erro instanceof OmieApiError\n          ? erro\n          : new OmieApiError(sanitizarErro(erro), { retryable, code: erro?.code });\n        ultimoErro.trace = trace;\n        ultimoErro.traces = [...traces];\n        if (!retryable || tentativa >= maxTentativas) throw ultimoErro;\n        await dormir(\n          Math.min(5000, 500 * (2 ** (tentativa - 1))) + Math.floor(Math.random() * 250),\n        );\n      } finally {\n        clearTimeout(timer);\n      }\n    }\n    throw ultimoErro;\n  }\n\n  async function paginar(endpoint, call, paramBase = {}, extrairItens) {\n    const itens = [];\n    let pagina = 1;\n    let totalPaginas = 1;\n    do {\n      const resposta = await chamar(endpoint, call, [{\n        ...paramBase,\n        pagina,\n        registros_por_pagina: Math.min(\n          100,\n          Number(paramBase.registros_por_pagina || 100),\n        ),\n      }]);\n      itens.push(...(extrairItens(resposta) || []));\n      totalPaginas = Number(resposta.total_de_paginas || resposta.totalDePaginas || 1);\n      pagina += 1;\n    } while (pagina <= totalPaginas);\n    return itens;\n  }\n\n  return {\n    chamar,\n    paginar,\n    endpoints: ENDPOINTS,\n    getTraces: () => [...traces],\n  };\n}\n\nmodule.exports = {\n  ENDPOINTS,\n  OmieApiError,\n  criarOmieClient,\n  normalizarCall,\n  normalizarErroResposta,\n  sanitizarValor,\n};\n',
    expected: /request: \{ call, param:/,
    operator: 'match'
  }

test at test/navigation-menu.test.js:14:1
✖ organiza o menu e direciona itens e pagamentos para as esteiras (11.718995ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected ... Lines skipped
  
    [
      {
  +     label: 'Clientes/Prestadores',
  -     label: 'Clientes Fornecedores',
        model: 'ClienteFornecedor',
        section: 'Cadastros'
  ...
      },
      {
  +     label: 'Categorias/Subcategorias',
  -     label: 'Categorias/SubCategorias',
        model: 'Categoria',
  ...
        section: 'Configurações'
      }
    ]
      at TestContext.<anonymous> (/home/runner/work/ss-eventos/ss-eventos/backend/test/navigation-menu.test.js:32:10)
      at async Test.run (node:internal/test_runner/test:797:9)
      at async Test.processPendingSubtests (node:internal/test_runner/test:526:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ { model: 'ClienteFornecedor', label: 'Clientes/Prestadores', section: 'Cadastros' }, { model: 'Projeto', label: 'Projetos', section: 'Operação' }, { model: 'Categoria', label: 'Categorias/Subcategorias', section: 'Configurações' }, { model: 'Responsavel', label: 'Responsáveis', section: 'Configurações' } ],
    expected: [ { model: 'ClienteFornecedor', label: 'Clientes Fornecedores', section: 'Cadastros' }, { model: 'Projeto', label: 'Projetos', section: 'Operação' }, { model: 'Categoria', label: 'Categorias/SubCategorias', section: 'Configurações' }, { model: 'Responsavel', label: 'Responsáveis', section: 'Configurações' } ],
    operator: 'deepStrictEqual'
  }
```
