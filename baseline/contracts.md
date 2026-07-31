# Contratos observáveis do golden master SS-Eventos

Referência congelada: `fanaia/ss-eventos@3f689bed834aab7dd024a8e31d37bf7623efae58`.

Este documento registra efeitos observáveis. Ele não autoriza refatoração, remoção ou migração para o OonCore.

## Identidade e runtime

- Central: `Ss Eventos` / `ss-eventos`.
- Ativação habilitada, `configurationVersion: 1`.
- OonCore backend `0.3.37` e frontend `0.3.39`.
- Collections e Pipelines estão habilitados; Integrations e Omie estão desabilitados no contrato do Core.
- A implementação técnica de integração permanece local e é parte do golden master.

## Domínio e metadata

Models funcionais mínimos:

- `ClienteFornecedor`, `Contato`;
- `Categoria`, `Responsavel`, `Estado`, `Cidade`;
- `Projeto`, `ProjetoItem`, `Pagamento`.

Models técnicos locais da integração:

- `OmieConfiguracao`, `OmieCategoria`, `OmieContaCorrente`, `OmieBaixaPagamento`;
- `IntegrationOutbox`, `IntegrationExecution`, `WebhookInbox`.

O manifesto `frontend/central.ui.json`, combinado com os preparadores em `frontend/src`, define navegação, coleções, formulários, abas, grids relacionados e esteiras. Os testes validam o contrato final preparado, não somente o JSON bruto.

## Regras financeiras

- `orcamentoTotal = quantidade × diárias × valor unitário`;
- `contratacaoTotal = quantidade × diárias × valor unitário`;
- Fee zero em `Agência Interna`;
- imposto sobre orçamento + Fee em `Agência`, sobre orçamento em `Agência Interna` e sobre Fee em `Faturamento Direto`;
- fechamento total = orçamento + Fee + imposto;
- lucro = orçamento − contratação + Fee;
- valores calculados enviados pelo cliente são descartados e recalculados no backend;
- arredondamento monetário em duas casas.

As entradas e saídas determinísticas estão em `baseline/fixtures/ss-eventos-anon.json`.

## Esteiras e automação de pagamentos

- etapa automática de envio: `Enviado para Omie`;
- etapa automática de liquidação: `Pagamento Ok`;
- o envio é agendado somente ao entrar na etapa automática;
- etapas automáticas bloqueiam edição manual dos campos controlados;
- conciliação é o comando permitido na etapa `Enviado para Omie`;
- erro de automação move o status de trabalho para revisão;
- `Pagamento Ok` somente pode ser definido após baixa confirmada no Omie.

## API local de integrações

Prefixo privado: `/integracoes`. Perfis autorizados: `admin`, `desenvolvedor`.

| Método | Rota | Efeito observável |
| --- | --- | --- |
| GET | `/provedores` | lista providers registrados |
| GET | `/catalogo` | catálogo do provider com última execução |
| GET | `/historico` | histórico paginado e filtrável |
| POST | `/provedores/:provider/recursos/:resource/sincronizar` | sincronização individual; erro normalizado |
| POST | `/provedores/:provider/sincronizar-tudo` | execução ordenada; continua após erro; `200` ou `207` |
| POST | `/fila/processar` | processa outbox do provider |
| POST | `/fila/:id/arquivar` | arquiva ticket com auditoria |
| POST | `/fila/:id/reprocessar` | recoloca ticket para processamento |

Recursos Omie do catálogo:

1. `categorias`;
2. `contas-correntes`;
3. `clientes-prestadores`;
4. `contas-pagar` — fora da sincronização completa.

## Idempotência, retry e diagnóstico

- Outbox possui `idempotencyKey` única.
- Inbox de webhook possui hash do payload.
- Provider Omie admite no máximo cinco tentativas e classifica erros retryable.
- Importações continuam após erro individual e registram processados, sucessos, ignorados, conflitos, requests e errors.
- Credenciais são armazenadas como segredo criptografado e não integram diagnóstico, request, response ou UI.

## Webhook e reconciliação financeira

- saldo zero ou status liquidado representa baixa total;
- saldo positivo representa baixa parcial;
- cancelamento representa estorno/reabertura da pendência;
- eventos repetidos são tratados de forma idempotente;
- atualização local ocorre pelo próprio ticket de pagamento, sem rota manual paralela de envio.

## Publicação e ativação Dev

- workflow: push em `main`;
- solicitação: `oondemand/oon-publish/.github/workflows/request-dev.yml@main`;
- permissões: `contents: read` e `id-token: write`;
- o commit deve chegar a `main` por pull request;
- `oon.deploy.json` declara `appCode: ss-eventos`, runtime `ooncore-node-react` e readiness/version em `/api/ativacao/status`.

A referência ao workflow por branch mutável é um risco conhecido do golden master e não deve ser corrigida nesta Fase 0.
