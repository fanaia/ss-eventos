# Baseline executável — SS-Eventos original

Este diretório congela a SS-Eventos original como golden master da issue `oondemand/oon-docs#5`.

## Referências

- original: `fanaia/ss-eventos@3f689bed834aab7dd024a8e31d37bf7623efae58`;
- v2 comparada: `fanaia/ss-eventos-v2@7c3506b04c61bf0ca9a6c52ae1e64f6b7b079eab`;
- coordenação: `oondemand/oon-docs@09f718450d6b80bf1e00f91b59b1b1069584fc46`.

A referência aponta para o último commit funcional anterior à inclusão dos artefatos de baseline. O conteúdo funcional desse commit não foi alterado.

## Executar isoladamente

Requisito: Node.js 20 ou superior. Não requer `npm install`, MongoDB, rede, credenciais ou Omie.

```bash
npm run baseline:check
```

O comando valida:

- SHAs e versões congeladas;
- classificação integral dos arquivos em escopo;
- presença dos contratos e testes associados a todos os cenários obrigatórios;
- massa anonimizada e IDs estáveis;
- saídas financeiras usando o código real do golden master;
- ausência de segredos no diagnóstico de referência;
- contrato de publicação e ativação Dev;
- remoção dos relatórios temporários de diagnóstico.

## Materializar a massa restaurável

```bash
npm run baseline:materialize -- --output .baseline-data
```

O comando gera um JSON por coleção, adequado para inspeção e para importação controlada em uma base descartável. Exemplo:

```bash
mongoimport --db ss_eventos_baseline --collection projetos --file .baseline-data/projetos.json --jsonArray
```

Nunca execute a massa de baseline sobre uma base real.

## Regressão completa existente

Após instalar as dependências do backend:

```bash
npm test --prefix backend
```

Os testes existentes continuam sendo a caracterização detalhada. `baseline/scenarios.json` liga cada cenário obrigatório aos testes, fontes, entrada e saída esperada.

## Regra de congelamento

Até o encerramento da Fase 0:

- não portar código ao Core;
- não reescrever a integração;
- não alterar comportamento para aproximar a v2;
- não remover arquivos classificados como regra, manifesto, integração ou contrato;
- aceitar somente correção comprovada e registrada como mudança deliberada do golden master.
