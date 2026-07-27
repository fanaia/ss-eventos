# Componentes genéricos de Integrações e adaptador Omie

## Decisão arquitetural

A primeira implementação será homologada dentro da Central SS Eventos. Somente depois de validar comportamento, operação, segurança e usabilidade os componentes genéricos serão migrados para o OonCore.

Essa sequência reduz o risco de publicar no Core uma abstração incompleta ou excessivamente acoplada ao Omie.

## Separação de responsabilidades

### Componente `integrations` genérico

Responsável por capacidades comuns a qualquer provedor:

- registro de provedores e recursos;
- catálogo de sincronizações;
- outbox idempotente;
- processamento de fila, lock e retentativas;
- arquivamento e reprocessamento de erros;
- inbox persistente de webhooks;
- histórico de execuções por recurso;
- indicadores e farol visual;
- esteiras de integrações e eventos recebidos;
- contratos de rotas independentes do provedor.

Principais contratos:

- `provider`: identificador do provedor, como `omie`;
- `resource`: recurso funcional, como `clientes-prestadores`;
- `operation`: operação funcional, como `sync`, `webhook` ou `reconcile`;
- `handler`: operação técnica registrada pelo adaptador;
- `idempotencyKey`: chave determinística para impedir duplicidade.

### Componente `integrations/omie`

Responsável apenas pelo que é específico do Omie:

- App Key, App Secret e token de webhook;
- cliente HTTP e tratamento dos erros da API;
- endpoints e chamadas do Omie;
- mapeamentos de clientes, categorias, formas de pagamento e contas a pagar;
- definição dos recursos disponíveis;
- handlers do Omie registrados no runtime genérico;
- regras da SS Eventos ligadas ao Omie;
- ajustes de telas e campos específicos do Omie.

## Estrutura implementada

### Backend

```text
backend/src/integrations/
  registry.js              # registro de provedores, recursos e handlers
  runtime.js               # fila, lock, retentativas, arquivamento e reprocessamento
  history.js               # histórico persistente e catálogo da última execução
  omie/
    register.js            # adaptador do Omie

backend/src/models/
  IntegrationOutbox.js     # fila genérica
  WebhookInbox.js          # inbox genérica
  IntegrationExecution.js  # histórico genérico

backend/src/routes/
  integrations.js          # contratos genéricos
```

### Frontend

```text
frontend/src/integrations/
  base.js                   # histórico, esteira e eventos genéricos
  components.tsx            # farol e componentes reutilizáveis
  omie.js                   # composição do provedor Omie
```

## Rotas genéricas

- `GET /integracoes/provedores`
- `GET /integracoes/catalogo?provider=omie`
- `GET /integracoes/historico?provider=omie`
- `POST /integracoes/provedores/:provider/recursos/:resource/sincronizar`
- `POST /integracoes/fila/processar`
- `POST /integracoes/fila/:id/arquivar`
- `POST /integracoes/fila/:id/reprocessar`

As rotas antigas em `/integracoes/omie` permanecem durante a transição para evitar regressões.

## Compatibilidade

Tickets antigos que possuem apenas `tipo` continuam processáveis. O runtime usa `handler` quando disponível e usa `tipo` como fallback.

Os novos registros passam a persistir também `provider`, `resource` e `operation`, preparando a futura convivência com outros provedores.

## Critérios para migração ao OonCore

A migração só deve ocorrer depois de homologar:

1. sincronização manual de cada recurso;
2. processamento automático pelo worker;
3. idempotência e ausência de duplicidades;
4. retentativas e classificação de erro definitivo;
5. arquivamento e reprocessamento;
6. recepção e deduplicação de webhooks;
7. histórico e catálogo da última execução;
8. segurança de credenciais e ausência de segredos nos logs;
9. comportamento com registros legados;
10. experiência da interface com pelo menos um segundo provedor simulado.

## Estratégia de migração

1. estabilizar na SS Eventos;
2. extrair os arquivos genéricos sem referências ao domínio da Central;
3. publicar contratos equivalentes no backend e frontend do OonCore;
4. adaptar a SS Eventos para consumir os componentes do Core;
5. remover as cópias locais somente após regressão completa;
6. manter `integrations/omie` na Central ou em pacote próprio até existir necessidade comprovada de compartilhamento.
