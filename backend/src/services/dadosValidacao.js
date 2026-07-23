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

function possuiCampo(objeto, campo) {
  return Object.prototype.hasOwnProperty.call(objeto ?? {}, campo);
}

/**
 * Formulários do Core omitem referências opcionais vazias do payload. Quando o
 * campo pai está presente e o dependente não veio, isso representa uma limpeza
 * explícita do dependente, não a intenção de preservar o valor anterior.
 *
 * Mutações rápidas, que enviam apenas etapa/status, continuam preservando o
 * dependente porque não carregam o campo pai.
 */
function dadosComDependenciaOpcional(
  dados = {},
  contexto = {},
  campoPai,
  campoDependente,
) {
  const efetivos = { ...dadosConsolidados(dados, contexto) };
  const paiFoiEnviado = possuiCampo(dados, campoPai);
  const dependenteFoiEnviado = possuiCampo(dados, campoDependente);
  const valorDependente = dados?.[campoDependente];

  if (
    paiFoiEnviado
    && (!dependenteFoiEnviado || valorDependente === "" || valorDependente == null)
  ) {
    efetivos[campoDependente] = null;
  }

  return efetivos;
}

function subcategoriaPertenceACategoria(categoriaId, subcategoria) {
  if (!categoriaId || !subcategoria) return false;
  return String(subcategoria.categoriaPaiId || "") === String(categoriaId);
}

module.exports = {
  dadosConsolidados,
  dadosComDependenciaOpcional,
  subcategoriaPertenceACategoria,
};