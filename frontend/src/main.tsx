import { startFromManifest, type CentralUiManifest } from "@oondemand/oon-core-front";
import manifest from "../central.ui.json";
import { prepararManifesto } from "./prepareManifest.js";
import { removerAcoesEdicaoDuplicadas } from "./removeDuplicateEditActions.js";

/**
 * O manifesto é preparado antes do bootstrap para:
 *
 * - ocultar os cadastros internos de Estado e Cidade;
 * - aplicar à coleção ProjetoItem as mesmas abas, grupos, filtros dependentes,
 *   totais e pagamentos usados pelo ticket da esteira;
 * - consumir o modal declarativo disponível no OonCore Front 0.3.29;
 * - manter apenas o ícone nativo de edição quando uma rowAction abre a mesma
 *   aba padrão do modal.
 */
const manifestDaCentral = removerAcoesEdicaoDuplicadas(
  prepararManifesto(
    manifest as unknown as CentralUiManifest,
  ),
);

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
