# 02 — Arquitetura, dados e contratos

## 1. Diagnóstico do estado atual

O projeto já possui:

- `ClienteFornecedor` com classificação Cliente/Fornecedor, tipo, documento e status;
- `Categoria` com hierarquia pai/filho;
- `FormaPagamento` interna, com forma padrão e status;
- `Pagamento` relacionado a projeto e item, com previsão, forma, valor, responsável, NF e etapa;
- geração de pagamentos limitada ao saldo da contratação;
- esteiras separadas de itens e pagamentos;
- frontend declarativo com ajustes aplicados em tempo de execução sobre `central.ui.json`.

Lacunas para a integração:

- não há configuração/credenciais Omie;
- os cadastros não armazenam códigos Omie e estado de sincronização;
- formas de pagamento ainda são mantidas localmente;
- categorias não possuem relacionamento financeiro com o Omie;
- pagamentos não armazenam código do título, baixas, total pago ou erro de integração;
- não há inbox de webhook, outbox/ticket de integração ou reconciliação financeira;
- o saldo atual considera pagamentos planejados, mas ainda não diferencia título enviado, baixa e estorno.

## 2. Arquitetura proposta

```text
Domínio SS Eventos
    │
    ├── grava alteração local
    ├── valida regras de negócio
    └── cria IntegrationOutbox/Ticket
             │
             ▼
       OmieIntegrationWorker
             │
             ├── OmieClient (POST JSON)
             ├── retry/backoff/rate limit
             └── salva códigos e evidências

Omie Webhook ──► WebhookInbox ──► WebhookProcessor ──► Domínio/baixas/status
                                   ▲
                                   │
                         ReconciliationJob
```

Princípios:

1. O domínio nunca chama o Omie de forma síncrona dentro da gravação principal.
2. O worker opera com idempotência e bloqueio por entidade.
3. Webhook é inbox persistente; não processar regras complexas durante a requisição HTTP.
4. Reconciliação é obrigatória, não opcional.
5. Credenciais são por instância/empresa Omie e não podem aparecer em logs.
6. O adaptador Omie fica no backend da Central nesta fase, com interfaces preparadas para futura extração para um pacote/conector do OonCore.

## 3. Componentes sugeridos

### 3.1 Configuração

`OmieConfiguracao`

| Campo | Tipo | Regra |
|---|---|---|
| `nome` | string | identificação do ambiente/empresa |
| `appKey` | string protegido | obrigatório |
| `appSecretEncrypted` | string protegido | nunca retornado em metadata/listas |
| `ativo` | boolean | apenas uma configuração ativa no MVP |
| `ambiente` | enum | `homologacao` ou `producao` |
| `webhookSecret` | string protegido | segredo próprio para validar a URL, quando suportado pelo desenho do endpoint |
| `ultimaSincronizacaoCadastrosEm` | datetime | cursor operacional |
| `ultimaReconciliacaoFinanceiraEm` | datetime | cursor operacional |
| `statusConexao` | enum | não testado, ok, erro |
| `ultimoErroConexao` | string sanitizada | sem segredos |

A tela deve mascarar `appSecret` e permitir testar conexão sem persistir payloads sensíveis.

### 3.2 Espelhos Omie

`OmieCategoria`

- `codigo` único;
- `descricao`;
- `natureza`;
- `tipoCategoria`;
- `categoriaSuperiorCodigo`;
- `totalizadora`;
- `transferencia`;
- `contaInativa`;
- `payloadHash`;
- `sincronizadoEm`.

`FormaPagamento` — novos campos

- `codigoOmie` único;
- `quantidadeParcelas`;
- `listaParcelas`;
- `diasParcela`;
- `origem = "Omie"`;
- `sincronizadoEm`;
- `padraoCentral` (mantém a escolha local da forma padrão).

### 3.3 Campos de integração nos modelos existentes

`ClienteFornecedor`

- `codigoClienteOmie`;
- `codigoClienteIntegracao`;
- `omieSincronizadoEm`;
- `omieAtualizadoEm`;
- `omieStatusIntegracao` (`Pendente`, `Sincronizado`, `Conflito`, `Erro`);
- `omieUltimoErro` sanitizado;
- `omiePayloadHash`;
- `omieVersaoLocalSincronizada`.

`Categoria`

- `omieCategoriaId` ref opcional;
- `omieCategoriaHerdada` calculado/readonly;
- `exigirCategoriaOmie` boolean, padrão verdadeiro quando usada em pagamentos.

`Pagamento`

- `codigoLancamentoIntegracao` único;
- `codigoLancamentoOmie`;
- `omieCodigoCategoriaEnviado`;
- `omieCodigoClienteFornecedorEnviado`;
- `omieNumeroDocumentoEnviado`;
- `omieValorTitulo`;
- `omieValorPago`;
- `omieValorPendente`;
- `omieDataUltimaBaixa`;
- `omieLiquidado` boolean;
- `omieStatusIntegracao` (`NaoEnviado`, `Pendente`, `Processando`, `Enviado`, `Erro`, `Cancelado`);
- `omieUltimoErro` sanitizado;
- `omieUltimaSincronizacaoEm`;
- `omiePayloadHash`;
- `canceladoNaCentral` boolean.

`OmieBaixaPagamento`

- `pagamentoId`;
- `codigoLancamentoOmie`;
- `codigoBaixaOmie` único;
- `codigoBaixaIntegracao` quando disponível;
- `dataBaixa`;
- `valorBaixado`;
- `desconto`;
- `juros`;
- `multa`;
- `valorEfetivo`;
- `estornada`;
- `estornadaEm`;
- `origemEvento` (`Webhook`, `Reconciliacao`, `Manual`);
- `payloadHash`;
- timestamps.

### 3.4 Outbox/tickets

`IntegrationOutbox` ou ticket padrão do OonCore:

- `tipo`: `OMIE_CLIENTE_UPSERT`, `OMIE_CLIENTES_IMPORTAR`, `OMIE_FORMAS_IMPORTAR`, `OMIE_CATEGORIAS_IMPORTAR`, `OMIE_CONTA_PAGAR_UPSERT`, `OMIE_FINANCEIRO_RECONCILIAR`;
- `aggregateType` e `aggregateId`;
- `idempotencyKey` única;
- `payload` mínimo e sem segredo;
- `status`: pendente, processando, concluído, erro temporário, erro definitivo;
- `tentativas`;
- `proximaTentativaEm`;
- `lockedAt`, `lockedBy`;
- `ultimoErro` sanitizado;
- `responseSummary`;
- timestamps.

Chaves sugeridas:

- cliente: `omie:cliente:<clienteFornecedorId>:<versao>`;
- pagamento: `omie:conta-pagar:<pagamentoId>`;
- sincronização de lista: `omie:sync:<dominio>:<janela>`.

## 4. Cliente HTTP Omie

Todas as chamadas são HTTP `POST`, com JSON:

```json
{
  "app_key": "***",
  "app_secret": "***",
  "call": "NomeDoMetodo",
  "param": [{}]
}
```

Responsabilidades do `OmieClient`:

- montagem do envelope;
- timeout configurável;
- mascaramento de credenciais;
- classificação de erros;
- retry com backoff e jitter;
- controle de concorrência por App Key + método;
- paginação;
- telemetria por método, duração e resultado;
- cache para evitar consultas redundantes do mesmo ID dentro de 60 segundos.

Limites a respeitar:

- 960 requisições/minuto por IP;
- 240 requisições/minuto por IP + App Key + método;
- até 4 consultas simultâneas por IP + App Key + método;
- sem paralelismo para alteração do mesmo registro;
- máximo recomendado/permitido de 100 registros por página;
- evitar repetir a mesma consulta de ID em menos de 60 segundos.

Configuração inicial conservadora:

- concorrência de escrita: 1 por método;
- concorrência de leitura: 2 por método;
- 100 registros por página;
- timeout: 30 segundos;
- tentativas automáticas: 5;
- backoff aproximado: 1 min, 5 min, 15 min, 1 h, 6 h;
- HTTP 425/429: reagendar, nunca repetir em loop.

## 5. Contratos por fluxo

### 5.1 Upsert de Cliente/Fornecedor

Entrada interna:

```json
{
  "clienteFornecedorId": "...",
  "versao": 12
}
```

Mapeamento principal:

| Central | Omie |
|---|---|
| `_id` | `codigo_cliente_integracao` derivado |
| `documento` | `cnpj_cpf` ou `documento_exterior` |
| `nome` | `razao_social` e `nome_fantasia` |
| contato principal | `contato`, `email`, telefone |
| `cliente`/`fornecedor` | tags |
| `status=Inativo` | `inativo=S` |

Após sucesso:

- salvar `codigo_cliente_omie`;
- salvar hash do payload enviado;
- marcar sincronizado apenas se a versão local não tiver mudado durante o processamento.

### 5.2 Importação de categorias

- percorrer todas as páginas de `ListarCategorias`;
- upsert por `codigo`;
- marcar `seenAt` durante a execução;
- ao final, inativar espelhos não vistos, sem remover vínculos históricos;
- bloquear seleção de totalizadora, transferência ou inativa.

### 5.3 Importação de formas de pagamento

- percorrer `ListarFormasPagCompras`;
- upsert por `cCodigo`;
- mapear `cDescricao`, `nQtdeParc`, `cListaParc`, `nDiasParc`;
- preservar `padraoCentral` local;
- inativar não vistas ao final da sincronização.

### 5.4 Upsert de Conta a Pagar

Antes do envio, carregar novamente o pagamento e suas referências para evitar payload obsoleto.

Código de integração:

```text
SS-EVENTOS:PAGAMENTO:<ObjectId>
```

Nunca depender apenas do `numero_documento`, pois ele é visível e pode ser alterado.

Resposta persistida:

- código Omie;
- código de integração;
- status/código de retorno;
- data/hora;
- hash do payload;
- resumo sanitizado.

### 5.5 Webhook

Endpoint sugerido:

```text
POST /integracoes/omie/webhooks/:configId/:token
```

O nome exato dos eventos financeiros disponíveis deve ser confirmado no aplicativo Omie durante a homologação. A implementação não deverá acoplar regra de negócio ao texto do evento: haverá um mapeador `eventType -> handler` configurável/testável.

Fluxo do endpoint:

1. validar configuração e token da URL;
2. limitar tamanho do corpo;
3. gerar hash do payload;
4. deduplicar por identificador do evento ou hash + janela;
5. persistir em `WebhookInbox`;
6. responder 2XX;
7. processar de forma assíncrona.

`WebhookInbox`:

- `provider = Omie`;
- `eventType`;
- `externalEventId` quando presente;
- `payloadEncrypted` ou payload protegido;
- `payloadHash` único por janela;
- `receivedAt`;
- `status`;
- `attempts`;
- `processedAt`;
- `lastError`.

O processador deve sempre consultar/confirmar o estado atual do título quando o payload do evento não contiver informação suficiente.

## 6. Resolução de conflitos

### Clientes/Fornecedores

- somente Central alterada: enviar ao Omie;
- somente Omie alterado: importar para Central;
- ambos alterados: status `Conflito`, apresentar comparação por campo;
- campos Omie oficiais e códigos nunca podem ser editados localmente;
- resolução manual gera nova versão e novo ticket.

### Pagamentos

Após enviado, o valor e o favorecido não podem ser alterados livremente. Mudanças devem seguir:

1. verificar se há baixa;
2. se não há baixa, alterar o título existente;
3. se há baixa, bloquear alteração e exigir estorno/correção no Omie;
4. registrar toda decisão na auditoria.

## 7. Segurança e observabilidade

Nunca registrar:

- `app_secret`;
- token completo do webhook;
- dados bancários completos;
- payload bruto contendo segredo.

Métricas mínimas:

- chamadas por método e status;
- latência;
- tickets pendentes/erro;
- idade do ticket mais antigo;
- webhooks recebidos/processados/duplicados;
- divergências financeiras;
- tempo desde última sincronização/reconciliação.

Alertas:

- credencial inválida;
- mais de 10 tickets em erro definitivo;
- nenhum webhook recebido por período anormal, quando houver atividade;
- reconciliação atrasada;
- divergência de valor;
- bloqueio/rate limit recorrente.