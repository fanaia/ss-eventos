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
  OmieIntegrationPage.tsx   # página operacional única do Omie
```

## Padrão de usabilidade do frontend

A organização segue o modelo homologável iniciado em `fanaia/central-ss-eventos-3#12`.

A integração não deve ser apresentada como uma sequência de cadastros técnicos ou como um modal genérico. O usuário acessa uma página operacional única em **Configurações**, organizada nesta ordem:

1. cabeçalho com situação das credenciais e ativação da integração;
2. credenciais do aplicativo, status da conexão e ação de teste;
3. cartões de sincronização por recurso;
4. ação **Sincronizar tudo**, executando apenas os recursos que pertencem à carga mestre;
5. detalhes expansíveis da última execução;
6. histórico recente persistente;
7. atalhos para fila de integrações e eventos recebidos;
8. webhooks com URL completa e ação de copiar.

Regras de interface:

- cada recurso informa se nunca foi executado, está executando, concluiu ou falhou;
- os cartões mostram processados, criados e atualizados sem exigir abertura de outra tela;
- detalhes extensos ficam recolhidos por padrão;
- reconciliação financeira aparece como ação própria e não participa da sincronização completa;
- a coleção técnica `OmieConfiguracao` não aparece no menu;
- o histórico técnico completo continua disponível pelas APIs e esteiras, sem duplicar entradas de navegação;
- credenciais nunca são devolvidas ao frontend; campos já configurados aparecem apenas mascarados.

## Rotas genéricas

- `GET /integracoes/provedores`
- `GET /integracoes/catalogo?provider=omie`
- `GET /integracoes/historico?provider=omie`
- `POST /integracoes/provedores/:provider/recursos/:resource/sincronizar`
- `POST /integracoes/provedores/:provider/sincronizar-tudo`
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
2. sincronização completa na ordem configurada;
3. processamento automático pelo worker;
4. idempotência e ausência de duplicidades;
5. retentativas e classificação de erro definitivo;
6. arquivamento e reprocessamento;
7. recepção e deduplicação de webhooks;
8. histórico e catálogo da última execução;
9. segurança de credenciais e ausência de segredos nos logs;
10. comportamento com registros legados;
11. experiência da interface com pelo menos um segundo provedor simulado.

## Estratégia de migração

1. estabilizar na SS Eventos;
2. extrair os arquivos genéricos sem referências ao domínio da Central;
3. publicar contratos equivalentes no backend e frontend do OonCore;
4. adaptar a SS Eventos para consumir os componentes do Core;
5. remover as cópias locais somente após regressão completa;
6. manter `integrations/omie` na Central ou em pacote próprio até existir necessidade comprovada de compartilhamento.
