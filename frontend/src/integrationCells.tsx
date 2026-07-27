import React, { useState } from "react";

function normalizar(valor: unknown) {
  return String(valor ?? "").trim();
}

function farolParaStatus(valor: unknown) {
  const status = normalizar(valor);
  const chave = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!status || ["nao enviado", "nao testado", "sem integracao"].includes(chave)) {
    return { simbolo: "⚪", rotulo: status || "Sem integração" };
  }
  if (chave.includes("erro") || chave.includes("conflito") || chave.includes("divergencia")) {
    return { simbolo: "🔴", rotulo: status };
  }
  if (
    chave.includes("pendente")
    || chave.includes("processando")
    || chave.includes("temporario")
    || chave.includes("aguardando")
  ) {
    return { simbolo: "🟡", rotulo: status };
  }
  if (
    chave.includes("sincronizado")
    || chave.includes("concluido")
    || chave.includes("enviado")
    || chave === "ok"
    || chave === "pago"
  ) {
    return { simbolo: "🟢", rotulo: status };
  }
  if (chave.includes("arquivado") || chave.includes("cancelado") || chave.includes("inativo")) {
    return { simbolo: "⚫", rotulo: status };
  }
  return { simbolo: "🟡", rotulo: status };
}

export function FarolIntegracaoCell({ value, row }: { value: unknown; row?: Record<string, unknown> }) {
  let status = value;
  if (row?.omieStatusIntegracao) status = row.omieStatusIntegracao;
  else if (row?.statusConexao) status = row.statusConexao;
  else if (row?.omieCategoriaId) status = "Sincronizado";
  else if (row?.exigirCategoriaOmie) status = "Pendente";
  else if (row?.origem === "Omie") status = row.status === "Ativo" ? "Sincronizado" : row.status;
  else if (row?.status) status = row.status;
  const farol = farolParaStatus(status);
  return (
    <span
      title={`Status da integração: ${farol.rotulo}`}
      aria-label={`Status da integração: ${farol.rotulo}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
    >
      <span aria-hidden="true">{farol.simbolo}</span>
      <span>{farol.rotulo}</span>
    </span>
  );
}

export function CopiarTextoCell({ value }: { value: unknown }) {
  const texto = normalizar(value);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!texto) return;
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600);
  }

  if (!texto) return <span>Não configurada</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
      <code style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>
        {texto}
      </code>
      <button
        type="button"
        onClick={copiar}
        title="Copiar para a área de transferência"
        aria-label="Copiar para a área de transferência"
        style={{ cursor: "pointer", border: "1px solid currentColor", borderRadius: 6, padding: "3px 8px", background: "transparent" }}
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}
