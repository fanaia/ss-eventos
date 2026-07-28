import { manifestToConfig, start, type CentralUiManifest } from "@oondemand/oon-core-front";
import manifest from "../central.ui.json";
import {
  aplicarFluxoAutomaticoPagamentos,
} from "./automaticPaymentFlow.js";
import {
  instalarComportamentoEtapasAutomaticasPagamento,
} from "./automaticPaymentStageBehavior.js";
import {
  aplicarMascaraDocumentoNoGrid,
  DocumentoMascaradoCell,
} from "./documentGrid.js";
import { instalarComportamentoCamposFinanceiros } from "./financialFields.js";
import {
  CopyIntegrationTextCell,
  IntegrationSignalCell,
} from "./integrations/components.js";
import { aplicarIntegracaoOmieCompleta } from "./integrations/omie.js";
import { OmieIntegrationPage } from "./integrations/OmieIntegrationPage.js";
import { prepararManifesto } from "./prepareManifest.js";
import { ordenarViewsPorSecao, prepararNavegacao } from "./prepareNavigation.js";
import { removerAcoesEdicaoDuplicadas } from "./removeDuplicateEditActions.js";
import { removerCamposFormaPagamento } from "./removePaymentMethodFields.js";
import { aplicarAjustesUsabilidade } from "./usabilityAdjustments.js";

const manifestDaCentral = removerAcoesEdicaoDuplicadas(
  aplicarMascaraDocumentoNoGrid(
    prepararNavegacao(
      aplicarFluxoAutomaticoPagamentos(
        aplicarIntegracaoOmieCompleta(
          removerCamposFormaPagamento(
            aplicarAjustesUsabilidade(
              prepararManifesto(manifest as unknown as CentralUiManifest),
            ),
          ),
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
    pageComponents: {
      OmieIntegrationPage,
    },
  },
  devToken: import.meta.env.DEV
    ? (import.meta.env.VITE_DEV_TOKEN ?? "dev-local")
    : undefined,
});

if (configDaCentral.ui?.views) {
  configDaCentral.ui.views = ordenarViewsPorSecao(configDaCentral.ui.views);
}

start(configDaCentral);
instalarComportamentoCamposFinanceiros();
instalarComportamentoEtapasAutomaticasPagamento();
