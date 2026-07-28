# Falhas resumidas dos testes backend

- Instalação: `0`
- Testes: `1`
- Total de falhas identificadas: `13`

## Falha 1

✖ validação permite que o model limpe vínculo incompatível (3.681102ms)
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

## Falha 2

✖ backend cadastra formas de pagamento e preserva uma forma padrão ativa (2.508717ms)
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


## Falha 3

✖ pagamento usa referência configurada e mantém descrição histórica (5.316965ms)
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

## Falha 4

✖ frontend adiciona Configurações e usa selector nas entradas de pagamento (4.615204ms)
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

✔ componente genérico registra provedores e resolve handlers (2.020393ms)
✔ adaptador Omie expõe somente o contrato atual (0.292885ms)
✔ categoria define categoria Omie e pagamento define conta corrente (0.599292ms)
✔ configuração Omie contém apenas credenciais e conectividade (0.526489ms)
✔ pagamento não expõe rotas ou ações manuais de envio (0.591344ms)

## Falha 5

✖ sincronização continua após erro individual e guarda rastreabilidade (5.254866ms)
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

## Falha 6

✖ organiza o menu e direciona itens e pagamentos para as esteiras (16.288691ms)
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

✔ ordena as views por Cadastros, Operação, Financeiro e Configurações (1.499478ms)
✔ o bootstrap converte o manifesto, ordena as views e inicia o OonCore (0.359214ms)
✔ cliente Omie envia credenciais, mas o diagnóstico não as persiste (4.417381ms)
✔ sanitização remove segredos em objetos aninhados (0.986849ms)
✔ mensagens de erro não mantêm segredos em texto ou JSON (3.896465ms)

## Falha 7

✖ failing tests:

test at test/acoes-validacao-subcategoria.test.js:59:1

## Falha 8

✖ validação permite que o model limpe vínculo incompatível (3.681102ms)
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

## Falha 9

✖ backend cadastra formas de pagamento e preserva uma forma padrão ativa (2.508717ms)
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

## Falha 10

✖ pagamento usa referência configurada e mantém descrição histórica (5.316965ms)
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

## Falha 11

✖ frontend adiciona Configurações e usa selector nas entradas de pagamento (4.615204ms)
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

## Falha 12

✖ sincronização continua após erro individual e guarda rastreabilidade (5.254866ms)
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

## Falha 13

✖ organiza o menu e direciona itens e pagamentos para as esteiras (16.288691ms)
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
