# 01 — Requisitos e regras de negócio

## 1. Escopo funcional

### 1.1 Clientes e fornecedores

A coleção `ClienteFornecedor` continuará sendo o cadastro operacional da Central, mas receberá os identificadores e o estado da integração com o Omie.

Regras:

1. O mesmo registro pode ser Cliente, Fornecedor ou ambos.
2. A classificação no Omie será representada por tags (`Cliente` e/ou `Fornecedor`) e não por duplicação de cadastro.
3. CPF/CNPJ será a chave de conferência humana, mas **não será a única chave técnica**, pois estrangeiros podem não ter CPF/CNPJ e documentos podem sofrer correção.
4. Depois do primeiro vínculo, a chave principal será `codigo_cliente_omie` + `codigo_cliente_integracao`.
5. O `codigo_cliente_integracao` será determinístico, no formato `SS-EVENTOS:CLIENTE_FORNECEDOR:<id-central>`.
6. Inclusões e alterações locais serão enviadas por `UpsertCliente`.
7. Importações do Omie usarão `ListarClientes` com paginação e filtros incrementais por data/hora quando disponíveis.
8. Em conflito, não sobrescrever silenciosamente dados operacionais. Registrar conflito e exigir revisão quando ambos os lados tiverem sido alterados após a última sincronização.
9. Registro inativo no Omie será marcado como inativo na Central apenas se não houver alteração local pendente.
10. Exclusões não serão propagadas. O comportamento será sempre inativação.

### 1.2 Formas de pagamento

A coleção interna `FormaPagamento` já existe e continuará sendo usada como referência pelos pagamentos. Ela passará a ser um espelho controlado da lista do Omie.

Regras:

1. A fonte da lista será `ListarFormasPagCompras`.
2. Cada forma terá `codigoOmie`, descrição, quantidade de parcelas, lista de vencimentos, dias de deslocamento, status e data da última sincronização.
3. O usuário não poderá criar ou excluir formas manualmente.
4. Será permitido escolher qual forma ativa é a padrão da Central, sem alterar o cadastro do Omie.
5. Formas removidas ou não retornadas pelo Omie serão inativadas, preservando os pagamentos históricos.
6. O pagamento continuará armazenando o vínculo `formaPagamentoId` e um snapshot textual da descrição.
7. A forma de pagamento de compras não deve ser confundida com `cnab_integracao_bancaria.codigo_forma_pagamento` (`TRA`, `BOL`, `PIX`). O segundo conceito só será usado se a execução bancária entrar no escopo futuro.
8. No MVP, a forma selecionada será informativa e de planejamento da Central. O lançamento direto no Contas a Pagar não possui um campo equivalente obrigatório para essa lista.

### 1.3 Categorias e subcategorias

A hierarquia própria da Central será preservada. Cada categoria/subcategoria poderá ser relacionada a uma categoria financeira do Omie.

Regras:

1. Importar a lista por `ListarCategorias`.
2. Armazenar em uma coleção própria `OmieCategoria`, sem misturar a árvore do Omie com a árvore operacional da Central.
3. Adicionar em `Categoria` o campo obrigatório `omieCategoriaId` para categorias usadas em pagamentos.
4. A relação poderá ser herdada: uma subcategoria sem relação explícita usa a categoria Omie da categoria pai.
5. Relação explícita na subcategoria prevalece sobre a relação herdada.
6. Categorias totalizadoras, inativas ou de transferência não poderão ser selecionadas para lançamentos, salvo regra específica validada em homologação.
7. Para Contas a Pagar, aceitar apenas categorias compatíveis com despesa/pagamento.
8. Alterar a relação não modifica pagamentos já enviados. Novos envios usam a relação vigente no momento do envio.
9. O código efetivamente enviado será copiado para o pagamento como snapshot (`omieCodigoCategoriaEnviado`).
10. Se não houver categoria Omie válida, o pagamento não poderá ser enviado.

### 1.4 Envio de pagamentos ao Omie

O registro `Pagamento` representa uma parcela/obrigação prevista da contratação do item.

Pré-condições para envio:

- pagamento em etapa `Aprovado`;
- projeto, item e fornecedor válidos;
- fornecedor sincronizado e com `codigoClienteOmie`;
- categoria/subcategoria relacionada a uma categoria Omie válida;
- valor maior que zero e não superior ao saldo contratado;
- data de vencimento/previsão válida;
- forma de pagamento ativa;
- NF recebida quando a regra do projeto exigir documento fiscal;
- nenhuma integração do mesmo pagamento em processamento.

Payload mínimo do `UpsertContaPagar`:

- `codigo_lancamento_integracao`: `SS-EVENTOS:PAGAMENTO:<id-pagamento>`;
- `codigo_cliente_fornecedor`: código Omie do fornecedor;
- `data_vencimento`: data prevista convertida para `dd/mm/aaaa`;
- `data_previsao`: mesma data, salvo configuração futura distinta;
- `valor_documento`: valor do pagamento;
- `codigo_categoria`: categoria Omie resolvida;
- `numero_documento`: identificador amigável do projeto/item/pagamento, limitado ao tamanho da API;
- `numero_parcela`: sequencial `001/003`, quando houver múltiplos pagamentos do item;
- `observacao`: referência à Central, projeto e item, sem dados sensíveis desnecessários.

Regras de idempotência:

1. Nunca gerar código aleatório a cada tentativa.
2. Repetir `UpsertContaPagar` com o mesmo código de integração.
3. Depois do sucesso, persistir `codigo_lancamento_omie` e a resposta completa sanitizada.
4. Se houver timeout após o envio, consultar pelo código de integração antes de tentar novamente.
5. Não criar um segundo título para corrigir o primeiro; alterar o título existente quando permitido.
6. Pagamento enviado não poderá ser excluído localmente. Poderá ser cancelado/estornado por fluxo controlado.

Transições:

- `Solicitado` → `Aprovado`: aprovação humana;
- `Aprovado` → `Aguardando NF`: quando a NF for obrigatória e ainda não recebida;
- `Aprovado`/`Aguardando NF` → `Enviado para Omie`: somente após confirmação do `UpsertContaPagar`;
- `Enviado para Omie` → `Pagamento Parcial`: quando houver baixa menor que o valor do título;
- `Enviado para Omie`/`Pagamento Parcial` → `Pagamento Ok`: total baixado igual ou superior ao valor devido, respeitando desconto/juros/multa;
- `Pagamento Ok` → `Pagamento Parcial` ou `Enviado para Omie`: se uma baixa for cancelada no Omie;
- qualquer etapa de integração → `Erro de Integração`: após esgotar tentativas automáticas e exigir ação humana.

### 1.5 Baixas, pagamentos parciais e estornos

A Central não deve considerar “pago” apenas pela existência do título no Omie.

Regras:

1. O status financeiro será calculado a partir das baixas/movimentos retornados pelo Omie.
2. Armazenar cada baixa identificada pelo `codigo_baixa` como registro imutável em `OmieBaixaPagamento`.
3. Uma baixa parcial soma ao total pago.
4. Desconto reduz o valor ainda devido conforme retorno do Omie; juros e multa aumentam o valor efetivamente desembolsado, mas não alteram o valor contratado do item.
5. Cancelamento de baixa marca a baixa como estornada e recalcula os totais.
6. Eventos repetidos não podem duplicar valores; `codigo_baixa` é chave única.
7. Webhook será processado rapidamente e responderá HTTP 2XX após validação mínima e persistência do evento na inbox.
8. Processamento de negócio acontecerá fora da requisição do webhook.
9. Reconciliação incremental consultará `ListarContasPagar`, `PesquisarLancamentos` e/ou `ListarMovimentos`, conforme o dado necessário e validado na homologação.
10. Uma reconciliação completa poderá ser executada manualmente por período e por pagamento.

### 1.6 Indicadores no card do item

O card da esteira de itens deverá exibir:

- `Contratado: R$ X`;
- `Pago: R$ Y`;
- `Pendente: R$ Z`;
- badge de situação financeira.

Situações:

| Situação | Regra |
|---|---|
| Sem pagamento | nenhum pagamento gerado |
| Pagamento pendente | pagamentos gerados, nenhum enviado |
| Enviado ao Omie | existe título no Omie, sem baixa |
| Parcialmente pago | `0 < totalPago < totalContratado` |
| Pago | `totalPago >= totalContratado` e não há estorno pendente |
| Divergência | total de títulos/baixas não fecha com o valor contratado |
| Erro de integração | existe ticket definitivo com erro |

Cálculos:

- `totalContratado = contratacaoTotal`;
- `totalPagamentosPlanejados = soma(valor dos pagamentos não cancelados)`;
- `totalEnviadoOmie = soma(valor dos títulos ativos vinculados)`;
- `totalPagoOmie = soma(valor baixado líquido das baixas não estornadas)`;
- `valorPendente = max(0, totalContratado - totalPagoOmie)`.

O saldo para gerar novos pagamentos deve considerar pagamentos planejados ainda não cancelados, evitando que a soma das parcelas ultrapasse o total contratado.

## 2. Permissões

- Configurar credenciais Omie: `desenvolvedor`/administrador técnico.
- Sincronizar listas: administrador técnico e job automático.
- Relacionar categorias: usuário financeiro autorizado.
- Aprovar pagamento: perfil definido pela esteira.
- Reprocessar integração: usuário financeiro autorizado ou suporte N2/N3.
- Consultar logs e payloads sanitizados: suporte/desenvolvedor.

## 3. Auditoria obrigatória

Auditar:

- alteração de credenciais sem registrar o segredo;
- sincronização manual;
- criação/alteração de vínculos Omie;
- mudança da categoria Omie relacionada;
- aprovação e envio de pagamento;
- reprocessamento;
- recebimento e processamento de webhook;
- detecção de baixa, baixa parcial e estorno;
- correção manual de conflito.

## 4. Critérios de aceite funcionais

1. Um Cliente/Fornecedor novo na Central é criado ou atualizado no Omie sem duplicidade.
2. Um cadastro alterado no Omie aparece na Central após webhook ou reconciliação.
3. A lista de formas de pagamento exibida é a lista sincronizada do Omie.
4. Toda categoria operacional usada por pagamento possui relação Omie válida.
5. Aprovar um pagamento gera exatamente um título no Omie.
6. Reprocessar a mesma integração não gera novo título.
7. Baixa total no Omie atualiza a Central para `Pagamento Ok`.
8. Baixa parcial atualiza valores pago e pendente corretamente.
9. Cancelar a baixa reabre o saldo na Central.
10. O card do item mostra valores consistentes com os pagamentos e baixas.
11. Falha temporária do Omie não impede salvar o domínio e é reprocessada automaticamente.
12. Falha definitiva fica visível e permite reprocessamento auditado.