# Integração Omie — SS Eventos

Status: **MVP em implementação e homologação**  
Data da análise inicial: **27/07/2026**  
Estratégia: implementar e estabilizar na Central antes de migrar os componentes genéricos para o OonCore.

## Objetivo

Integrar a Central SS Eventos ao Omie para:

1. sincronizar Clientes/Fornecedores nos dois sistemas;
2. importar do Omie as formas de pagamento disponíveis;
3. importar as categorias financeiras do Omie e permitir o relacionamento com as categorias/subcategorias da Central;
4. enviar os pagamentos aprovados da Central ao Contas a Pagar do Omie;
5. registrar na Central as baixas totais, parciais e estornos realizados no Omie;
6. exibir no card do item o total contratado, o total pago e o valor pendente.

## Documentos

- [01 — Requisitos e regras de negócio](./01-requisitos-e-regras.md)
- [02 — Arquitetura, dados e contratos](./02-arquitetura-e-contratos.md)
- [03 — Plano de implementação e testes](./03-plano-implementacao-e-testes.md)
- [04 — Operação, segurança e homologação](./04-operacao-seguranca-homologacao.md)
- [05 — Componentes genéricos e migração ao OonCore](./05-componentes-genericos-e-migracao-core.md)

## Decisões principais

- **Componentes em duas camadas:** `integrations` contém fila, inbox, histórico e contratos genéricos; `integrations/omie` contém as regras e APIs do Omie.
- **Primeiro na Central:** a abstração será validada na SS Eventos antes de ser incorporada ao OonCore.
- **Chave de integração própria:** todos os registros enviados ao Omie usam códigos de integração determinísticos para permitir reprocessamento sem duplicidade.
- **Processamento assíncrono:** alterações locais geram tickets/outbox; a gravação do domínio não depende da disponibilidade imediata do Omie.
- **Webhook + reconciliação:** webhooks são o canal primário de retorno e uma rotina incremental detecta eventos não recebidos.
- **Fonte de verdade por campo:** a Central governa os dados operacionais; o Omie governa códigos, situação financeira, baixa e dados oficiais retornados pela API.
- **Histórico persistente:** cada sincronização registra provedor, recurso, duração, contadores, erro e uma amostra configurável dos itens.
- **Sem exclusão destrutiva:** cadastros já usados são inativados, nunca removidos automaticamente.

## APIs Omie consideradas

| Domínio | Endpoint | Métodos principais |
|---|---|---|
| Clientes/Fornecedores | `/api/v1/geral/clientes/` | `ListarClientes`, `ConsultarCliente`, `UpsertCliente` |
| Categorias | `/api/v1/geral/categorias/` | `ListarCategorias` |
| Formas de pagamento de compras | `/api/v1/produtos/formaspagcompras/` | `ListarFormasPagCompras` |
| Contas a Pagar | `/api/v1/financas/contapagar/` | `UpsertContaPagar`, `ConsultarContaPagar`, `ListarContasPagar`, `LancarPagamento`, `CancelarPagamento` |
| Pesquisa financeira | `/api/v1/financas/pesquisartitulos/` | `PesquisarLancamentos` |
| Movimentos financeiros | `/api/v1/financas/mf/` | `ListarMovimentos` |

Referências oficiais consultadas:

- https://developer.omie.com.br/service-list/
- https://app.omie.com.br/api/v1/geral/clientes/
- https://app.omie.com.br/api/v1/geral/categorias/
- https://app.omie.com.br/api/v1/produtos/formaspagcompras/
- https://app.omie.com.br/api/v1/financas/contapagar/
- https://app.omie.com.br/api/v1/financas/pesquisartitulos/
- https://app.omie.com.br/api/v1/financas/mf/
- https://ajuda.omie.com.br/pt-BR/articles/12607801-boas-praticas-de-integracao-com-as-apis-do-omie
- https://ajuda.omie.com.br/pt-BR/articles/8112984-limites-de-consumo-da-api-do-omie
- https://ajuda.omie.com.br/pt-BR/articles/9565655-caracteristicas-e-recomendacoes-dos-webhooks

## Fora do escopo desta fase

- faturamento de NFS-e/NF-e;
- criação de Pedido de Compra, Serviço Tomado ou documento fiscal de origem;
- execução bancária/CNAB/Omie.CASH;
- conciliação bancária automática;
- migração imediata dos componentes para o OonCore.

> Antes do go-live financeiro, deve ser confirmada com a SS Eventos a decisão entre criar diretamente o Contas a Pagar ou gerar primeiro um documento de origem no Omie. O MVP atual considera **Contas a Pagar direto**, mantendo o produtor do título substituível.
