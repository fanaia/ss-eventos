"use strict";

const crypto = require("node:crypto");
const { GenericError } = require("@oondemand/oon-core-back");

const PREFIXO = "enc:v1";

function chaveCriptografia() {
  const valor = String(process.env.OMIE_CREDENTIALS_ENCRYPTION_KEY || "").trim();
  if (!valor) return null;

  if (/^[a-f0-9]{64}$/i.test(valor)) return Buffer.from(valor, "hex");

  try {
    const buffer = Buffer.from(valor, "base64");
    if (buffer.length === 32) return buffer;
  } catch {
    // A mensagem validada abaixo é mais útil do que o erro de parsing.
  }

  throw new GenericError(
    "OMIE_CREDENTIALS_ENCRYPTION_KEY deve possuir 32 bytes em Base64 ou 64 caracteres hexadecimais.",
    { statusCode: 500 },
  );
}

function criptografarSegredo(valor) {
  const texto = String(valor || "").trim();
  if (!texto || texto.startsWith(`${PREFIXO}:`)) return texto;

  const chave = chaveCriptografia();
  if (!chave) {
    throw new GenericError(
      "Configure OMIE_CREDENTIALS_ENCRYPTION_KEY antes de salvar App Key, App Secret ou token do webhook.",
      { statusCode: 503 },
    );
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIXO, iv.toString("base64url"), tag.toString("base64url"), cifrado.toString("base64url")].join(":");
}

function descriptografarSegredo(valor) {
  const texto = String(valor || "");
  if (!texto) return "";
  if (!texto.startsWith(`${PREFIXO}:`)) return texto;

  const chave = chaveCriptografia();
  if (!chave) {
    throw new GenericError("A chave de criptografia das credenciais Omie não está configurada.", { statusCode: 503 });
  }

  const partes = texto.split(":");
  if (partes.length !== 5) throw new GenericError("Credencial Omie criptografada em formato inválido.", { statusCode: 500 });
  const iv = Buffer.from(partes[2], "base64url");
  const tag = Buffer.from(partes[3], "base64url");
  const cifrado = Buffer.from(partes[4], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", chave, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString("utf8");
}

function mascararSegredo(valor) {
  const texto = String(valor || "");
  if (!texto) return "";
  if (texto.length <= 8) return `${texto.slice(0, 2)}••••${texto.slice(-2)}`;
  return `${texto.slice(0, 4)}••••••${texto.slice(-4)}`;
}

function gerarTokenWebhook() {
  return crypto.randomBytes(24).toString("base64url");
}

module.exports = {
  criptografarSegredo,
  descriptografarSegredo,
  mascararSegredo,
  gerarTokenWebhook,
};
