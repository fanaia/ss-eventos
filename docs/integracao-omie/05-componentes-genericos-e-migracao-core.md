# Componentes genéricos de Integrações e adaptador Omie

## Decisão arquitetural

A primeira implementação permanece na Central SS Eventos. A migração ao OonCore só ocorrerá depois da homologação funcional, operacional e de usabilidade.

Como a solução ainda está apenas em desenvolvimento, o código usa somente o contrato atual. Não são mantidas rotas, serviços, aliases ou campos de configuração de versões anteriores.

## Cadastros mestres Omie

A sincronização completa segue esta ordem:

1. Categorias Omie;
2. Contas Correntes Omie;
3. Clientes/Prestadores.

As três listas são sincronizadas com o Omie e não permitem criação, alteração ou exclusão manual.

### Categorias Omie

- sincronização por `ListarCategorias`;
- origem exclusiva no Omie;
- utilizada pelo campo `Categoria.omieCategoriaId`;
- categorias inativas, totalizadoras, de transferência ou marcadas para não exibir são rejeitadas no envio financeiro.

### Contas Correntes Omie

- sincronização por `ListarContasCorrentes`;
- origem exclusiva no Omie;
- utilizada pelo campo `Pagamento.omieContaCorrenteId`;
- contas inativas ou bloqueadas são rejeitadas;
- a conta é selecionada na criação ou edição de cada Pagamento.

### Clientes/Prestadores

- sincronização inbound por `ListarClientes`;
- gravação com `skipOmieOutbox`, evitando loop de retorno;
- relacionamento por código Omie, código de integração ou documento;
- registros externos podem ser importados sem documento ou com documento que não passe pelas validações locais, desde que tenham identificador Omie;
- as validações rígidas de CPF/CNPJ continuam válidas para cadastros criados localmente.

## Regra financeira

A Conta Corrente Omie não pertence à configuração da integração nem à Categoria/Subcategoria.

O envio de Contas a Pagar utiliza:

- **Categoria Omie:** relacionada à Categoria/Subcategoria do item;
- **Conta Corrente Omie:** selecionada diretamente no Pagamento.

### Resolução da Categoria Omie

1. procura primeiro na subcategoria do item;
2. usa a categoria pai como fallback;
3. valida se a Categoria Omie continua ativa e apta para lançamento.

### Resolução da Conta Corrente Omie

1. lê `Pagamento.omieContaCorrenteId`;
2. valida se a conta sincronizada continua ativa e não bloqueada;
3. impede a aprovação e o envio quando a conta não estiver selecionada ou válida.

O payload envia:

- `codigo_categoria`, com o código da Categoria Omie resolvida;
- `id_conta_corrente`, com o código da Conta Corrente Omie do pagamento.

Os códigos efetivamente enviados ficam registrados no pagamento para auditoria.

## Sincronização resiliente de Clientes/Prestadores

A execução anterior era interrompida pelo primeiro erro de persistência. Como os registros anteriores já tinham sido gravados, cada nova tentativa parecia sincronizar apenas um novo cadastro antes de falhar novamente.

O fluxo atual processa cada registro isoladamente:

1. recebe todas as páginas do Omie;
2. tenta persistir cada cadastro;
3. registra sucesso, criação, atualização, ausência de alteração, conflito, item ignorado ou erro;
4. continua com os registros seguintes mesmo quando um cadastro falha;
5. encerra como `Concluído com erros` quando houve erro ou conflito e como `Concluído` quando todos os registros foram tratados sem pendências.

Um erro fatal de API ou conectividade ainda encerra a execução como `Erro`.

## Rastreabilidade técnica

Cada execução armazena, sem App Key ou App Secret:

- endpoint lógico;
- URL chamada;
- operação Omie (`call`);
- número da tentativa;
- parâmetros enviados, sem credenciais;
- status HTTP;
- duração;
- resposta sanitizada e amostrada;
- erro técnico da chamada;
- resultado e erro de cada cadastro persistido.

Respostas com listas extensas guardam a quantidade total e uma amostra limitada. O número máximo de chamadas armazenadas por execução é configurado por `OMIE_TRACE_LIMIT`.

Na interface, o botão **Diagnóstico** e a aba **Histórico** exibem:

- resumo com processados, sucessos, criados, atualizados, conflitos, ignorados e erros;
- erros por registro;
- REQUEST e RESPONSE de cada chamada;
- resultado individual dos cadastros.

## Separação de responsabilidades

### Componente genérico

- registro de provedores, recursos e handlers;
- catálogo e histórico;
- outbox, lock e retentativas;
- arquivamento e reprocessamento;
- inbox persistente de webhooks;
- sincronização completa ordenada;
- persistência de requisições, respostas e erros técnicos.

### Adaptador Omie

- credenciais e cliente HTTP;
- catálogo de Categorias, Contas Correntes, Clientes/Prestadores e Contas a Pagar;
- mapeamentos da API Omie;
- importação dos cadastros mestres;
- envio e reconciliação de Contas a Pagar;
- webhook financeiro;
- frontend operacional.

## Frontend e navegação

### Configurações

Mantém os cadastros internos:

- Categorias/Subcategorias;
- Responsáveis.

O modal de Categoria/Subcategoria contém:

1. aba `Dados`;
2. aba `Integração Omie`, apenas com Categoria Omie.

### Pagamentos

A Conta Corrente Omie é selecionada:

- na ação de gerar pagamento;
- no grid relacionado de pagamentos do item;
- na coleção e na esteira de Pagamentos.

A lista é filtrada para contas ativas e não bloqueadas.

### Integrações

Contém:

- Omie;
- Fila de integrações;
- Eventos recebidos.

A página Omie é organizada nas abas:

1. Visão geral;
2. Cadastros sincronizados;
3. Financeiro;
4. Histórico;
5. Webhooks.

Categorias Omie, Contas Correntes e Clientes/Prestadores podem ser consultados em modais somente leitura. Não existe seleção de conta corrente na página da integração.

## Rotas atuais

### Genéricas

- `GET /integracoes/provedores`
- `GET /integracoes/catalogo?provider=omie`
- `GET /integracoes/historico?provider=omie`
- `POST /integracoes/provedores/:provider/recursos/:resource/sincronizar`
- `POST /integracoes/provedores/:provider/sincronizar-tudo`
- `POST /integracoes/fila/processar`
- `POST /integracoes/fila/:id/arquivar`
- `POST /integracoes/fila/:id/reprocessar`

### Omie

- `GET /integracoes/omie/configuracao`
- `PUT /integracoes/omie/configuracao`
- `POST /integracoes/omie/testar-conexao`
- `GET /integracoes/omie/listas/clientes-prestadores`
- `GET /integracoes/omie/listas/categorias`
- `GET /integracoes/omie/listas/contas-correntes`
- `POST /integracoes/omie/pagamentos/:id/enviar`
- `POST /integracoes/omie/pagamentos/:id/reconciliar`
- `POST /integracoes/omie/webhooks/:token`

## Critérios para homologação

1. sincronizar Categorias Omie e confirmar bloqueio de edição;
2. sincronizar Contas Correntes e confirmar bloqueio de edição;
3. importar Clientes/Prestadores e confirmar que um registro inválido não interrompe os demais;
4. conferir endpoint, request, response e erros no Diagnóstico;
5. confirmar que App Key, App Secret e tokens não aparecem no histórico;
6. relacionar Categoria Omie na categoria ou subcategoria;
7. selecionar Conta Corrente Omie em cada pagamento;
8. confirmar prioridade da subcategoria e fallback da categoria pai para Categoria Omie;
9. bloquear aprovação e envio quando a conta do pagamento estiver ausente ou inválida;
10. validar `codigo_categoria` e `id_conta_corrente` no payload real;
11. testar fila, retentativas, webhook, baixa total, parcial e estorno;
12. validar responsividade, abas, modais, filtros e estados vazios;
13. executar testes do backend e build do frontend com acesso aos pacotes privados.

## Migração ao OonCore

1. estabilizar na SS Eventos;
2. validar a base genérica com um segundo provedor ou adaptador simulado;
3. extrair arquivos sem referências ao domínio da Central;
4. publicar os contratos equivalentes no OonCore;
5. adaptar a SS Eventos para consumir o Core;
6. remover as cópias locais somente após regressão completa.
