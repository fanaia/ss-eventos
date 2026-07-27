"use strict";
const crypto = require("node:crypto");
function somenteDigitos(valor) { return String(valor ?? "").replace(/\D/g, ""); }
function arredondarMoeda(valor) { const numero = Number(valor || 0); return Math.round((numero + Number.EPSILON) * 100) / 100; }
function hashPayload(payload) { return crypto.createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex"); }
function hashSegredo(valor) { return valor ? crypto.createHash("sha256").update(String(valor)).digest("hex") : ""; }
function compararHashSeguro(valor, hashEsperado) { const recebido = Buffer.from(hashSegredo(valor)); const esperado = Buffer.from(String(hashEsperado || "")); return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado); }
function dataOmie(valor) { if (!valor) return ""; const data = valor instanceof Date ? valor : new Date(valor); if (Number.isNaN(data.getTime())) return ""; return `${String(data.getUTCDate()).padStart(2,"0")}/${String(data.getUTCMonth()+1).padStart(2,"0")}/${data.getUTCFullYear()}`; }
function dataIsoDeOmie(valor) { const p=String(valor||"").match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return p ? new Date(`${p[3]}-${p[2]}-${p[1]}T00:00:00.000Z`) : null; }
function codigoClienteIntegracao(id) { return `SS-EVENTOS:CLIENTE_FORNECEDOR:${String(id)}`.slice(0,60); }
function codigoPagamentoIntegracao(id) { return `SS-EVENTOS:PAGAMENTO:${String(id)}`.slice(0,60); }
function sanitizarErro(erro) { return ([erro?.message,erro?.description,erro?.faultstring].filter(Boolean).join(" - ").replace(/app[_ -]?secret\s*[:=]\s*[^\s,;]+/gi,"app_secret=***").replace(/app[_ -]?key\s*[:=]\s*[^\s,;]+/gi,"app_key=***").slice(0,1000) || "Erro não identificado na integração Omie."); }
function primeiraChave(objeto,chaves,padrao) { for (const chave of chaves) if (objeto && objeto[chave] !== undefined && objeto[chave] !== null) return objeto[chave]; return padrao; }
function paraBooleanoOmie(valor){return valor?"S":"N";} function deBooleanoOmie(valor){return String(valor||"").toUpperCase()==="S";}
module.exports={somenteDigitos,arredondarMoeda,hashPayload,hashSegredo,compararHashSeguro,dataOmie,dataIsoDeOmie,codigoClienteIntegracao,codigoPagamentoIntegracao,sanitizarErro,primeiraChave,paraBooleanoOmie,deBooleanoOmie};
