# Padrões Backend

O backend da Central deve conter apenas domínio e extensões. Boot, infraestrutura, CRUD padrão, autenticação, RBAC e metadata pertencem ao `@oondemand/oon-core-back`.

## Estrutura esperada

```txt
backend/
├── central.config.js
├── central.manifest.json
└── src/
    ├── models/
    ├── validations/
    ├── triggers/
    ├── hooks/
    ├── mappings/
    ├── documents/
    ├── pipelines/
    ├── integrations/
    ├── routes/
    ├── controllers/
    └── services/
```

## Models

Use models para declarar entidades de negócio. Cada model deve ser pequeno, com nomes claros e campos compatíveis com as telas e integrações.

Boas práticas:

- use campos explícitos;
- defina tipos, obrigatoriedade e enums quando aplicável;
- preserve campos de status para esteiras;
- evite regras complexas diretamente no schema;
- evite dependência direta de frontend.

## Validations

Use validations para regras de negócio síncronas e mensagens claras para o usuário.

Exemplos:

- campo obrigatório condicional;
- status permitido para transição;
- valor mínimo/máximo;
- combinação inválida de campos;
- bloqueio por permissão ou perfil.

## Triggers e hooks

Use triggers e hooks para efeitos controlados depois ou antes de alterações.

Exemplos:

- criar ticket de integração;
- recalcular campos derivados;
- gerar histórico operacional;
- disparar conector;
- atualizar etapa da esteira.

Regras:

- trigger não deve esconder regra crítica sem validação;
- evite efeitos irreversíveis sem log;
- integração externa deve passar por camada de integração/conector;
- falhas de integração devem gerar status rastreável, não quebrar silenciosamente o processo.

## Rotas customizadas

Crie rotas customizadas somente quando o CRUD/metadata do Core não resolver.

Toda rota customizada deve ter:

- autenticação;
- verificação de permissão;
- validação de entrada;
- tratamento de erro;
- resposta padronizada;
- ausência de segredo hardcoded.

## Serviços

Use `services/` para regras reutilizáveis. Evite controllers grandes.

## Segurança

Nunca confie no frontend para permissão, tenant, app ou perfil. O backend deve validar tudo que altera dados, dispara integrações ou expõe informações sensíveis.
