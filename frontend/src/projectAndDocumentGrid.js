const RENDERER_DOCUMENTO = "documentoMascarado";

function somenteDigitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

function normalizarTipo(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatarCpf(valor) {
  return somenteDigitos(valor)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatarCnpj(valor) {
  return somenteDigitos(valor)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\/\d{4})(\d)/, "$1-$2");
}

export function formatarDocumento(valor, tipoPessoa) {
  const original = String(valor ?? "");
  if (!original) return "";

  const tipo = normalizarTipo(tipoPessoa);
  if (tipo === "est" || tipo.includes("estrangeir") || tipo.includes("foreign")) {
    return original;
  }

  const digitos = somenteDigitos(original);
  if (!digitos) return original;

  if (tipo === "pf" || tipo.includes("fisica")) return formatarCpf(digitos);
  if (tipo === "pj" || tipo.includes("juridica")) return formatarCnpj(digitos);
  return digitos.length > 11 ? formatarCnpj(digitos) : formatarCpf(digitos);
}

export function DocumentoMascaradoCell({ value, row }) {
  return formatarDocumento(value, row?.tipo);
}

function prepararColunaDocumento(coluna) {
  if (coluna === "documento") {
    return {
      field: "documento",
      label: "Documento",
      renderer: RENDERER_DOCUMENTO,
    };
  }

  if (coluna && typeof coluna === "object" && coluna.field === "documento") {
    return {
      ...coluna,
      renderer: RENDERER_DOCUMENTO,
    };
  }

  return coluna;
}

/** Ajustes pontuais de UX que dependem do contexto de criação e da linha do grid. */
export function prepararProjetoEDocumentoGrid(manifest) {
  return {
    ...manifest,
    collections: manifest.collections?.map((collection) => {
      if (collection.model === "ClienteFornecedor") {
        return {
          ...collection,
          list: {
            ...collection.list,
            columns: collection.list?.columns?.map(prepararColunaDocumento),
          },
        };
      }

      if (collection.model === "Projeto") {
        return {
          ...collection,
          detailModal: {
            ...collection.detailModal,
            // A criação usa a aba padrão. A edição continua respeitando
            // initialTab: "resumo" declarado na ação da linha.
            defaultTab: "dados",
          },
        };
      }

      return collection;
    }),
  };
}
