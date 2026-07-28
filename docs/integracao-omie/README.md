# Integração Omie — SS Eventos

Status: **MVP em implementação e homologação**  
Data da análise inicial: **27/07/2026**  
Estratégia: implementar e estabilizar na Central antes de migrar os componentes genéricos para o OonCore.

## Objetivo

Integrar a Central SS Eventos ao Omie para:

1. sincronizar Clientes/Prestadores nos dois sistemas;
2. importar as categorias financeiras do Omie e relacioná-las às categorias/subcategorias da Central;
3. importar as Contas Correntes Omie para seleção em cada Pagamento;
4. enviar os pagamentos aprovados da Central ao Contas a Pagar do Omie;
5. registrar na Central as baixas totais, parciais e estornos realizados no Omie;
6. exibir no card do item o total contratado, o total pago e o valor pendente;
7. oferecer diagnóstico técnico por execução, chamada e cadastro.

## Documentos

- [01 — Requisitos e regras de negócio](./01-requisitos-e-regras.md)
- [02 — Arquitetura, dados e contratos](./02-arquitetura-e-contratos.md)
- [03 — Plano de implementação e testes](./03-plano-implementacao-e-testes.md)
- [04 — Operação, segurança e homologação](./04-operacao-seguranca-homologacao.md)
- [05 — Componentes genéricos e migração ao OonCore](./05-componentes-genericos-e-migracao-core.md)

## Decisões principais

- **Componentes em duas camadas:** `integrations` contém fila, inbox, histórico e contratos genéricos; `integrations/omie` contém as regras e APIs do Omie.
- **Primeiro na Central:** a abstração será validada na SS Eventos antes de ser incorporada ao OonCore.
- **Categoria Omie no item:** Categoria/Subcategoria relaciona apenas a Categoria Omie.
- **Conta Corrente no pagamento:** cada Pagamento seleciona sua própria Conta Corrente Omie.
- **Chave de integração própria:** todos os registros enviados ao Omie usam códigos de integração determinísticos para permitir reprocessamento sem duplicidade.
- **Processamento assíncrono:** alterações locais geram tickets/outbox; a gravação do domínio não depende da disponibilidade imediata do Omie.
- **Webhook + reconciliação:** webhooks são o canal primário de retorno e uma rotina incremental detecta eventos não recebidos.
- **Fonte de verdade por campo:** a Central governa os dados operacionais; o Omie governa códigos, situação financeira, baixa e dados oficiais retornados pela API.
- **Histórico persistente:** cada sincronização registra endpoint, request, response, duração, contadores, erros e resultados por cadastro, sem persistir credenciais.
- **Processamento parcial:** um cadastro inválido não interrompe a importação dos demais.
- **Sem exclusão destrutiva:** cadastros já usados são inativados, nunca removidos automaticamente.

## APIs Omie consideradas

| Domínio | Endpoint | Métodos principais |
|---|---|---|
| Clientes/Fornecedores | `/api/v1/geral/clientes/` | `ListarClientes`, `ConsultarCliente`, `UpsertCliente` |
| Categorias | `/api/v1/geral/categorias/` | `ListarCategorias` |
| Contas Correntes | `/api/v1/geral/contacorrente/` | `ListarContasCorrentes` |
| Contas a Pagar | `/api/v1/financas/contapagar/` | `UpsertContaPagar`, `ConsultarContaPagar`, `ListarContasPagar`, `LancarPagamento`, `CancelarPagamento` |
| Pesquisa financeira | `/api/v1/financas/pesquisartitulos/` | `PesquisarLancamentos` |
| Movimentos financeiros | `/api/v1/financas/mf/` | `ListarMovimentos` |

## Fora do escopo desta fase

- meios/formas de pagamento do Omie;
- faturamento de NFS-e/NF-e;
- criação de Pedido de Compra, Serviço Tomado ou documento fiscal de origem;
- execução bancária/CNAB/Omie.CASH;
- conciliação bancária automática;
- migração imediata dos componentes para o OonCore.

> Antes do go-live financeiro, deve ser confirmada com a SS Eventos a decisão entre criar diretamente o Contas a Pagar ou gerar primeiro um documento de origem no Omie. O MVP atual considera **Contas a Pagar direto**, mantendo o produtor do título substituível.
