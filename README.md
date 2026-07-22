# SS Eventos

Central Oon para gestão de clientes, fornecedores, projetos, itens orçados/fechados e pagamentos.

A aplicação é composta por dois projetos mínimos que consomem o OonCore:

- **backend/** — domínio (`src/models`, `validations`, `triggers` e serviços de cálculo). Boot, banco, autenticação, RBAC, auditoria, metadata e CRUD vêm do `@oondemand/oon-core-back`.
- **frontend/** — manifesto declarativo em `central.ui.json`. Shell, menu, rotas, grids, formulários, modais e esteiras vêm do `@oondemand/oon-core-front`.

## Domínio implementado

### Cadastros

- **Clientes/Fornecedores**: classificação independente como cliente e/ou fornecedor, PF/PJ/Estrangeiro, validação de CPF/CNPJ, contatos e status.
- **Categorias/Subcategorias**: hierarquia por categoria pai.
- **Responsáveis**: lista interna para responsáveis operacionais e de pagamento.
- **Estados/Cidades**: lista interna oficial do IBGE, sincronizada automaticamente e mantida no banco da Central. A lista já armazenada continua disponível quando o serviço externo estiver temporariamente indisponível. As localidades aparecem somente nos campos de seleção dos itens; o usuário não possui telas de inclusão, edição ou exclusão.

### Projetos

Cada projeto possui fornecedor, cliente, contato principal, percentual de Fee e percentual de imposto.

Os itens ficam em uma coleção relacionada ao projeto e armazenam:

- faturamento, localização, categoria/subcategoria, tipo de custo, etapa e responsável;
- valores de orçamento;
- valores de fechamento;
- cálculos automáticos de total sem impostos, Fee, imposto e total final.

Os cálculos são realizados no backend. Valores calculados enviados pelo frontend são descartados e recalculados conforme os percentuais do projeto.

### Pagamentos

Um item pode ter múltiplos pagamentos. Cada pagamento possui data prevista, forma, valor, responsável, indicador de NF recebida e etapa operacional.

Também estão disponíveis esteiras por etapa para itens e pagamentos.

## Regras financeiras

Para orçamento e fechamento:

1. `Total sem impostos = quantidade × diárias × valor unitário`.
2. `Fee = total sem impostos × % Fee`, exceto em **Agência Interna**, quando o Fee é zero.
3. Imposto:
   - **Agência**: `(total sem impostos + Fee) × % Imposto`;
   - **Agência Interna**: `total sem impostos × % Imposto`;
   - **Faturamento Direto**: `Fee × % Imposto`.
4. `Total com Imposto e Fee = total sem impostos + Fee + imposto`.

Todos os valores monetários são arredondados para duas casas decimais.

## Documentação local do OonCore

A pasta `.ooncore/` é gerada automaticamente a partir da versão instalada do pacote `@oondemand/create-central-oon`.

```bash
npm run ooncore:docs        # sincroniza .ooncore/
npm run ooncore:docs:check  # valida versão/hash da documentação local
```

Não edite `.ooncore/context.generated.md` manualmente.

## Rodando

```bash
# raiz da Central
npm install
npm run ooncore:docs:check

# backend
cd backend && cp .env.example .env && npm install && npm run dev

# frontend, em outro terminal
cd frontend && cp .env.example .env && npm install && npm run dev
```
