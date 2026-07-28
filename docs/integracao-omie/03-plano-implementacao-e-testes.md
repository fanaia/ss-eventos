# 03 — Plano de implementação e testes

## 1. Estratégia de entrega

A integração deve ser implementada em incrementos pequenos, com cada etapa utilizável e testável isoladamente. Não alterar todos os fluxos financeiros em uma única entrega.

## 2. Fases

### Fase 0 — Preparação e proteção

- manter a branch de backup `backup/pre-integracao-omie-2026-07-27`;
- criar branch de implementação a partir de `main` somente após aprovação desta documentação;
- registrar versão dos pacotes OonCore usados no início do desenvolvimento;
- executar e registrar o resultado da suíte atual;
- criar dados de teste representativos de Cliente, Fornecedor, Categoria, Item e Pagamento;
- confirmar se o ambiente Omie de homologação está disponível.

Saída: baseline reproduzível, sem mudança funcional.

### Fase 1 — Configuração e cliente Omie

Implementar:

- modelo/tela `OmieConfiguracao`;
- criptografia/armazenamento seguro do App Secret;
- serviço `OmieClient`;
- teste de conexão;
- classificação de erros, timeout, retry, backoff e rate limit;
- logs sanitizados e métricas básicas.

Critério de saída: chamada de listagem simples funciona em homologação e nenhum segredo aparece em logs ou resposta de API.

### Fase 2 — Listas de referência

Implementar:

- `OmieCategoria`;
- novos campos da `FormaPagamento`;
- sincronização paginada de categorias;
- sincronização paginada de formas de pagamento;
- tela de execução manual e status da última sincronização;
- seleção da categoria Omie em Categoria/Subcategoria;
- bloqueio de categorias Omie inválidas para lançamento.

Critério de saída: listas locais reproduzem o Omie, preservam vínculos e ficam somente leitura, exceto a forma padrão da Central e o relacionamento de categoria.

### Fase 3 — Clientes/Fornecedores

Implementar:

- campos Omie em `ClienteFornecedor`;
- mapper Central → Omie;
- mapper Omie → Central;
- `UpsertCliente` idempotente;
- importação incremental;
- tags Cliente/Fornecedor;
- tratamento de conflito;
- tickets/outbox e reprocessamento.

Critério de saída: criar, alterar, inativar e importar cadastros sem duplicidade.

### Fase 4 — Envio do Contas a Pagar

Implementar:

- campos Omie em `Pagamento`;
- resolução da categoria Omie;
- validações de pré-condição;
- `codigo_lancamento_integracao` determinístico;
- worker `OMIE_CONTA_PAGAR_UPSERT`;
- persistência dos códigos de retorno;
- bloqueios de edição após envio;
- visualização do histórico de integração.

Critério de saída: um pagamento aprovado cria ou atualiza exatamente um título no Omie, mesmo após timeout/reprocessamento.

### Fase 5 — Webhook e baixas

Implementar:

- endpoint de webhook;
- `WebhookInbox` com deduplicação;
- mapeadores de eventos confirmados no aplicativo Omie;
- `OmieBaixaPagamento`;
- total pago, pendente e liquidado;
- tratamento de baixa parcial e cancelamento de baixa;
- rotina incremental de reconciliação.

Critério de saída: baixa, baixa parcial e estorno feitos no Omie atualizam a Central e podem ser reconstruídos pela reconciliação.

### Fase 6 — Indicadores e operação

Implementar:

- indicadores financeiros no card do item;
- badges de situação;
- filtros por status financeiro e integração;
- painel de erros/tickets;
- ação de reprocessar;
- ação de reconciliar pagamento individual;
- alertas e documentação de suporte.

Critério de saída: usuário identifica no card se está pago e quanto está pendente, sem abrir o pagamento.

## 3. Arquivos/áreas provavelmente afetados

Backend:

- `backend/src/models/ClienteFornecedor.js`;
- `backend/src/models/Categoria.js`;
- `backend/src/models/FormaPagamento.js`;
- `backend/src/models/Pagamento.js`;
- novos modelos de configuração, categoria Omie, baixa, inbox e outbox/ticket;
- novas rotas de configuração, sincronização, webhook, reprocessamento e reconciliação;
- serviços `omie/*`;
- validações de projetos/pagamentos;
- cálculos de saldo financeiro;
- testes unitários e de integração.

Frontend:

- `frontend/src/main.tsx` e cadeia de preparação do manifesto;
- `frontend/src/paymentMethodsAdjustments.js`;
- novos ajustes para configuração Omie, categorias e indicadores;
- esteira de pagamentos;
- card da esteira de itens;
- telas de erros e sincronização;
- testes do manifesto final, não apenas do JSON base.

A codificação deve alterar a fonte efetivamente consumida pelo runtime. O arquivo `central.ui.json` é transformado por módulos JavaScript/TypeScript; portanto, não basta editar somente o JSON sem validar o manifesto final.

## 4. Estratégia de testes

### 4.1 Unitários

#### Mapeadores

- PF, PJ e estrangeiro;
- Cliente, Fornecedor e ambos;
- tags sem duplicação;
- formatação de datas `dd/mm/aaaa`;
- truncamento seguro de campos;
- categoria explícita e herdada;
- forma de pagamento inativa;
- geração determinística dos códigos de integração.

#### Cálculos

- nenhum pagamento;
- pagamento planejado integral;
- múltiplas parcelas;
- baixa parcial;
- duas baixas parciais completando o título;
- desconto;
- juros e multa;
- estorno de uma das baixas;
- arredondamento de centavos;
- divergência entre contratado, títulos e baixas.

#### Estado

- transições válidas;
- bloqueio de envio sem fornecedor sincronizado;
- bloqueio sem categoria Omie;
- bloqueio de duplicidade;
- bloqueio de edição após baixa;
- reabertura após estorno.

### 4.2 Contrato do OmieClient

Usar servidor fake/mocks com respostas reais sanitizadas:

- sucesso com `codigo_status=0`;
- erro funcional retornado em HTTP 200;
- HTTP 400;
- HTTP 425;
- HTTP 429;
- timeout após o Omie ter gravado o título;
- JSON inválido;
- credencial inválida;
- página vazia;
- múltiplas páginas;
- resposta repetida para o mesmo registro.

Validar:

- classificação transitório/definitivo;
- backoff;
- limite de concorrência;
- mascaramento de credencial;
- consulta antes de repetir escrita após timeout.

### 4.3 Integração com banco

- índice único em códigos Omie e chaves de idempotência;
- dois workers disputando o mesmo ticket;
- webhook duplicado simultâneo;
- atualização local enquanto o ticket está em processamento;
- rollback lógico quando o domínio muda de versão;
- inativação de espelho não retornado na sincronização;
- preservação de histórico.

### 4.4 API/backend

- autenticação e RBAC;
- segredo nunca retornado;
- sincronização manual autorizada;
- webhook sem autenticação de usuário, mas protegido por token/configuração;
- tamanho máximo de payload;
- resposta 2XX após persistência;
- reprocessamento auditado;
- filtros por erro/status.

### 4.5 Frontend

- App Secret mascarado;
- listas Omie somente leitura;
- categoria Omie obrigatória e filtrada;
- forma de pagamento selecionável por referência;
- pagamento enviado com campos protegidos;
- card com contratado/pago/pendente;
- badges para parcial, pago, divergência e erro;
- responsividade e ausência de regressão nas abas atuais;
- manifesto final contém os novos campos e ações;
- ids não aparecem no lugar dos nomes.

### 4.6 End-to-end em homologação

Cenário A — Cliente/Fornecedor novo:

1. criar na Central;
2. aguardar ticket;
3. confirmar cadastro e tags no Omie;
4. alterar no Omie;
5. confirmar retorno para a Central.

Cenário B — Pagamento integral:

1. criar item com contratação de R$ 1.000,00;
2. gerar pagamento de R$ 1.000,00;
3. aprovar;
4. confirmar um único título no Omie;
5. baixar no Omie;
6. confirmar `Pago: R$ 1.000,00` e `Pendente: R$ 0,00` no card.

Cenário C — Pagamento parcelado:

1. item de R$ 1.000,00;
2. pagamentos de R$ 400,00 e R$ 600,00;
3. enviar ambos;
4. baixar apenas R$ 250,00 do primeiro;
5. confirmar pago R$ 250,00 e pendente R$ 750,00;
6. concluir as baixas e confirmar pago.

Cenário D — Timeout idempotente:

1. simular timeout após persistência no Omie;
2. reprocessar;
3. confirmar consulta pelo código de integração;
4. confirmar que continua existindo apenas um título.

Cenário E — Estorno:

1. baixar um título;
2. confirmar pago na Central;
3. cancelar a baixa no Omie;
4. confirmar reabertura do saldo.

Cenário F — Webhook perdido:

1. desabilitar temporariamente o endpoint;
2. realizar baixa no Omie;
3. executar reconciliação;
4. confirmar atualização da Central sem webhook.

## 5. Matriz mínima de regressão

Antes de cada merge:

- criar/editar ClienteFornecedor;
- validar CPF/CNPJ;
- criar Projeto;
- criar Item;
- cálculos de orçamento, contratação, fechamento e lucro;
- gerar pagamento limitado ao saldo;
- editar por abas;
- aprovar/recusar e alterar status de trabalho;
- grids e cards exibindo nomes;
- formas de pagamento por referência;
- esteiras de itens e pagamentos;
- build frontend;
- testes backend;
- verificação de documentação local do OonCore.

## 6. Critérios técnicos para merge

- cobertura dos mapeadores e cálculos críticos;
- nenhum segredo em fixture, log, snapshot ou PR;
- migrations/backfill documentados e testados;
- índices únicos criados antes de ativar workers;
- feature flag para envio financeiro;
- reconciliação disponível antes de ativar webhooks em produção;
- rollback operacional definido;
- evidência de homologação anexada ao PR;
- PR em draft até concluir a matriz de testes.

## 7. Backfill de dados existentes

Ordem:

1. sincronizar categorias Omie;
2. relacionar categorias da Central;
3. sincronizar formas de pagamento;
4. migrar `formaPagamento` textual para `formaPagamentoId` por descrição/código quando possível;
5. sincronizar Clientes/Fornecedores existentes, evitando duplicidade por CPF/CNPJ e confirmação humana para ambiguidades;
6. não enviar automaticamente pagamentos antigos;
7. marcar pagamentos existentes como `NaoEnviado` e permitir seleção explícita para integração;
8. recalcular os indicadores dos itens.

O backfill deve gerar relatório de:

- registros vinculados automaticamente;
- registros não encontrados;
- duplicidades;
- conflitos;
- pagamentos bloqueados por falta de categoria/fornecedor.