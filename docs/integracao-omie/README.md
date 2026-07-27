# Integração Omie — SS Eventos

Status: **planejamento aprovado para codificação posterior**  
Data da análise: **27/07/2026**  
Escopo desta branch: documentação funcional, técnica, operacional e de testes. **Nenhuma integração foi codificada.**

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

## Decisões principais

- **Chave de integração própria:** todos os registros enviados ao Omie usarão códigos de integração determinísticos para permitir reprocessamento sem duplicidade.
- **Processamento assíncrono:** alterações locais gerarão tickets/outbox de integração; a gravação do domínio não dependerá da disponibilidade imediata do Omie.
- **Webhook + reconciliação:** webhooks serão o canal primário de retorno e uma rotina incremental será o mecanismo de segurança para detectar eventos não recebidos.
- **Fonte de verdade por campo:** a Central governa seus dados operacionais; o Omie governa códigos, situação financeira, baixa e dados oficiais retornados pela API.
- **Histórico imutável:** nomes exibidos poderão ser copiados como snapshot, mas todos os vínculos serão mantidos pelos códigos internos e pelos códigos Omie.
- **Sem exclusão destrutiva:** cadastros já usados serão inativados, nunca removidos automaticamente.

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
- alterações no OonCore.

> Antes de liberar a codificação, deve ser confirmada com a SS Eventos a decisão entre criar diretamente o Contas a Pagar ou gerar primeiro um documento de origem no Omie. O desenho desta documentação considera **Contas a Pagar direto como MVP**, mantendo a arquitetura preparada para trocar o produtor do título no futuro.