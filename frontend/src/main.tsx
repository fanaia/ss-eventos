import { manifestToConfig, start, type CentralUiManifest } from "@oondemand/oon-core-front";
import manifest from "../central.ui.json";
import { aplicarMascaraDocumentoNoGrid, DocumentoMascaradoCell } from "./documentGrid.js";
import { instalarComportamentoCamposFinanceiros } from "./financialFields.js";
import { aplicarComponentesIntegracao } from "./integrations/base.js";
import { CopyIntegrationTextCell, IntegrationSignalCell } from "./integrations/components.js";
import { aplicarIntegracaoOmie } from "./omieAdjustments.js";
import { aplicarFormasPagamento } from "./paymentMethodsAdjustments.js";
import { prepararManifesto } from "./prepareManifest.js";
import { ordenarViewsPorSecao, prepararNavegacao } from "./prepareNavigation.js";
import { removerAcoesEdicaoDuplicadas } from "./removeDuplicateEditActions.js";
import { aplicarAjustesUsabilidade } from "./usabilityAdjustments.js";

const manifestDaCentral = removerAcoesEdicaoDuplicadas(
  aplicarMascaraDocumentoNoGrid(
    prepararNavegacao(
      aplicarIntegracaoOmie(
        aplicarComponentesIntegracao(
          aplicarFormasPagamento(
            aplicarAjustesUsabilidade(
              prepararManifesto(manifest as unknown as CentralUiManifest),
            ),
          ),
          { provider: "omie", providerLabel: "Omie" },
        ),
      ),
    ),
  ),
);

const configDaCentral = manifestToConfig(manifestDaCentral, {
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  meusAppsUrl: import.meta.env.VITE_MEUS_APPS_URL,
  registry: {
    cellRenderers: {
      documentoMascarado: DocumentoMascaradoCell,
      integrationSignal: IntegrationSignalCell,
      farolIntegracao: IntegrationSignalCell,
      copiarTexto: CopyIntegrationTextCell,
    },
  },
  devToken: import.meta.env.DEV ? (import.meta.env.VITE_DEV_TOKEN ?? "dev-local") : undefined,
});

if (configDaCentral.ui?.views) configDaCentral.ui.views = ordenarViewsPorSecao(configDaCentral.ui.views);
start(configDaCentral);
instalarComportamentoCamposFinanceiros();
