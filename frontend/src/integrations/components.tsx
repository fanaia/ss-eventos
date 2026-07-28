import React, { useState } from "react";

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

export function integrationSignal(value: unknown) {
  const status = normalize(value);
  const key = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!status || ["nao enviado", "nao testado", "sem integracao"].includes(key)) {
    return { symbol: "⚪", label: status || "Sem integração" };
  }
  if (key.includes("erro") || key.includes("conflito") || key.includes("divergencia")) {
    return { symbol: "🔴", label: status };
  }
  if (
    key.includes("pendente")
    || key.includes("processando")
    || key.includes("temporario")
    || key.includes("aguardando")
    || key.includes("executando")
  ) {
    return { symbol: "🟡", label: status };
  }
  if (
    key.includes("sincronizado")
    || key.includes("concluido")
    || key.includes("enviado")
    || key === "ok"
    || key === "pago"
  ) {
    return { symbol: "🟢", label: status };
  }
  if (key.includes("arquivado") || key.includes("cancelado") || key.includes("inativo")) {
    return { symbol: "⚫", label: status };
  }
  return { symbol: "🟡", label: status };
}

export function IntegrationSignalCell({ value, row }: { value: unknown; row?: Record<string, unknown> }) {
  let status = value;
  if (row?.integrationStatus) status = row.integrationStatus;
  else if (row?.omieStatusIntegracao) status = row.omieStatusIntegracao;
  else if (row?.statusConexao) status = row.statusConexao;
  else if (row?.status) status = row.status;
  const signal = integrationSignal(status);
  return (
    <span
      title={`Status da integração: ${signal.label}`}
      aria-label={`Status da integração: ${signal.label}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
    >
      <span aria-hidden="true">{signal.symbol}</span>
      <span>{signal.label}</span>
    </span>
  );
}

export function CopyIntegrationTextCell({ value }: { value: unknown }) {
  const text = normalize(value);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!text) return <span>Não configurada</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
      <code style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>
        {text}
      </code>
      <button
        type="button"
        onClick={copy}
        title="Copiar para a área de transferência"
        aria-label="Copiar para a área de transferência"
        style={{ cursor: "pointer", border: "1px solid currentColor", borderRadius: 6, padding: "3px 8px", background: "transparent" }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}
