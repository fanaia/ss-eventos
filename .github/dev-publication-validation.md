# Validação da publicação Dev

- Resultado: **REPROVADA**
- Commit validado: `7bb6537d63e56fac1999f4f8917cd30ba5e8df45`
- Backend — instalação: `0`
- Backend — testes: `1`
- Frontend — instalação: `0`
- Frontend — build: `0`

## Erro nos testes do backend
```text
  ...
# Subtest: usa fallback não vazio quando o Omie não informa nenhum campo de nome
ok 64 - usa fallback não vazio quando o Omie não informa nenhum campo de nome
  ---
  duration_ms: 1.457245
  ...
# Subtest: mapeia categoria e conta corrente do Omie
ok 65 - mapeia categoria e conta corrente do Omie
  ---
  duration_ms: 0.41673
  ...
# Subtest: gera conta a pagar idempotente e interpreta valor_pag como saldo pendente
ok 66 - gera conta a pagar idempotente e interpreta valor_pag como saldo pendente
  ---
  duration_ms: 1.025528
  ...
# Subtest: reconhece pagamento confirmado pelos status oficiais do Omie
ok 67 - reconhece pagamento confirmado pelos status oficiais do Omie
  ---
  duration_ms: 0.315721
  ...
# Subtest: integração usa outbox, inbox e chaves determinísticas
ok 68 - integração usa outbox, inbox e chaves determinísticas
  ---
  duration_ms: 2.461603
  ...
# Subtest: credenciais são criptografadas e não aparecem no diagnóstico
ok 69 - credenciais são criptografadas e não aparecem no diagnóstico
  ---
  duration_ms: 0.805837
  ...
# Subtest: categorias e contas correntes são listas Omie somente leitura
ok 70 - categorias e contas correntes são listas Omie somente leitura
  ---
  duration_ms: 0.483795
  ...
# Subtest: categoria define categoria Omie e pagamento define conta corrente
ok 71 - categoria define categoria Omie e pagamento define conta corrente
  ---
  duration_ms: 1.754472
  ...
# Subtest: Clientes e Prestadores processam todos os registros e detalham erros
ok 72 - Clientes e Prestadores processam todos os registros e detalham erros
  ---
  duration_ms: 0.712653
  ...
# Subtest: pagamento usa exclusivamente as etapas automáticas
ok 73 - pagamento usa exclusivamente as etapas automáticas
  ---
  duration_ms: 0.617925
  ...
# Subtest: não existem arquivos ou rotas de compatibilidade
ok 74 - não existem arquivos ou rotas de compatibilidade
  ---
  duration_ms: 0.653021
  ...
# Subtest: frontend usa Integrações, abas, modais e diagnóstico
ok 75 - frontend usa Integrações, abas, modais e diagnóstico
  ---
  duration_ms: 0.756695
  ...
# Subtest: calcula o valor pendente descontando pagamentos já gerados
ok 76 - calcula o valor pendente descontando pagamentos já gerados
  ---
  duration_ms: 1.83409
  ...
# Subtest: não retorna saldo negativo quando pagamentos atingem o total
ok 77 - não retorna saldo negativo quando pagamentos atingem o total
  ---
  duration_ms: 0.184775
  ...
# Subtest: aceita pagamento parcial e arredonda para duas casas
ok 78 - aceita pagamento parcial e arredonda para duas casas
  ---
  duration_ms: 0.242042
  ...
# Subtest: rejeita geração sem contratação
ok 79 - rejeita geração sem contratação
  ---
  duration_ms: 0.472193
  ...
# Subtest: rejeita valor zero e valor acima do saldo
ok 80 - rejeita valor zero e valor acima do saldo
  ---
  duration_ms: 0.278921
  ...
# Subtest: ticket de item usa modal declarativo com abas
ok 81 - ticket de item usa modal declarativo com abas
  ---
  duration_ms: 2.562532
  ...
# Subtest: ticket preserva filtros dependentes e relação de pagamentos
ok 82 - ticket preserva filtros dependentes e relação de pagamentos
  ---
  duration_ms: 0.408855
  ...
# Subtest: campos calculados aparecem apenas no resumo
ok 83 - campos calculados aparecem apenas no resumo
  ---
  duration_ms: 0.321532
  ...
# Subtest: menu principal mantém Cadastros, Operação e Financeiro
ok 84 - menu principal mantém Cadastros, Operação e Financeiro
  ---
  duration_ms: 1.632232
  ...
# Subtest: home de configurações concentra cadastros auxiliares, integrações e auditoria
ok 85 - home de configurações concentra cadastros auxiliares, integrações e auditoria
  ---
  duration_ms: 0.430766
  ...
# Subtest: botão Configurações fica no cabeçalho e recursos técnicos saem do menu lateral
ok 86 - botão Configurações fica no cabeçalho e recursos técnicos saem do menu lateral
  ---
  duration_ms: 0.329897
  ...
# Subtest: salva somente os campos da aba Orçamento
ok 87 - salva somente os campos da aba Orçamento
  ---
  duration_ms: 2.926032
  ...
# Subtest: salva somente os campos da aba Fechamento
ok 88 - salva somente os campos da aba Fechamento
  ---
  duration_ms: 0.717341
  ...
# Subtest: novo projeto abre em dados e registros existentes preservam resumo
ok 89 - novo projeto abre em dados e registros existentes preservam resumo
  ---
  duration_ms: 14.455232
  ...
# Subtest: pagamentos do item ficam somente leitura na colecao e na esteira
ok 90 - pagamentos do item ficam somente leitura na colecao e na esteira
  ---
  duration_ms: 0.920371
  ...
# Subtest: organiza as abas e regras financeiras do item
ok 91 - organiza as abas e regras financeiras do item
  ---
  duration_ms: 18.854837
  ...
# Subtest: calcula os totais no formulário e identifica lucro ou prejuízo
ok 92 - calcula os totais no formulário e identifica lucro ou prejuízo
  ---
  duration_ms: 4.865799
  ...
# Subtest: o pagamento usa o total contratado como saldo
ok 93 - o pagamento usa o total contratado como saldo
  ---
  duration_ms: 0.451895
  ...
1..93
# tests 93
# suites 0
# pass 87
# fail 6
# cancelled 0
# skipped 0
# todo 0
# duration_ms 877.720135
```
