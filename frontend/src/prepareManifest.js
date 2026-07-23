const MODELOS_INTERNOS = new Set(["Estado", "Cidade"]);

/**
 * Prepara o manifesto efetivamente entregue ao OonCore.
 *
 * - remove Estado e Cidade da navegação, mantendo-os disponíveis no backend;
 * - reutiliza no cadastro de ProjetoItem as mesmas abas, grupos, filtros e
 *   relações declaradas para o ticket da esteira de itens.
 *
 * @param {Record<string, any>} manifest
 * @returns {Record<string, any>}
 */
export function prepararManifesto(manifest) {
  const pipelineItensProjeto = manifest.pipelines?.find(
    (pipeline) => pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto",
  );

  return {
    ...manifest,
    collections: manifest.collections
      ?.filter((collection) => !MODELOS_INTERNOS.has(collection.model))
      .map((collection) => {
        if (collection.model !== "ProjetoItem" || !pipelineItensProjeto?.ticketModal) {
          return collection;
        }

        return {
          ...collection,
          form: pipelineItensProjeto.form ?? collection.form,
          relations: {
            ...(collection.relations ?? {}),
            ...(pipelineItensProjeto.relations ?? {}),
          },
          detailModal: {
            ...pipelineItensProjeto.ticketModal,
            enabled: true,
          },
        };
      }),
  };
}
