"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("menu principal mantém Cadastros, Operação e Financeiro", () => {
  const navigation = read("frontend/src/prepareNavigation.js");
  assert.match(navigation, /\["Cadastros", 0\]/);
  assert.match(navigation, /\["Operação", 1\]/);
  assert.match(navigation, /\["Financeiro", 2\]/);
  assert.match(navigation, /ClienteFornecedor:[\s\S]*section: "Cadastros"/);
  assert.match(navigation, /Projeto:[\s\S]*section: "Operação"/);
  assert.match(navigation, /label: "Pagamentos", section: "Financeiro"/);
});

test("home de configurações concentra cadastros auxiliares, integrações e auditoria", () => {
  const navigation = read("frontend/src/prepareNavigation.js");
  const home = read("frontend/src/settings/SettingsHomePage.tsx");
  assert.match(navigation, /path: "\/configuracoes"/);
  assert.match(navigation, /component: "custom:SettingsHomePage"/);
  assert.match(home, /Cadastros auxiliares/);
  assert.match(home, /Integrações/);
  assert.match(home, /Auditoria/);
  assert.match(home, /path: "\/categorias"/);
  assert.match(home, /path: "\/responsaveis"/);
  assert.match(home, /path: "\/integracoes\/omie"/);
  assert.match(home, /path: "\/integracoes\/esteira"/);
  assert.match(home, /path: "\/integracoes\/eventos"/);
  assert.match(home, /path: "\/integracoes\/historico"/);
});

test("botão Configurações fica no cabeçalho e recursos técnicos saem do menu lateral", () => {
  const shell = read("frontend/src/settings/settingsShell.js");
  const main = read("frontend/src/main.tsx");
  assert.match(shell, /normalizeText\(button\.textContent\)\.toLowerCase\(\) === "sair"/);
  assert.match(shell, /button\.textContent = "Configurações"/);
  assert.match(shell, /insertBefore\(button, logout\)/);
  assert.match(shell, /window\.history\.pushState\(\{\}, "", SETTINGS_PATH\)/);
  assert.match(shell, /SETTINGS_PATH,/);
  assert.match(shell, /"\/categorias"/);
  assert.match(shell, /"\/responsaveis"/);
  assert.match(shell, /"\/integracoes\/omie"/);
  assert.match(shell, /HIDDEN_SECTION_LABELS = new Set\(\["INTEGRAÇÕES", "CONFIGURAÇÕES"\]\)/);
  assert.match(main, /SettingsHomePage/);
  assert.match(main, /installSettingsNavigation\(\)/);
});
