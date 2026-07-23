function acaoAbreAbaPadrao(action, detailModal) {
  if (action?.type !== "openDetailModal") return false;
  if (!detailModal?.enabled) return false;

  const abaPadrao = detailModal.defaultTab;
  return !action.initialTab || action.initialTab === abaPadrao;
}

/**
 * O DataGrid do OonCore já renderiza o ícone padrão de edição quando a coleção
 * possui edição habilitada. Algumas coleções também declaravam uma rowAction
 * `openDetailModal` apontando para a mesma aba padrão, gerando dois controles
 * com a mesma ação.
 *
 * Mantém o ícone nativo e remove somente a ação textual redundante. Ações que
 * abrem uma aba diferente continuam disponíveis.
 *
 * @param {Record<string, any>} manifest
 * @returns {Record<string, any>}
 */
export function removerAcoesEdicaoDuplicadas(manifest) {
  return {
    ...manifest,
    collections: manifest.collections?.map((collection) => {
      const rowActions = collection.list?.rowActions;
      if (!rowActions?.length || !collection.detailModal?.enabled) return collection;

      const filtered = rowActions.filter(
        (action) => !acaoAbreAbaPadrao(action, collection.detailModal),
      );

      if (filtered.length === rowActions.length) return collection;

      const list = { ...collection.list };
      if (filtered.length) list.rowActions = filtered;
      else delete list.rowActions;

      return {
        ...collection,
        list,
      };
    }),
  };
}
