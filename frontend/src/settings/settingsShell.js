const SETTINGS_PATH = "/configuracoes";
const SETTINGS_BUTTON_ID = "ss-eventos-settings-button";
const STYLE_ID = "ss-eventos-settings-navigation-style";
const INSTALLATION_KEY = "__ssEventosSettingsNavigationCleanup";

const HIDDEN_PATHS = new Set([
  SETTINGS_PATH,
  "/categorias",
  "/responsaveis",
  "/integracoes/omie",
  "/integracoes/esteira",
  "/integracoes/eventos",
  "/integracoes/historico",
]);

const HIDDEN_SECTION_LABELS = new Set(["INTEGRAÇÕES", "CONFIGURAÇÕES"]);

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function pathnameOf(anchor) {
  try {
    return new URL(anchor.href, window.location.origin).pathname.replace(/\/$/, "") || "/";
  } catch {
    return "";
  }
}

function itemContainer(anchor, root) {
  let current = anchor;
  while (current.parentElement && current.parentElement !== root) {
    const parent = current.parentElement;
    const links = parent.querySelectorAll("a[href]");
    if (links.length > 1) break;
    current = parent;
  }
  return current;
}

function hideSettingsLinks(root) {
  root.querySelectorAll("a[href]").forEach((anchor) => {
    const path = pathnameOf(anchor);
    if (!HIDDEN_PATHS.has(path)) return;
    const item = itemContainer(anchor, root);
    item.setAttribute("data-ss-settings-hidden", "true");
  });

  root.querySelectorAll("div, span, p, small, strong").forEach((element) => {
    if (element.children.length) return;
    if (!HIDDEN_SECTION_LABELS.has(normalizeText(element.textContent).toUpperCase())) return;
    element.setAttribute("data-ss-settings-hidden", "true");
  });
}

function cleanSidebar() {
  const roots = Array.from(document.querySelectorAll("aside, nav"));
  roots.forEach(hideSettingsLinks);
}

function navigateToSettings() {
  if (window.location.pathname === SETTINGS_PATH) return;
  window.history.pushState({}, "", SETTINGS_PATH);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function findLogoutButton() {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => normalizeText(button.textContent).toLowerCase() === "sair",
  );
}

function addSettingsButton() {
  if (document.getElementById(SETTINGS_BUTTON_ID)) return;
  const logout = findLogoutButton();
  if (!logout?.parentElement) return;

  const button = logout.cloneNode(true);
  button.id = SETTINGS_BUTTON_ID;
  button.type = "button";
  button.textContent = "Configurações";
  button.removeAttribute("form");
  button.removeAttribute("name");
  button.setAttribute("aria-label", "Abrir Configurações");
  button.setAttribute("data-active", window.location.pathname === SETTINGS_PATH ? "true" : "false");
  button.addEventListener("click", navigateToSettings);
  logout.parentElement.insertBefore(button, logout);
}

function updateButtonState() {
  const button = document.getElementById(SETTINGS_BUTTON_ID);
  if (!button) return;
  button.setAttribute("data-active", window.location.pathname === SETTINGS_PATH ? "true" : "false");
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [data-ss-settings-hidden="true"] {
      display: none !important;
    }

    #${SETTINGS_BUTTON_ID} {
      margin-right: 8px;
      white-space: nowrap;
    }

    #${SETTINGS_BUTTON_ID}[data-active="true"] {
      background: #e6f4fb !important;
      border-color: #0b7db3 !important;
      color: #075b83 !important;
    }
  `;
  document.head.appendChild(style);
}

function apply() {
  cleanSidebar();
  addSettingsButton();
  updateButtonState();
}

export function installSettingsNavigation() {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};
  if (typeof window[INSTALLATION_KEY] === "function") return window[INSTALLATION_KEY];

  installStyles();
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", schedule);
  schedule();

  const cleanup = () => {
    if (frame) window.cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("popstate", schedule);
    document.getElementById(SETTINGS_BUTTON_ID)?.remove();
    delete window[INSTALLATION_KEY];
  };

  window[INSTALLATION_KEY] = cleanup;
  return cleanup;
}

export {
  HIDDEN_PATHS,
  HIDDEN_SECTION_LABELS,
  SETTINGS_PATH,
};
