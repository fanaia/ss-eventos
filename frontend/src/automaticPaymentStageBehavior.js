const FORM_ID = "oon-detail-form-Pagamento";
const ETAPAS_AUTOMATICAS = new Set(["Enviado para Omie", "Pagamento Ok"]);
const CAMPOS_CONTROLADOS_PELO_PROCESSO = new Set(["etapa", "statusTrabalho"]);
const STYLE_ID = "ss-eventos-etapas-automaticas-pagamento";
const INSTALACAO_KEY = "__ssEventosAutomaticPaymentStagesCleanup";

function campoDoControle(controle) {
  const id = String(controle?.id || "");
  const prefixo = "oon-detail-field-";
  return id.startsWith(prefixo) ? id.slice(prefixo.length) : "";
}

function guardarEstado(controle) {
  if (!controle.dataset.automaticPreviousDisabled) {
    controle.dataset.automaticPreviousDisabled = controle.disabled ? "true" : "false";
  }
  if (
    (controle instanceof HTMLInputElement || controle instanceof HTMLTextAreaElement)
    && !controle.dataset.automaticPreviousReadonly
  ) {
    controle.dataset.automaticPreviousReadonly = controle.readOnly ? "true" : "false";
  }
}

function bloquearControle(controle) {
  guardarEstado(controle);
  controle.disabled = true;
  controle.setAttribute("aria-disabled", "true");
  controle.setAttribute("data-etapa-automatica-controle", "true");
  if (controle instanceof HTMLInputElement || controle instanceof HTMLTextAreaElement) {
    controle.readOnly = true;
    controle.setAttribute("aria-readonly", "true");
  }
}

function restaurarControle(controle) {
  if (!controle.dataset.automaticPreviousDisabled) return;
  controle.disabled = controle.dataset.automaticPreviousDisabled === "true";
  if (!controle.disabled) controle.removeAttribute("aria-disabled");
  if (controle instanceof HTMLInputElement || controle instanceof HTMLTextAreaElement) {
    controle.readOnly = controle.dataset.automaticPreviousReadonly === "true";
    if (!controle.readOnly) controle.removeAttribute("aria-readonly");
  }
  delete controle.dataset.automaticPreviousDisabled;
  delete controle.dataset.automaticPreviousReadonly;
  controle.removeAttribute("data-etapa-automatica-controle");
}

function ocultarSalvar(botao, ocultar) {
  if (ocultar) {
    if (!botao.dataset.automaticPreviousDisplay) {
      botao.dataset.automaticPreviousDisplay = botao.style.display || "__empty__";
    }
    botao.disabled = true;
    botao.style.display = "none";
    botao.setAttribute("aria-hidden", "true");
    return;
  }

  if (!botao.dataset.automaticPreviousDisplay) return;
  botao.style.display = botao.dataset.automaticPreviousDisplay === "__empty__"
    ? ""
    : botao.dataset.automaticPreviousDisplay;
  botao.disabled = false;
  botao.removeAttribute("aria-hidden");
  delete botao.dataset.automaticPreviousDisplay;
}

function etapaDoDialog(dialog, form) {
  const campoEtapa = form?.querySelector("#oon-detail-field-etapa");
  if (campoEtapa && "value" in campoEtapa) {
    dialog.dataset.pagamentoEtapa = String(campoEtapa.value || "");
  }
  return String(dialog.dataset.pagamentoEtapa || "");
}

function aplicarNoDialog(dialog, form) {
  const etapa = etapaDoDialog(dialog, form);
  const automatica = ETAPAS_AUTOMATICAS.has(etapa);
  dialog.dataset.pagamentoEtapaAutomatica = automatica ? "true" : "false";

  if (form) {
    const controles = form.querySelectorAll("input, select, textarea, button");
    controles.forEach((controle) => {
      const campo = campoDoControle(controle);
      if (automatica || CAMPOS_CONTROLADOS_PELO_PROCESSO.has(campo)) {
        bloquearControle(controle);
      } else {
        restaurarControle(controle);
      }
    });
  }

  dialog.querySelectorAll(`button[form="${FORM_ID}"]`).forEach((botao) => {
    ocultarSalvar(botao, automatica);
  });
}

export function aplicarComportamentoEtapasAutomaticasPagamento(raiz = document) {
  const forms = raiz.querySelectorAll(`#${FORM_ID}`);
  forms.forEach((form) => {
    const dialog = form.closest('[role="dialog"]');
    if (dialog) aplicarNoDialog(dialog, form);
  });

  raiz.querySelectorAll(`button[form="${FORM_ID}"]`).forEach((botao) => {
    const dialog = botao.closest('[role="dialog"]');
    if (!dialog) return;
    const form = dialog.querySelector(`#${FORM_ID}`);
    aplicarNoDialog(dialog, form);
  });
}

function instalarEstilos() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [role="dialog"][data-pagamento-etapa-automatica="true"]
      [data-etapa-automatica-controle="true"] {
      background: #f8fafc !important;
      border-color: #cbd5e1 !important;
      color: #64748b !important;
      cursor: not-allowed !important;
      opacity: .82 !important;
      box-shadow: none !important;
    }

    [role="dialog"][data-pagamento-etapa-automatica="true"]
      [data-etapa-automatica-controle="true"] * {
      cursor: not-allowed !important;
    }
  `;
  document.head.appendChild(style);
}

export function instalarComportamentoEtapasAutomaticasPagamento() {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};
  if (typeof window[INSTALACAO_KEY] === "function") return window[INSTALACAO_KEY];

  instalarEstilos();
  let frame = 0;
  const agendar = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      aplicarComportamentoEtapasAutomaticasPagamento(document);
    });
  };

  const observer = new MutationObserver(agendar);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["value", "aria-selected"],
  });
  document.addEventListener("change", agendar, true);
  agendar();

  const cleanup = () => {
    if (frame) window.cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("change", agendar, true);
    delete window[INSTALACAO_KEY];
  };

  window[INSTALACAO_KEY] = cleanup;
  return cleanup;
}
