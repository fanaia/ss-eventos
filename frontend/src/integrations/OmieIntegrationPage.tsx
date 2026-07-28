import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Input,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  CorePageHeader,
  type OonPageDef,
  useOonApi,
} from "@oondemand/oon-core-front";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type TabId = "visao" | "cadastros" | "financeiro" | "historico" | "webhooks";
type ListKind = "clientes" | "categorias" | "contas";
type Row = Record<string, unknown>;

interface Summary {
  totalRecebidos?: number;
  totalInformadoPeloProvedor?: number;
  paginas?: number;
  processados?: number;
  sucessos?: number;
  criados?: number;
  atualizados?: number;
  semAlteracao?: number;
  ignorados?: number;
  erros?: number;
}

interface TechnicalRequest extends Row {
  endpoint?: string;
  url?: string;
  call?: string;
  tentativa?: number;
  httpStatus?: number;
  status?: string;
  duracaoMs?: number;
  request?: unknown;
  response?: unknown;
  erro?: string;
}

interface Execution {
  _id: string;
  title: string;
  resource: string;
  status: string;
  startedAt: string;
  concludedAt?: string;
  durationMs?: number;
  message?: string;
  error?: string;
  summary?: Summary;
  requests?: TechnicalRequest[];
  errors?: Row[];
  items?: Row[];
  itemCount?: number;
  itemsLimited?: boolean;
}

interface Resource {
  key: string;
  label: string;
  description: string;
  endpoint: string;
  order: number;
  actionLabel?: string;
  includeInFullSync?: boolean;
  latestExecution?: Execution | null;
}

interface Webhook {
  event: string;
  label: string;
  description: string;
  url: string | null;
}

interface Configuration {
  _id: string;
  nome: string;
  urlPublica: string;
  appKeyMascarada: string;
  credenciaisConfiguradas: boolean;
  statusConexao: string;
  ultimoErroConexao: string;
  enabled: boolean;
  webhooks: Webhook[];
}

interface SyncResult extends Row {
  executionId?: string;
  message?: string;
  processados?: number;
  sucessos?: number;
  criados?: number;
  atualizados?: number;
  semAlteracao?: number;
  ignorados?: number;
  erros?: Row[];
  itens?: Row[];
  requisicoes?: TechnicalRequest[];
}

function responseData(error: unknown) {
  return (error as { response?: { data?: Row } })?.response?.data || {};
}

function messageOf(error: unknown) {
  const data = responseData(error);
  const value = error as { message?: string };
  return String(data.message || data.error || value.message || "Não foi possível concluir a operação.");
}

function numberOf(value?: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
}

function duration(value?: number) {
  const milliseconds = numberOf(value);
  if (milliseconds < 1000) return `${milliseconds} ms`;
  const seconds = Math.round(milliseconds / 1000);
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function palette(value?: string) {
  const text = String(value || "").toLowerCase();
  if (text.includes("concluído com erros")) return "orange";
  if (text.includes("erro") || text.includes("inativ") || text.includes("bloque")) {
    return "red";
  }
  if (
    text.includes("conclu")
    || text.includes("ativo")
    || text === "ok"
    || text.includes("sincronizado")
    || text.includes("sucesso")
  ) {
    return "green";
  }
  if (
    text.includes("execut")
    || text.includes("process")
    || text.includes("pendente")
  ) {
    return "blue";
  }
  return "gray";
}

function json(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function Modal({
  title,
  description,
  children,
  onClose,
  maxWidth = "980px",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <Box
      position="fixed"
      inset="0"
      zIndex={1500}
      bg="blackAlpha.600"
      p={{ base: "10px", md: "30px" }}
      overflowY="auto"
    >
      <Box maxW={maxWidth} mx="auto" bg="white" borderRadius="xl" overflow="hidden">
        <Flex
          p="18px"
          borderBottomWidth="1px"
          justify="space-between"
          align="start"
          gap="12px"
        >
          <Box>
            <Text fontSize="lg" fontWeight="700">{title}</Text>
            {description ? (
              <Text fontSize="sm" color="gray.600">{description}</Text>
            ) : null}
          </Box>
          <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
        </Flex>
        <Box p={{ base: "16px", md: "22px" }}>{children}</Box>
      </Box>
    </Box>
  );
}

function SummaryLine({ execution }: { execution: Execution }) {
  const summary = execution.summary || {};
  return (
    <Flex mt="7px" gap="12px" wrap="wrap" fontSize="xs">
      <Text><strong>{numberOf(summary.processados)}</strong> processados</Text>
      <Text><strong>{numberOf(summary.sucessos)}</strong> sucessos</Text>
      <Text><strong>{numberOf(summary.criados)}</strong> criados</Text>
      <Text><strong>{numberOf(summary.atualizados)}</strong> atualizados</Text>
      <Text><strong>{numberOf(summary.erros)}</strong> erros</Text>
    </Flex>
  );
}

function ResourceCard({
  resource,
  running,
  disabled,
  onRun,
  onView,
  onDetails,
}: {
  resource: Resource;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
  onView?: () => void;
  onDetails?: () => void;
}) {
  const last = resource.latestExecution;
  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      p="15px"
      bg="gray.50"
    >
      <Flex justify="space-between" align="start" gap="8px">
        <Text fontWeight="700">{resource.label}</Text>
        <Badge colorPalette={palette(last?.status)}>
          {last?.status || "Nunca executada"}
        </Badge>
      </Flex>
      <Text mt="4px" minH="42px" fontSize="sm" color="gray.600">
        {resource.description}
      </Text>
      {last ? (
        <Box mt="10px">
          <Text fontSize="xs" color="gray.500">
            {dateTime(last.startedAt)} · {duration(last.durationMs)}
          </Text>
          <SummaryLine execution={last} />
          {last.error ? (
            <Text mt="5px" fontSize="xs" color="red.700">{last.error}</Text>
          ) : null}
        </Box>
      ) : null}
      <Flex mt="12px" gap="8px" wrap="wrap">
        <Button
          size="sm"
          flex="1"
          variant="outline"
          disabled={disabled}
          onClick={onRun}
        >
          {running ? "Executando..." : (resource.actionLabel || "Sincronizar")}
        </Button>
        {onView ? (
          <Button size="sm" variant="ghost" onClick={onView}>
            Visualizar lista
          </Button>
        ) : null}
        {last && onDetails ? (
          <Button size="sm" variant="ghost" onClick={onDetails}>
            Diagnóstico
          </Button>
        ) : null}
      </Flex>
    </Box>
  );
}

function ListRows({ kind, rows }: { kind: ListKind; rows: Row[] }) {
  if (!rows.length) {
    return <Text fontSize="sm" color="gray.500">Nenhum registro sincronizado.</Text>;
  }

  return (
    <Stack gap="8px">
      {rows.map((row, index) => {
        const code = String(row.codigo || row.codigoClienteOmie || index + 1);
        const title = String(row.descricao || row.nome || "Sem descrição");
        return (
          <Flex
            key={`${code}-${index}`}
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="md"
            p="10px"
            align="center"
            justify="space-between"
            gap="12px"
            wrap="wrap"
          >
            <Box flex="1" minW="220px">
              <Flex align="center" gap="8px" wrap="wrap">
                <Badge variant="outline">{code}</Badge>
                <Text fontWeight="700" fontSize="sm">{title}</Text>
              </Flex>
              <Text mt="3px" fontSize="xs" color="gray.500">
                {kind === "clientes"
                  ? `${row.documento || "Sem documento"} · ${row.cliente ? "Cliente" : ""}${row.fornecedor ? " / Prestador" : ""}`
                  : null}
                {kind === "categorias"
                  ? `${row.natureza || ""} ${row.contaDespesa ? "· Despesa" : ""}`
                  : null}
                {kind === "contas"
                  ? `${row.codigoBanco || "Banco não informado"} · Ag. ${row.codigoAgencia || "—"} · Conta ${row.numeroConta || "—"}`
                  : null}
              </Text>
            </Box>
            <Badge colorPalette={palette(String(row.status || "Ativo"))}>
              {String(row.status || "Ativo")}
            </Badge>
          </Flex>
        );
      })}
    </Stack>
  );
}

function ExecutionDetails({ execution, onClose }: {
  execution: Execution;
  onClose: () => void;
}) {
  return (
    <Modal
      title={execution.title}
      description={`${dateTime(execution.startedAt)} · ${execution.resource}`}
      onClose={onClose}
      maxWidth="1180px"
    >
      <Stack gap="18px">
        <Flex gap="10px" wrap="wrap" align="center">
          <Badge colorPalette={palette(execution.status)}>{execution.status}</Badge>
          <Text fontSize="sm">Duração: <strong>{duration(execution.durationMs)}</strong></Text>
          <Text fontSize="sm">Itens: <strong>{numberOf(execution.itemCount)}</strong></Text>
        </Flex>

        {execution.message ? <Text fontSize="sm">{execution.message}</Text> : null}
        {execution.error ? (
          <Box p="11px" bg="red.50" color="red.800" borderRadius="md">
            <Text fontSize="sm">{execution.error}</Text>
          </Box>
        ) : null}

        <Box>
          <Text fontWeight="700" mb="6px">Resumo</Text>
          <SummaryLine execution={execution} />
        </Box>

        <Box>
          <Text fontWeight="700" mb="8px">
            Erros por registro ({execution.errors?.length || 0})
          </Text>
          {execution.errors?.length ? (
            <Stack gap="8px">
              {execution.errors.map((item, index) => (
                <Box key={`error-${index}`} p="10px" borderWidth="1px" borderColor="red.200" borderRadius="md">
                  <Text fontSize="sm" fontWeight="700">
                    {String(item.codigo || item.pagamentoId || `Erro ${index + 1}`)} · {String(item.descricao || item.etapa || "")}
                  </Text>
                  <Text fontSize="sm" color="red.700">{String(item.erro || item.error || "Erro não informado")}</Text>
                  <Box as="pre" mt="7px" p="8px" bg="gray.50" fontSize="xs" whiteSpace="pre-wrap" overflowX="auto">
                    {json(item)}
                  </Box>
                </Box>
              ))}
            </Stack>
          ) : <Text fontSize="sm" color="gray.500">Nenhum erro por registro.</Text>}
        </Box>

        <Box>
          <Text fontWeight="700" mb="8px">
            Requisições ao Omie ({execution.requests?.length || 0})
          </Text>
          {execution.requests?.length ? (
            <Stack gap="10px">
              {execution.requests.map((request, index) => (
                <Box key={`request-${index}`} p="12px" borderWidth="1px" borderRadius="md">
                  <Flex gap="8px" wrap="wrap" align="center">
                    <Badge colorPalette={palette(request.status)}>{request.status || "—"}</Badge>
                    <Text fontWeight="700" fontSize="sm">{request.call || request.endpoint || "Chamada Omie"}</Text>
                    <Text fontSize="xs">Tentativa {numberOf(request.tentativa)}</Text>
                    <Text fontSize="xs">HTTP {numberOf(request.httpStatus) || "—"}</Text>
                    <Text fontSize="xs">{duration(request.duracaoMs)}</Text>
                  </Flex>
                  <Text mt="5px" fontFamily="mono" fontSize="xs" wordBreak="break-all">
                    {request.url || request.endpoint || "Endpoint não informado"}
                  </Text>
                  {request.erro ? <Text mt="5px" color="red.700" fontSize="sm">{request.erro}</Text> : null}
                  <Grid mt="10px" templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap="10px">
                    <Box>
                      <Text fontSize="xs" fontWeight="700" mb="4px">REQUEST</Text>
                      <Box as="pre" p="9px" bg="gray.50" borderRadius="md" fontSize="xs" whiteSpace="pre-wrap" overflowX="auto">
                        {json(request.request)}
                      </Box>
                    </Box>
                    <Box>
                      <Text fontSize="xs" fontWeight="700" mb="4px">RESPONSE</Text>
                      <Box as="pre" p="9px" bg="gray.50" borderRadius="md" fontSize="xs" whiteSpace="pre-wrap" overflowX="auto">
                        {json(request.response)}
                      </Box>
                    </Box>
                  </Grid>
                </Box>
              ))}
            </Stack>
          ) : <Text fontSize="sm" color="gray.500">Nenhuma chamada técnica registrada.</Text>}
        </Box>

        <Box>
          <Text fontWeight="700" mb="8px">
            Resultado por cadastro ({execution.items?.length || 0})
          </Text>
          {execution.items?.length ? (
            <Stack gap="6px">
              {execution.items.slice(0, 200).map((item, index) => (
                <Flex key={`item-${index}`} p="8px" borderWidth="1px" borderRadius="md" gap="8px" wrap="wrap">
                  <Badge colorPalette={palette(String(item.resultado || ""))}>{String(item.resultado || "—")}</Badge>
                  <Text fontSize="sm" fontWeight="700">{String(item.codigo || "—")}</Text>
                  <Text fontSize="sm">{String(item.descricao || "Sem descrição")}</Text>
                  {item.erro ? <Text fontSize="sm" color="red.700">{String(item.erro)}</Text> : null}
                </Flex>
              ))}
            </Stack>
          ) : <Text fontSize="sm" color="gray.500">Nenhum resultado individual registrado.</Text>}
        </Box>
      </Stack>
    </Modal>
  );
}

export function OmieIntegrationPage({ page }: { page: OonPageDef }) {
  const { http } = useOonApi();
  const [tab, setTab] = useState<TabId>("visao");
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [history, setHistory] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configModal, setConfigModal] = useState(false);
  const [listModal, setListModal] = useState<ListKind | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [listRows, setListRows] = useState<Row[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    urlPublica: "",
    appKey: "",
    appSecret: "",
  });

  const applyConfiguration = useCallback((value: Configuration) => {
    setConfiguration(value);
    setForm({
      nome: value.nome || "",
      urlPublica: value.urlPublica || "",
      appKey: "",
      appSecret: "",
    });
  }, []);

  const load = useCallback(async () => {
    const [configResponse, catalogResponse, historyResponse] = await Promise.all([
      http.get<{ configuracao: Configuration }>("/integracoes/omie/configuracao"),
      http.get<{ data: Resource[] }>("/integracoes/catalogo?provider=omie"),
      http.get<{ data: Execution[] }>(
        "/integracoes/historico?provider=omie&pageIndex=0&pageSize=30",
      ),
    ]);
    applyConfiguration(configResponse.data.configuracao);
    setResources(
      (catalogResponse.data.data || [])
        .sort((left, right) => Number(left.order) - Number(right.order)),
    );
    const executions = historyResponse.data.data || [];
    setHistory(executions);
    return executions;
  }, [applyConfiguration, http]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (requestError) {
        setError(messageOf(requestError));
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const disabled = running !== null
    || !configuration?.credenciaisConfiguradas
    || !configuration?.enabled;
  const masterResources = useMemo(
    () => resources.filter((item) => item.includeInFullSync !== false),
    [resources],
  );
  const financeResource = resources.find((item) => item.key === "contas-pagar");

  function executionFromFailure(requestError: unknown, resource: Resource): Execution | null {
    const data = responseData(requestError);
    const technical = (data.technical || {}) as Row;
    const executionId = String(data.executionId || "");
    if (!executionId && !technical.requests && !technical.errors) return null;
    return {
      _id: executionId || `error-${Date.now()}`,
      title: `Falha em ${resource.label}`,
      resource: resource.key,
      status: "Erro",
      startedAt: new Date().toISOString(),
      error: String(data.message || messageOf(requestError)),
      requests: (technical.requests || []) as TechnicalRequest[],
      errors: (technical.errors || []) as Row[],
      items: [],
      summary: { erros: ((technical.errors || []) as Row[]).length || 1 },
    };
  }

  async function runResource(resource: Resource) {
    if (!window.confirm(`${resource.actionLabel || "Sincronizar"} ${resource.label}?`)) {
      return;
    }
    setRunning(resource.key);
    setMessage(null);
    setError(null);
    try {
      const response = await http.post<{
        result: SyncResult;
      }>(resource.endpoint, {}, { timeout: 0 });
      const result = response.data.result || {};
      const executions = await load();
      const persisted = executions.find((item) => item._id === result.executionId);
      if (persisted) setSelectedExecution(persisted);
      if (result.erros?.length) {
        setError(`${resource.label}: ${result.erros.length} cadastro(s) com erro. Abra o diagnóstico.`);
      } else {
        setMessage(result.message || `${resource.label}: operação concluída.`);
      }
    } catch (requestError) {
      setError(messageOf(requestError));
      const failure = executionFromFailure(requestError, resource);
      if (failure) setSelectedExecution(failure);
      await load();
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    if (
      !window.confirm(
        "Sincronizar Categorias Omie, Contas Correntes e Clientes/Prestadores nesta ordem?",
      )
    ) {
      return;
    }
    setRunning("all");
    setMessage(null);
    setError(null);
    try {
      const response = await http.post<{
        ok: boolean;
        message: string;
        results: Array<{ resource: string; result: SyncResult }>;
        errors: Array<Row>;
      }>(
        "/integracoes/provedores/omie/sincronizar-tudo",
        {},
        { timeout: 0 },
      );
      const partial = (response.data.results || [])
        .filter((item) => item.result?.erros?.length);
      const executions = await load();
      const firstExecutionId = partial[0]?.result?.executionId
        || String(response.data.errors?.[0]?.executionId || "");
      const persisted = executions.find((item) => item._id === firstExecutionId);
      if (persisted) setSelectedExecution(persisted);
      if (!response.data.ok || partial.length) {
        const count = partial.reduce(
          (total, item) => total + Number(item.result.erros?.length || 0),
          response.data.errors?.length || 0,
        );
        setError(`${response.data.message} ${count} erro(s) detalhado(s) no histórico.`);
      } else {
        setMessage(response.data.message || "Cadastros Omie sincronizados.");
      }
    } catch (requestError) {
      setError(messageOf(requestError));
      await load();
    } finally {
      setRunning(null);
    }
  }

  async function saveConfiguration() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload: Row = {
      nome: form.nome.trim(),
      urlPublica: form.urlPublica.trim(),
    };
    if (form.appKey.trim()) payload.appKey = form.appKey.trim();
    if (form.appSecret) payload.appSecret = form.appSecret;

    try {
      const response = await http.put<{ configuracao: Configuration }>(
        "/integracoes/omie/configuracao",
        payload,
      );
      applyConfiguration(response.data.configuracao);
      setConfigModal(false);
      setMessage("Configuração salva.");
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await http.post<{ message?: string }>(
        "/integracoes/omie/testar-conexao",
      );
      setMessage(response.data.message || "Conexão validada.");
      await load();
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setTesting(false);
    }
  }

  async function openList(kind: ListKind, query = "") {
    setListModal(kind);
    setListLoading(true);
    setSearch(query);
    const path = kind === "clientes"
      ? "clientes-prestadores"
      : kind === "contas"
        ? "contas-correntes"
        : "categorias";
    try {
      const response = await http.get<{ data: Row[] }>(
        `/integracoes/omie/listas/${path}?q=${encodeURIComponent(query)}`,
      );
      setListRows(response.data.data || []);
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setListLoading(false);
    }
  }

  async function copyWebhook(url?: string | null) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Não foi possível copiar a URL.");
    }
  }

  if (loading) {
    return (
      <Flex align="center" gap="10px" py="24px">
        <Spinner size="sm" />
        <Text>Carregando integração Omie...</Text>
      </Flex>
    );
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "visao", label: "Visão geral" },
    { id: "cadastros", label: "Cadastros sincronizados" },
    { id: "financeiro", label: "Financeiro" },
    { id: "historico", label: "Histórico" },
    { id: "webhooks", label: "Webhooks" },
  ];
  const listTitles: Record<ListKind, string> = {
    clientes: "Clientes / Prestadores",
    categorias: "Categorias Omie",
    contas: "Contas Correntes Omie",
  };

  return (
    <Stack gap="18px">
      <CorePageHeader
        title={page.title ?? "Integração Omie"}
        description="Cadastros mestres, Contas a Pagar, histórico e webhooks."
        actions={(
          <Flex gap="8px">
            <Badge colorPalette={configuration?.credenciaisConfiguradas ? "green" : "gray"}>
              {configuration?.credenciaisConfiguradas ? "Configurado" : "Não configurado"}
            </Badge>
            <Badge colorPalette={configuration?.enabled ? "green" : "orange"}>
              {configuration?.enabled ? "Ativa" : "Desativada"}
            </Badge>
          </Flex>
        )}
      />

      {message ? (
        <Box p="11px" bg="green.50" color="green.800" borderRadius="md">
          <Text fontSize="sm">{message}</Text>
        </Box>
      ) : null}
      {error ? (
        <Box p="11px" bg="red.50" color="red.800" borderRadius="md">
          <Text fontSize="sm">{error}</Text>
        </Box>
      ) : null}

      <Flex
        gap="6px"
        wrap="wrap"
        borderBottomWidth="1px"
        borderColor="gray.200"
        pb="8px"
      >
        {tabs.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={tab === item.id ? "solid" : "ghost"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </Flex>

      {tab === "visao" ? (
        <Stack gap="15px">
          <Grid templateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }} gap="12px">
            <Box borderWidth="1px" borderRadius="lg" p="16px">
              <Text fontSize="xs" color="gray.500">Conexão</Text>
              <Text mt="4px" fontWeight="700">
                {configuration?.statusConexao || "Não testado"}
              </Text>
              <Text fontSize="xs" color="gray.500">
                App Key: {configuration?.appKeyMascarada || "não configurada"}
              </Text>
            </Box>

            <Box borderWidth="1px" borderRadius="lg" p="16px">
              <Text fontSize="xs" color="gray.500">Mapeamento financeiro</Text>
              <Text mt="4px" fontWeight="700">Categoria Omie por categoria</Text>
              <Text fontSize="xs" color="gray.500">
                A Conta Corrente Omie é selecionada em cada Pagamento.
              </Text>
              <Button
                mt="9px"
                size="sm"
                variant="outline"
                onClick={() => window.location.assign("/categorias")}
              >
                Configurar categorias
              </Button>
            </Box>

            <Box borderWidth="1px" borderRadius="lg" p="16px">
              <Text fontSize="xs" color="gray.500">Carga mestre</Text>
              <Text mt="4px" fontWeight="700">
                Categorias, Contas e Clientes/Prestadores
              </Text>
              <Text fontSize="xs" color="gray.500">
                As listas são sincronizadas e não permitem edição manual.
              </Text>
              <Button mt="9px" size="sm" disabled={disabled} onClick={() => void runAll()}>
                {running === "all" ? "Sincronizando..." : "Sincronizar tudo"}
              </Button>
            </Box>
          </Grid>

          <Flex gap="8px" wrap="wrap">
            <Button onClick={() => setConfigModal(true)}>Editar credenciais</Button>
            <Button
              variant="outline"
              disabled={testing || !configuration?.credenciaisConfiguradas}
              onClick={() => void testConnection()}
            >
              {testing ? "Testando..." : "Testar conexão"}
            </Button>
          </Flex>
          {configuration?.ultimoErroConexao ? (
            <Text color="red.700" fontSize="sm">{configuration.ultimoErroConexao}</Text>
          ) : null}
        </Stack>
      ) : null}

      {tab === "cadastros" ? (
        <Stack gap="14px">
          <Flex justify="space-between" align="start" gap="12px" wrap="wrap">
            <Box>
              <Text fontWeight="700">Listas Omie somente leitura</Text>
              <Text fontSize="sm" color="gray.600">
                Categoria Omie é relacionada em Configurações &gt; Categorias/Subcategorias.
                Contas Correntes Omie são selecionadas nos Pagamentos.
              </Text>
            </Box>
            <Button size="sm" disabled={disabled} onClick={() => void runAll()}>
              {running === "all" ? "Sincronizando..." : "Sincronizar tudo"}
            </Button>
          </Flex>
          <Grid templateColumns={{ base: "1fr", xl: "repeat(3, 1fr)" }} gap="12px">
            {masterResources.map((resource) => (
              <ResourceCard
                key={resource.key}
                resource={resource}
                running={running === resource.key}
                disabled={disabled}
                onRun={() => void runResource(resource)}
                onView={() => void openList(
                  resource.key === "clientes-prestadores"
                    ? "clientes"
                    : resource.key === "categorias"
                      ? "categorias"
                      : "contas",
                )}
                onDetails={() => resource.latestExecution
                  && setSelectedExecution(resource.latestExecution)}
              />
            ))}
          </Grid>
        </Stack>
      ) : null}

      {tab === "financeiro" ? (
        <Stack gap="14px">
          <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap="12px">
            <Box borderWidth="1px" borderRadius="lg" p="17px">
              <Text fontWeight="700">Mapeamento do lançamento</Text>
              <Text mt="4px" fontSize="sm" color="gray.600">
                O envio usa a Categoria Omie da categoria/subcategoria do item e a
                Conta Corrente Omie selecionada no próprio pagamento.
              </Text>
              <Button
                mt="10px"
                size="sm"
                onClick={() => window.location.assign("/esteira-pagamentos")}
              >
                Abrir Pagamentos
              </Button>
            </Box>
            {financeResource ? (
              <ResourceCard
                resource={financeResource}
                running={running === financeResource.key}
                disabled={disabled}
                onRun={() => void runResource(financeResource)}
                onDetails={() => financeResource.latestExecution
                  && setSelectedExecution(financeResource.latestExecution)}
              />
            ) : null}
          </Grid>
          <Flex gap="8px">
            <Button variant="outline" onClick={() => window.location.assign("/integracoes/esteira")}>
              Fila de integrações
            </Button>
            <Button variant="outline" onClick={() => window.location.assign("/integracoes/eventos")}>
              Eventos recebidos
            </Button>
          </Flex>
        </Stack>
      ) : null}

      {tab === "historico" ? (
        <Stack gap="8px">
          {history.length ? history.map((item) => (
            <Flex
              key={item._id}
              borderWidth="1px"
              borderRadius="md"
              p="11px"
              justify="space-between"
              align="center"
              gap="12px"
              wrap="wrap"
            >
              <Box flex="1" minW="260px">
                <Flex gap="8px" align="center" wrap="wrap">
                  <Text fontWeight="700" fontSize="sm">{item.title}</Text>
                  <Badge colorPalette={palette(item.status)}>{item.status}</Badge>
                </Flex>
                <Text fontSize="xs" color="gray.500">
                  {dateTime(item.startedAt)} · {duration(item.durationMs)} · {item.resource}
                </Text>
                {item.error ? <Text fontSize="xs" color="red.700">{item.error}</Text> : null}
                <SummaryLine execution={item} />
              </Box>
              <Button size="sm" variant="outline" onClick={() => setSelectedExecution(item)}>
                Ver diagnóstico
              </Button>
            </Flex>
          )) : (
            <Text color="gray.500">Nenhuma execução registrada.</Text>
          )}
        </Stack>
      ) : null}

      {tab === "webhooks" ? (
        <Stack gap="10px">
          {(configuration?.webhooks || []).map((webhook) => (
            <Box key={webhook.event} borderWidth="1px" borderRadius="md" p="14px">
              <Flex justify="space-between" gap="12px" wrap="wrap">
                <Box flex="1">
                  <Flex gap="8px">
                    <Text fontWeight="700">{webhook.label}</Text>
                    <Badge>{webhook.event}</Badge>
                  </Flex>
                  <Text fontSize="sm" color="gray.600">{webhook.description}</Text>
                  <Text
                    mt="8px"
                    p="8px"
                    bg="gray.50"
                    fontFamily="mono"
                    fontSize="xs"
                    wordBreak="break-all"
                  >
                    {webhook.url || "Informe a URL pública e salve as credenciais."}
                  </Text>
                </Box>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!webhook.url}
                  onClick={() => void copyWebhook(webhook.url)}
                >
                  {copied ? "Copiado" : "Copiar URL"}
                </Button>
              </Flex>
            </Box>
          ))}
        </Stack>
      ) : null}

      {configModal ? (
        <Modal
          title="Credenciais e conectividade Omie"
          description="App Key e App Secret são criptografados e nunca retornam ao navegador."
          onClose={() => setConfigModal(false)}
        >
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="14px">
            <Box>
              <Text fontSize="sm" fontWeight="600">Nome</Text>
              <Input
                value={form.nome}
                onChange={(event) => setForm(
                  (current) => ({ ...current, nome: event.target.value }),
                )}
              />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="600">URL pública</Text>
              <Input
                value={form.urlPublica}
                onChange={(event) => setForm(
                  (current) => ({ ...current, urlPublica: event.target.value }),
                )}
              />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="600">App Key</Text>
              <Input
                value={form.appKey}
                placeholder={configuration?.appKeyMascarada || "App Key"}
                onChange={(event) => setForm(
                  (current) => ({ ...current, appKey: event.target.value }),
                )}
              />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="600">App Secret</Text>
              <Input
                type="password"
                value={form.appSecret}
                placeholder={configuration?.credenciaisConfiguradas
                  ? "Preencha somente para substituir"
                  : "App Secret"}
                onChange={(event) => setForm(
                  (current) => ({ ...current, appSecret: event.target.value }),
                )}
              />
            </Box>
          </Grid>
          <Flex mt="18px" justify="flex-end" gap="8px">
            <Button variant="outline" onClick={() => setConfigModal(false)}>Cancelar</Button>
            <Button disabled={saving || !form.nome.trim()} onClick={() => void saveConfiguration()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </Flex>
        </Modal>
      ) : null}

      {listModal ? (
        <Modal
          title={listTitles[listModal]}
          description="Lista sincronizada com o Omie e sem edição manual."
          onClose={() => setListModal(null)}
        >
          <Flex mb="12px" gap="8px">
            <Input
              value={search}
              placeholder="Pesquisar"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void openList(listModal, search);
              }}
            />
            <Button variant="outline" onClick={() => void openList(listModal, search)}>
              Pesquisar
            </Button>
          </Flex>
          {listLoading ? (
            <Flex gap="8px">
              <Spinner size="sm" />
              <Text>Carregando...</Text>
            </Flex>
          ) : <ListRows kind={listModal} rows={listRows} />}
        </Modal>
      ) : null}

      {selectedExecution ? (
        <ExecutionDetails
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      ) : null}
    </Stack>
  );
}
