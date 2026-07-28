# Componentes genéricos de Integrações e adaptador Omie

## Decisão arquitetural

A primeira implementação permanece na Central SS Eventos. Somente depois da homologação funcional, operacional e de usabilidade os componentes genéricos serão migrados ao OonCore.

## Cadastros mestres Omie

A sincronização completa segue esta ordem:

1. Categorias Omie;
2. Contas Correntes Omie;
3. Clientes/Prestadores.

`Meios de pagamento` foi removido do catálogo e da sincronização completa. O modelo legado pode permanecer temporariamente para compatibilidade com registros existentes, mas não integra mais o contrato Omie desta Central.

### Categorias Omie

- origem exclusiva no Omie;
- lista somente leitura;
- sincronizada por `ListarCategorias`;
- `Categoria/Subcategoria` possui o campo `omieCategoriaId`;
- a subcategoria vinculada tem prioridade sobre a categoria pai;
- o código selecionado é enviado em `codigo_categoria`;
- categorias inativas, totalizadoras, de transferência ou marcadas para não exibir são rejeitadas.

### Contas Correntes Omie

- origem exclusiva no Omie;
- lista somente leitura;
- sincronizada por `ListarContasCorrentes`;
- uma conta ativa deve ser selecionada na configuração do provedor;
- o envio de Contas a Pagar é bloqueado sem conta válida;
- o identificador Omie é enviado em `id_conta_corrente`.

### Clientes/Prestadores

- sincronização inbound usa o endpoint oficial de Clientes/Fornecedores;
- mantém o alias homologado `POST /integracoes/omie/clientes-fornecedores/sincronizar`;
- a gravação inbound usa `skipOmieOutbox`, evitando loop de retorno;
- o vínculo prioriza código Omie, código de integração e documento;
- registros externos sem CPF/CNPJ podem ser importados quando possuem identificador Omie.

## Separação de responsabilidades

### Componente genérico

- registro de provedores, recursos e handlers;
- catálogo, histórico, fila, lock e retentativas;
- arquivamento e reprocessamento;
- inbox persistente de webhooks;
- contratos independentes do provedor.

### Adaptador Omie

- credenciais, endpoints e mapeamentos;
- catálogo de recursos;
- regras da SS Eventos para Contas a Pagar;
- sincronização dos cadastros mestres;
- experiência operacional do frontend.

## Frontend e navegação

### Configurações

Mantém apenas cadastros internos:

- Categorias/Subcategorias;
- Responsáveis.

Categorias/Subcategorias usa modal com as abas `Dados` e `Integração Omie`.

### Integrações

Contém os submenus:

- Omie;
- Fila de integrações;
- Eventos recebidos.

A página Omie é organizada nas abas:

1. Visão geral;
2. Cadastros sincronizados;
3. Financeiro;
4. Histórico;
5. Webhooks.

Modais são usados para credenciais, consulta de Clientes/Prestadores, Categorias Omie e seleção de Conta Corrente. As listas Omie não possuem edição manual.

## Rotas principais

### Genéricas

- `GET /integracoes/provedores`
- `GET /integracoes/catalogo?provider=omie`
- `GET /integracoes/historico?provider=omie`
- `POST /integracoes/provedores/:provider/recursos/:resource/sincronizar`
- `POST /integracoes/provedores/:provider/sincronizar-tudo`
- `POST /integracoes/fila/processar`
- `POST /integracoes/fila/:id/arquivar`
- `POST /integracoes/fila/:id/reprocessar`

### Omie e compatibilidade

- `GET /integracoes/omie/configuracao`
- `PUT /integracoes/omie/configuracao`
- `GET /integracoes/omie/listas/clientes-prestadores`
- `GET /integracoes/omie/listas/categorias`
- `GET /integracoes/omie/listas/contas-correntes`
- `POST /integracoes/omie/clientes-fornecedores/sincronizar`
- `POST /integracoes/omie/categorias/sincronizar`
- `POST /integracoes/omie/contas-correntes/sincronizar`
- `POST /integracoes/omie/pagamentos/:id/enviar`
- `POST /integracoes/omie/reconciliar`

## Critérios para homologação

1. sincronizar Categorias Omie e confirmar bloqueio de edição;
2. selecionar categoria Omie em categoria e subcategoria;
3. confirmar prioridade da subcategoria no payload;
4. sincronizar Contas Correntes e confirmar bloqueio de edição;
5. confirmar bloqueio do envio sem conta ativa;
6. importar Clientes/Prestadores usando o endpoint validado;
7. confirmar ausência de tickets outbound na importação inbound;
8. executar sincronização completa na ordem definida;
9. testar fila, retentativas, webhook, baixa total, parcial e estorno;
10. validar responsividade, abas, modais e estados vazios;
11. executar testes do backend e build do frontend com acesso aos pacotes privados.

## Migração ao OonCore

1. estabilizar na SS Eventos;
2. validar a base genérica com um segundo provedor ou adaptador simulado;
3. extrair os arquivos sem referências ao domínio da Central;
4. publicar contratos equivalentes no OonCore;
5. adaptar a SS Eventos para consumir o Core;
6. remover as cópias locais somente após regressão completa.
