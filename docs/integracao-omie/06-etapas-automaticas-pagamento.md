# Etapas automáticas de Pagamento

## Objetivo

O envio e a conciliação com o Omie fazem parte do fluxo da esteira. Não existem botões manuais para iniciar o envio de uma Conta a Pagar.

## Etapas manuais

- Solicitado;
- Aprovado;
- Aguardando NF.

Nessas etapas, o usuário pode preencher os dados do pagamento e utilizar as ações de aprovação, recusa e status de trabalho previstas para o processo.

## Enviado para Omie

Ao aprovar o Pagamento em `Aguardando NF`, a etapa passa para `Enviado para Omie` e, na mesma atualização:

1. o status de trabalho passa para `Trabalhando`;
2. o status da integração passa para `Pendente`;
3. a chave idempotente do título é garantida;
4. um ticket `OMIE_CONTA_PAGAR_UPSERT` é criado na fila;
5. o worker envia a Conta a Pagar ao Omie.

Não existe botão `Enviar ao Omie` nem rota manual equivalente.

Nesta etapa:

- todos os campos do ticket ficam bloqueados;
- o botão Salvar fica oculto;
- Aprovar, Recusar e mudanças manuais de status não são exibidos;
- somente `Atualizar do Omie` fica disponível.

A ação `Atualizar do Omie` envia o comando interno `_conciliarOmie` pela atualização do próprio ticket. Assim, o Core recebe e mescla imediatamente o Pagamento persistido após a consulta no Omie.

## Pagamento Ok

A etapa `Pagamento Ok` somente pode ser definida pela integração quando o Omie informar que o título foi liquidado.

Nesta etapa:

- todos os campos permanecem bloqueados;
- não existe botão Salvar;
- nenhuma ação de aprovação, recusa, status ou conciliação é exibida.

## Status de trabalho

- ao iniciar envio ou conciliação: `Trabalhando`;
- em qualquer erro da automação: `Revisar`;
- o erro sanitizado fica registrado em `omieUltimoErro`;
- o status da integração passa para `Erro`.

## Proteção no backend

O bloqueio não depende apenas do frontend. Atualizações manuais em `Enviado para Omie` ou `Pagamento Ok` retornam conflito HTTP 409.

As exceções internas usam `skipOmieOutbox` para permitir que a própria integração atualize códigos, valores, baixa, liquidação e etapa.

## Homologação

1. preencher e salvar o Pagamento em uma etapa manual;
2. avançar até `Aguardando NF`;
3. aprovar para `Enviado para Omie`;
4. confirmar status `Trabalhando` e ticket na fila;
5. confirmar ausência do botão `Enviar ao Omie`;
6. abrir o ticket e confirmar campos e Salvar bloqueados;
7. confirmar que somente `Atualizar do Omie` está disponível;
8. simular erro e confirmar status `Revisar`;
9. confirmar o pagamento no Omie;
10. executar `Atualizar do Omie`;
11. confirmar mudança imediata para `Pagamento Ok`;
12. confirmar ausência de todas as ações e campos editáveis.
