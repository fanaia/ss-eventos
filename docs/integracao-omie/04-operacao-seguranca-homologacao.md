# 04 — Operação, segurança e homologação

## 1. Ambientes

A integração deve possuir configurações separadas para desenvolvimento/homologação e produção.

Regras:

- nunca reutilizar App Key/App Secret de produção em testes automatizados;
- cada ambiente deve apontar para sua própria configuração Omie e URL de webhook;
- credenciais não podem estar no repositório, manifesto frontend, imagens Docker ou logs;
- o frontend recebe apenas indicadores mascarados, nunca o App Secret;
- a ativação dos workers e webhooks deve ser controlada por feature flags.

Feature flags sugeridas:

- `OMIE_INTEGRATION_ENABLED`;
- `OMIE_CUSTOMER_SYNC_ENABLED`;
- `OMIE_REFERENCE_SYNC_ENABLED`;
- `OMIE_PAYABLE_EXPORT_ENABLED`;
- `OMIE_WEBHOOK_ENABLED`;
- `OMIE_RECONCILIATION_ENABLED`.

## 2. Segredos e proteção de dados

### 2.1 Segredos

- armazenar App Secret criptografado ou em Secret do ambiente;
- mascarar App Key parcialmente na interface e nos logs;
- permitir rotação sem perder o histórico;
- registrar quem alterou a configuração e quando, sem registrar o valor do segredo;
- token do webhook deve possuir entropia suficiente e ser rotacionável;
- não aceitar segredo por query string comum; preferir segmento secreto da URL e/ou cabeçalho quando a configuração do Omie permitir.

### 2.2 Payloads e logs

Aplicar sanitização antes de persistir ou registrar:

- `app_secret`;
- tokens;
- dados bancários;
- documentos pessoais quando não forem necessários para o diagnóstico;
- e-mails e telefones completos em logs de infraestrutura;
- corpos integrais de respostas de erro que possam conter dados sensíveis.

Logs devem conter:

- correlation ID;
- tipo de operação;
- ID interno da entidade;
- código de integração;
- método Omie;
- duração;
- resultado classificado;
- número da tentativa;
- próximo reprocessamento.

## 3. Agendamentos iniciais

Configuração conservadora sugerida:

| Processo | Frequência inicial |
|---|---|
| Formas de pagamento | diária e sob demanda |
| Categorias Omie | diária e sob demanda |
| Clientes/Fornecedores incrementais | a cada 15 minutos |
| Outbox de envio | contínua, respeitando fila e limites |
| Reconciliação de pagamentos recentes | a cada hora |
| Reconciliação ampliada | diária, últimos 7 dias |
| Varredura de pendências antigas | diária |

As frequências devem ser configuráveis. O worker não pode executar em paralelo sobre o mesmo agregado.

## 4. Webhook

Checklist de configuração:

1. publicar endpoint HTTPS;
2. criar token exclusivo por configuração;
3. cadastrar no aplicativo Omie os eventos financeiros confirmados na homologação;
4. validar entrega de evento de teste;
5. confirmar resposta HTTP 2XX após persistência na inbox;
6. simular duplicidade;
7. simular indisponibilidade e confirmar nova tentativa do Omie;
8. confirmar que a reconciliação recupera eventos não processados.

O endpoint deve:

- aceitar somente `POST`;
- impor limite de tamanho;
- validar `Content-Type` quando aplicável;
- aplicar rate limit defensivo sem bloquear o fluxo normal do Omie;
- persistir antes de responder;
- responder rapidamente;
- deduplicar eventos;
- nunca alterar diretamente o saldo sem passar pelo processador idempotente.

## 5. Runbooks de suporte

### 5.1 Credencial inválida

Sintomas:

- todas as chamadas falham;
- teste de conexão indica autenticação inválida;
- fila cresce sem processamento.

Ação:

1. desativar temporariamente novas tentativas automáticas;
2. validar App Key e App Secret no ambiente correto;
3. rotacionar o segredo quando necessário;
4. executar teste de conexão;
5. reativar workers;
6. reprocessar tickets pendentes por lote controlado.

### 5.2 HTTP 425/429 ou limite de consumo

Ação:

1. não repetir imediatamente;
2. aumentar backoff e reduzir concorrência;
3. identificar método com maior consumo;
4. verificar paginação e consultas repetidas;
5. respeitar `Retry-After`, quando retornado;
6. confirmar que não existe loop de sincronização.

### 5.3 Timeout no envio de Conta a Pagar

Ação automática:

1. marcar resultado como incerto;
2. consultar pelo `codigo_lancamento_integracao`;
3. se encontrado, vincular o código Omie e concluir;
4. se não encontrado, reagendar o mesmo upsert com a mesma chave;
5. nunca gerar outra chave para “resolver” o timeout.

### 5.4 Suspeita de título duplicado

1. bloquear novas tentativas do pagamento;
2. pesquisar pelo código de integração, código Omie, fornecedor, valor e vencimento;
3. não excluir automaticamente títulos;
4. registrar divergência;
5. corrigir com decisão humana no Omie;
6. vincular o título correto e auditar a correção.

### 5.5 Webhook em erro

1. verificar `WebhookInbox`;
2. classificar erro transitório ou de contrato;
3. corrigir mapeamento quando o evento mudou;
4. reprocessar a inbox, sem reenviar manualmente payload alterado;
5. executar reconciliação do período afetado.

### 5.6 Divergência entre Central e Omie

1. congelar edição do pagamento;
2. consultar título e movimentos atuais no Omie;
3. reconstruir baixas locais pelos identificadores externos;
4. recalcular total pago e pendente;
5. comparar valor contratado, títulos ativos e baixas;
6. registrar a causa: alteração manual, estorno, título duplicado, desconto, juros ou dado órfão;
7. liberar somente após a reconciliação ficar consistente.

### 5.7 Cancelamento/estorno

- baixa deve ser cancelada no Omie quando o Omie é a fonte da situação financeira;
- a Central recebe o evento ou detecta na reconciliação;
- a baixa local é marcada como estornada;
- saldo e card são recalculados;
- o pagamento volta à situação adequada;
- não apagar a baixa histórica.

## 6. Homologação funcional

### 6.1 Dados necessários

Criar no ambiente Omie de homologação:

- um fornecedor PJ;
- um fornecedor PF;
- um estrangeiro, caso a operação use;
- pelo menos duas categorias de despesa válidas;
- uma categoria inativa/totalizadora para teste de bloqueio;
- duas formas de pagamento;
- uma conta corrente quando exigida pelo fluxo;
- títulos de teste com baixa total, parcial e estorno.

### 6.2 Evidências obrigatórias

Para cada cenário, anexar ao PR de implementação:

- ID interno da Central;
- código de integração;
- código Omie;
- payload sanitizado;
- resposta sanitizada;
- screenshot da situação no Omie;
- screenshot da Central;
- resultado do teste automatizado relacionado;
- confirmação de inexistência de duplicidade.

## 7. Decisões pendentes antes da codificação financeira

Estas decisões não impedem a criação da infraestrutura de integração e das listas, mas devem ser formalizadas antes de ativar o envio de pagamentos:

1. **Origem do Contas a Pagar:** o MVP criará diretamente o título ou deverá gerar primeiro Pedido de Compra/Serviço Tomado/documento de origem?
2. **NF obrigatória:** todo pagamento exige `nfRecebida=true` ou a regra varia por categoria/tipo de custo?
3. **Conta corrente:** existe uma conta corrente padrão no Omie para previsão/pagamento?
4. **Formas de pagamento:** a lista de formas de compras será apenas planejamento ou precisará influenciar CNAB/PIX/boleto?
5. **Direção dos cadastros:** alterações de nome/endereço/contato feitas no Omie podem sobrescrever automaticamente a Central?
6. **Eventos de webhook:** quais eventos financeiros/baixas estão disponíveis e serão habilitados no aplicativo Omie da SS Eventos?
7. **Histórico:** quais pagamentos existentes devem ser enviados, se algum? A recomendação é não enviar automaticamente registros anteriores ao go-live.
8. **Múltiplas empresas Omie:** o MVP usa uma única App Key ou cada projeto/empresa pode apontar para uma configuração diferente?
9. **Cancelamento:** quem pode solicitar cancelamento de título/baixa e em qual sistema o processo começa?
10. **Parcelamento:** cada registro `Pagamento` será um título independente ou uma condição de pagamento poderá gerar várias parcelas automaticamente?

## 8. Go-live

### 8.1 Pré-requisitos

- backup/branch de referência disponível;
- credenciais de produção validadas;
- categorias relacionadas sem pendências;
- fornecedores necessários sincronizados;
- formas de pagamento sincronizadas;
- índices únicos ativos;
- workers com concorrência conservadora;
- webhook configurado e validado;
- reconciliação habilitada;
- painel de erros disponível;
- suporte N2/N3 com acesso ao runbook;
- testes de regressão e homologação aprovados.

### 8.2 Ativação gradual

1. ativar sincronização de listas;
2. ativar sincronização de Clientes/Fornecedores;
3. selecionar poucos pagamentos piloto;
4. ativar exportação apenas para os pilotos;
5. confirmar títulos, baixas e indicadores;
6. ampliar gradualmente;
7. manter reconciliação horária durante o período assistido.

### 8.3 Rollback operacional

Rollback não deve apagar dados já criados no Omie.

Procedimento:

1. desligar `OMIE_PAYABLE_EXPORT_ENABLED` e workers de escrita;
2. manter leitura/reconciliação se segura;
3. preservar outbox, inbox, códigos e evidências;
4. corrigir aplicação ou restaurar versão anterior da Central;
5. reconciliar títulos criados durante a janela;
6. reativar somente após validar idempotência.

## 9. Monitoramento pós-go-live

Durante o período assistido, acompanhar diariamente:

- quantidade de cadastros sincronizados e conflitos;
- títulos criados/alterados;
- tickets em erro;
- baixas recebidas por webhook e reconciliação;
- duplicidades detectadas;
- divergências financeiras;
- latência média de atualização;
- consumo e bloqueios da API;
- idade da fila.

Critérios para encerrar operação assistida:

- nenhuma duplicidade;
- nenhuma divergência não explicada;
- fila sem itens antigos;
- reconciliação executando no prazo;
- usuários conseguem identificar pago e pendente nos cards;
- suporte consegue resolver os cenários do runbook sem intervenção de desenvolvimento.