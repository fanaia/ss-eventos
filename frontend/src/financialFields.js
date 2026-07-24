const CAMPOS_CALCULADOS = [
  "orcamentoTotal",
  "contratacaoTotal",
  "fechamentoValor",
  "fechamentoFee",
  "fechamentoImposto",
  "fechamentoTotal",
  "fechamentoLucroValor",
  "fechamentoLucroPercentual",
];

const PREFIXOS_TOTAL = ["orcamento", "contratacao"];
const STYLE_ID = "ss-eventos-financial-fields";
const INSTALACAO_KEY = "__ssEventosFinancialFieldsCleanup";

export function normalizarNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = String(valor ?? "").trim();
  if (!texto) return 0;

  const negativo = texto.includes("-") || /^\(.*\)$/.test(texto);
  const numerico = texto.replace(/[^\d.,]/g, "");
  if (!numerico) return 0;

  const ultimaVirgula = numerico.lastIndexOf(",");
  const ultimoPonto = numerico.lastIndexOf(".");
  let separadorDecimal = -1;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    separadorDecimal = Math.max(ultimaVirgula, ultimoPonto);
  } else if (ultimaVirgula >= 0) {
    separadorDecimal = ultimaVirgula;
  } else if (ultimoPonto >= 0) {
    const casas = numerico.length - ultimoPonto - 1;
    separadorDecimal = casas === 1 || casas === 2 ? ultimoPonto : -1;
  }

  const normalizado = separadorDecimal >= 0
    ? `${numerico.slice(0, separadorDecimal).replace(/[.,]/g, "") || "0"}.${numerico.slice(separadorDecimal + 1).replace(/[.,]/g, "")}`
    : numerico.replace(/[.,]/g, "");

  const convertido = Number(normalizado);
  if (!Number.isFinite(convertido)) return 0;
  return negativo ? -Math.abs(convertido) : convertido;
}

export function calcularTotalItem(quantidade, diarias, valorUnitario) {
  const total = normalizarNumero(quantidade)
    * normalizarNumero(diarias)
    * normalizarNumero(valorUnitario);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function classificarResultado(valor) {
  const numero = normalizarNumero(valor);
  if (numero > 0) return "lucro";
  if (numero < 0) return "prejuizo";
  return "neutro";
}

function seletorCampo(campo) {
  return `#oon-detail-field-${campo}, #oon-form-field-${campo}`;
}

function buscarCampo(campo, raiz = document) {
  return raiz.querySelector(seletorCampo(campo));
}

function escreverValorControlado(input, valor) {
  if (!(input instanceof HTMLInputElement)) return;
  if (Math.abs(normalizarNumero(input.value) - valor) < 0.005) return;

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, valor.toFixed(2));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function atualizarTotal(prefixo, raiz) {
  const quantidade = buscarCampo(`${prefixo}Quantidade`, raiz);
  const diarias = buscarCampo(`${prefixo}Diarias`, raiz);
  const valorUnitario = buscarCampo(`${prefixo}ValorUnitario`, raiz);
  const total = buscarCampo(`${prefixo}Total`, raiz);

  if (!quantidade || !diarias || !valorUnitario || !total) return;
  escreverValorControlado(
    total,
    calcularTotalItem(quantidade.value, diarias.value, valorUnitario.value),
  );
}

function marcarSomenteLeitura(campo, raiz) {
  const controle = buscarCampo(campo, raiz);
  if (!(controle instanceof HTMLInputElement || controle instanceof HTMLTextAreaElement)) return;

  controle.readOnly = true;
  controle.setAttribute("aria-readonly", "true");
  controle.setAttribute("data-campo-calculado", "true");
  controle.classList.add("ss-eventos-campo-calculado");
}

function ancestralComum(primeiro, segundo) {
  let atual = primeiro.parentElement;
  while (atual && !atual.contains(segundo)) atual = atual.parentElement;
  return atual;
}

function encontrarGrupoLucro(campoValor, campoPercentual) {
  let grupo = ancestralComum(campoValor, campoPercentual);
  while (grupo && grupo !== document.body) {
    if (grupo.firstElementChild?.textContent?.trim() === "Lucro") return grupo;
    grupo = grupo.parentElement;
  }
  return ancestralComum(campoValor, campoPercentual);
}

function atualizarIdentificacaoResultado(raiz) {
  const valor = buscarCampo("fechamentoLucroValor", raiz);
  const percentual = buscarCampo("fechamentoLucroPercentual", raiz);
  if (!(valor instanceof HTMLInputElement) || !(percentual instanceof HTMLInputElement)) return;

  const resultado = classificarResultado(valor.value || percentual.value);
  const rotulo = resultado === "lucro" ? "Lucro" : resultado === "prejuizo" ? "Prejuízo" : "Sem resultado";

  for (const controle of [valor, percentual]) {
    controle.setAttribute("data-resultado-financeiro", resultado);
  }

  const grupo = encontrarGrupoLucro(valor, percentual);
  if (!grupo) return;

  grupo.classList.add("ss-eventos-grupo-resultado");
  grupo.setAttribute("data-resultado-financeiro", resultado);

  const cabecalho = grupo.firstElementChild;
  if (!cabecalho) return;
  cabecalho.classList.add("ss-eventos-cabecalho-resultado");

  let badge = cabecalho.querySelector("[data-resultado-badge]");
  if (!badge) {
    badge = document.createElement("span");
    badge.setAttribute("data-resultado-badge", "true");
    badge.className = "ss-eventos-resultado-badge";
    cabecalho.appendChild(badge);
  }
  badge.textContent = rotulo;
  badge.setAttribute("data-resultado-financeiro", resultado);
}

export function aplicarComportamentoCamposFinanceiros(raiz = document) {
  for (const campo of CAMPOS_CALCULADOS) marcarSomenteLeitura(campo, raiz);
  for (const prefixo of PREFIXOS_TOTAL) atualizarTotal(prefixo, raiz);
  atualizarIdentificacaoResultado(raiz);
}

function instalarEstilos() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .ss-eventos-campo-calculado {
      background: #f8fafc !important;
      border-color: #cbd5e1 !important;
      color: #334155 !important;
      cursor: default !important;
      box-shadow: none !important;
    }

    .ss-eventos-campo-calculado:focus {
      border-color: #94a3b8 !important;
      box-shadow: none !important;
    }

    .ss-eventos-grupo-resultado {
      transition: background-color .15s ease, border-color .15s ease;
    }

    .ss-eventos-grupo-resultado[data-resultado-financeiro="lucro"] {
      background: #f0fdf4 !important;
      border-color: #86efac !important;
    }

    .ss-eventos-grupo-resultado[data-resultado-financeiro="prejuizo"] {
      background: #fef2f2 !important;
      border-color: #fca5a5 !important;
    }

    .ss-eventos-campo-calculado[data-resultado-financeiro="lucro"] {
      background: #f0fdf4 !important;
      border-color: #86efac !important;
      color: #166534 !important;
      font-weight: 700 !important;
    }

    .ss-eventos-campo-calculado[data-resultado-financeiro="prejuizo"] {
      background: #fef2f2 !important;
      border-color: #fca5a5 !important;
      color: #b91c1c !important;
      font-weight: 700 !important;
    }

    .ss-eventos-cabecalho-resultado {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }

    .ss-eventos-resultado-badge {
      display: inline-flex;
      align-items: center;
      min-height: 20px;
      padding: 2px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
    }

    .ss-eventos-resultado-badge[data-resultado-financeiro="lucro"] {
      color: #166534;
      background: #dcfce7;
      border-color: #86efac;
    }

    .ss-eventos-resultado-badge[data-resultado-financeiro="prejuizo"] {
      color: #b91c1c;
      background: #fee2e2;
      border-color: #fca5a5;
    }
  `;
  document.head.appendChild(style);
}

export function instalarComportamentoCamposFinanceiros() {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};
  if (typeof window[INSTALACAO_KEY] === "function") return window[INSTALACAO_KEY];

  instalarEstilos();
  let frame = 0;
  const agendar = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      aplicarComportamentoCamposFinanceiros(document);
    });
  };

  const observer = new MutationObserver(agendar);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("input", agendar, true);
  document.addEventListener("change", agendar, true);
  agendar();

  const cleanup = () => {
    if (frame) window.cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("input", agendar, true);
    document.removeEventListener("change", agendar, true);
    delete window[INSTALACAO_KEY];
  };

  window[INSTALACAO_KEY] = cleanup;
  return cleanup;
}
