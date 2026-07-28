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
- utilizada pelo campo `Categoria.omieContaCorrenteId`;
- contas inativas ou bloqueadas são rejeitadas no envio financeiro.

### Clientes/Prestadores

- sincronização inbound por `ListarClientes`;
- gravação com `skipOmieOutbox`, evitando loop de retorno;
- relacionamento por código Omie, código de integração ou documento;
- registros externos sem CPF/CNPJ podem ser importados quando possuem identificador Omie.

## Mapeamento financeiro por Categoria/Subcategoria

A conta corrente não pertence à configuração global da integração.

Cada Categoria/Subcategoria interna pode relacionar:

- uma Categoria Omie;
- uma Conta Corrente Omie.

No envio de Contas a Pagar, a resolução ocorre de forma independente para cada vínculo:

1. procura primeiro na subcategoria do item;
2. usa a categoria pai como fallback;
3. valida se os dois registros Omie continuam ativos e aptos para lançamento.

O payload envia:

- `codigo_categoria`, com o código da Categoria Omie resolvida;
- `id_conta_corrente`, com o código da Conta Corrente Omie resolvida.

Os valores efetivamente enviados ficam registrados no pagamento para auditoria.

## Separação de responsabilidades

### Componente genérico

- registro de provedores, recursos e handlers;
- catálogo e histórico;
- outbox, lock e retentativas;
- arquivamento e reprocessamento;
- inbox persistente de webhooks;
- sincronização completa ordenada.

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
2. aba `Integração Omie`, com Categoria Omie e Conta Corrente Omie.

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
3. importar Clientes/Prestadores e confirmar ausência de loop outbound;
4. relacionar Categoria Omie e Conta Corrente Omie em categoria e subcategoria;
5. confirmar prioridade da subcategoria e fallback da categoria pai;
6. bloquear envio quando qualquer vínculo estiver ausente, inativo ou inválido;
7. validar `codigo_categoria` e `id_conta_corrente` no payload real;
8. testar fila, retentativas, webhook, baixa total, parcial e estorno;
9. validar responsividade, abas, modais, filtros e estados vazios;
10. executar testes do backend e build do frontend com acesso aos pacotes privados.

## Migração ao OonCore

1. estabilizar na SS Eventos;
2. validar a base genérica com um segundo provedor ou adaptador simulado;
3. extrair arquivos sem referências ao domínio da Central;
4. publicar os contratos equivalentes no OonCore;
5. adaptar a SS Eventos para consumir o Core;
6. remover as cópias locais somente após regressão completa.
