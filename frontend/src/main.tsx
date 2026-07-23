import { startFromManifest, type CentralUiManifest } from "@oondemand/oon-core-front";
import manifest from "../central.ui.json";

/**
 * Estado e Cidade continuam registrados no backend para alimentar campos `ref`,
 * mas não são módulos de cadastro do usuário. A Central remove essas coleções
 * do manifesto antes de entregá-lo ao OonCore, portanto elas não geram menu,
 * rota, grid, inclusão ou edição no frontend.
 */
const MODELOS_INTERNOS = new Set(["Estado", "Cidade"]);
const manifestoBase = manifest as unknown as CentralUiManifest;

/**
 * A edição do ProjetoItem deve ser idêntica em todos os pontos da Central.
 * A esteira já declara o ticket com abas, grupos, totais e pagamentos; essa
 * mesma definição é reutilizada como detailModal da coleção ProjetoItem.
 *
 * Dessa forma, alterações futuras no ticket não precisam ser duplicadas no
 * cadastro de Itens de Projeto e os dois fluxos não ficam divergentes.
 */
const pipelineItensProjeto = manifestoBase.pipelines?.find(
  (pipeline) => pipeline.model === "ProjetoItem" || pipeline.name === "ItensProjeto",
);

const manifestDaCentral: CentralUiManifest = {
  ...manifestoBase,
  collections: manifestoBase.collections
    ?.filter((collection) => !MODELOS_INTERNOS.has(collection.model))
    .map((collection) => {
      if (collection.model !== "ProjetoItem" || !pipelineItensProjeto?.ticketModal) {
        return collection;
      }

      return {
        ...collection,
        // Usa também os mesmos filtros dependentes de Estado/Cidade e
        // Categoria/Subcategoria configurados para o ticket.
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

/**
 * Toda a Central Ss Eventos inicia por aqui. Sem providers, router, auth, layout
 * ou páginas — só o manifesto declarativo `central.ui.json`. O Core resolve as
 * telas a partir do `/core/metadata` do backend.
 */
startFromManifest(manifestDaCentral, {
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  meusAppsUrl: import.meta.env.VITE_MEUS_APPS_URL,
  // O valor só entra no bundle servido pelo Vite em modo de desenvolvimento.
  // O backend continua validando se ele coincide com DEV_TOKEN.
  devToken: import.meta.env.DEV ? (import.meta.env.VITE_DEV_TOKEN ?? "dev-local") : undefined,
});
