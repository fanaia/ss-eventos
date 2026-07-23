"use strict";

/**
 * As mutações rápidas da esteira enviam apenas o campo alterado. O OonCore
 * disponibiliza no contexto o registro consolidado (atual + alterações), que
 * deve ser usado por validações que dependem de outros campos obrigatórios.
 */
function dadosConsolidados(dados = {}, contexto = {}) {
  const consolidado = contexto?.consolidated;
  if (consolidado && typeof consolidado === "object") return consolidado;
  return dados ?? {};
}

module.exports = { dadosConsolidados };
