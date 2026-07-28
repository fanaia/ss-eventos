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
  processados?: number;
  criados?: number;
  atualizados?: number;
}

interface Execution {
  _id: string;
  title: string;
  resource: string;
  status: string;
  startedAt: string;
  durationMs?: number;
  error?: string;
  summary?: Summary;
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

function messageOf(error: unknown) {
  const value = error as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };
  return value.response?.data?.message
    || value.response?.data?.error
    || value.message
    || "Não foi possível concluir a operação.";
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
  if (text.includes("erro") || text.includes("inativ") || text.includes("bloque")) {
    return "red";
  }
  if (
    text.includes("conclu")
    || text.includes("ativo")
    || text === "ok"
    || text.includes("sincronizado")
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

function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
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
      <Box maxW="980px" mx="auto" bg="white" borderRadius="xl" overflow="hidden">
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

function ResourceCard({
  resource,
  running,
  disabled,
  onRun,
  onView,
}: {
  resource: Resource;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
  onView?: () => void;
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
          <Flex mt="7px" gap="12px" wrap="wrap" fontSize="xs">
            <Text><strong>{numberOf(last.summary?.processados)}</strong> processados</Text>
            <Text><strong>{numberOf(last.summary?.criados)}</strong> criados</Text>
            <Text><strong>{numberOf(last.summary?.atualizados)}</strong> atualizados</Text>
          </Flex>
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
        "/integracoes/historico?provider=omie&pageIndex=0&pageSize=20",
      ),
    ]);
    applyConfiguration(configResponse.data.configuracao);
    setResources(
      (catalogResponse.data.data || [])
        .sort((left, right) => Number(left.order) - Number(right.order)),
    );
    setHistory(historyResponse.data.data || []);
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

  async function runResource(resource: Resource) {
    if (!window.confirm(`${resource.actionLabel || "Sincronizar"} ${resource.label}?`)) {
      return;
    }
    setRunning(resource.key);
    setMessage(null);
    setError(null);
    try {
      await http.post(resource.endpoint, {}, { timeout: 0 });
      setMessage(`${resource.label}: operação concluída.`);
      await load();
    } catch (requestError) {
      setError(messageOf(requestError));
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
      await http.post(
        "/integracoes/provedores/omie/sincronizar-tudo",
        {},
        { timeout: 0 },
      );
      setMessage("Cadastros Omie sincronizados.");
      await load();
    } catch (requestError) {
      setError(messageOf(requestError));
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
          <Grid
            templateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }}
            gap="12px"
          >
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
              <Text fontSize="xs" color="gray.500">Mapeamentos financeiros</Text>
              <Text mt="4px" fontWeight="700">
                Categoria Omie + Conta Corrente por categoria
              </Text>
              <Text fontSize="xs" color="gray.500">
                A subcategoria pode sobrescrever os vínculos da categoria pai.
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
              <Button
                mt="9px"
                size="sm"
                disabled={disabled}
                onClick={() => void runAll()}
              >
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
            <Text color="red.700" fontSize="sm">
              {configuration.ultimoErroConexao}
            </Text>
          ) : null}
        </Stack>
      ) : null}

      {tab === "cadastros" ? (
        <Stack gap="14px">
          <Flex justify="space-between" align="start" gap="12px" wrap="wrap">
            <Box>
              <Text fontWeight="700">Listas Omie somente leitura</Text>
              <Text fontSize="sm" color="gray.600">
                Categoria Omie e Conta Corrente Omie são relacionadas em
                Configurações &gt; Categorias/Subcategorias.
              </Text>
            </Box>
            <Button
              size="sm"
              disabled={disabled}
              onClick={() => void runAll()}
            >
              {running === "all" ? "Sincronizando..." : "Sincronizar tudo"}
            </Button>
          </Flex>
          <Grid
            templateColumns={{ base: "1fr", xl: "repeat(3, 1fr)" }}
            gap="12px"
          >
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
              />
            ))}
          </Grid>
        </Stack>
      ) : null}

      {tab === "financeiro" ? (
        <Stack gap="14px">
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
            gap="12px"
          >
            <Box borderWidth="1px" borderRadius="lg" p="17px">
              <Text fontWeight="700">Mapeamento do lançamento</Text>
              <Text mt="4px" fontSize="sm" color="gray.600">
                O envio usa a Categoria Omie e a Conta Corrente Omie vinculadas
                à subcategoria ou à categoria do item.
              </Text>
              <Button
                mt="10px"
                size="sm"
                onClick={() => window.location.assign("/categorias")}
              >
                Abrir Categorias/Subcategorias
              </Button>
            </Box>
            {financeResource ? (
              <ResourceCard
                resource={financeResource}
                running={running === financeResource.key}
                disabled={disabled}
                onRun={() => void runResource(financeResource)}
              />
            ) : null}
          </Grid>
          <Flex gap="8px">
            <Button
              variant="outline"
              onClick={() => window.location.assign("/integracoes/esteira")}
            >
              Fila de integrações
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign("/integracoes/eventos")}
            >
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
              <Box>
                <Flex gap="8px" align="center">
                  <Text fontWeight="700" fontSize="sm">{item.title}</Text>
                  <Badge colorPalette={palette(item.status)}>{item.status}</Badge>
                </Flex>
                <Text fontSize="xs" color="gray.500">
                  {dateTime(item.startedAt)} · {duration(item.durationMs)} · {item.resource}
                </Text>
                {item.error ? (
                  <Text fontSize="xs" color="red.700">{item.error}</Text>
                ) : null}
              </Box>
              <Text fontSize="xs">
                <strong>{numberOf(item.summary?.processados)}</strong> processados ·{" "}
                <strong>{numberOf(item.summary?.criados)}</strong> criados ·{" "}
                <strong>{numberOf(item.summary?.atualizados)}</strong> atualizados
              </Text>
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
          <Grid
            templateColumns={{ base: "1fr", md: "1fr 1fr" }}
            gap="14px"
          >
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
                placeholder={
                  configuration?.credenciaisConfiguradas
                    ? "Preencha somente para substituir"
                    : "App Secret"
                }
                onChange={(event) => setForm(
                  (current) => ({ ...current, appSecret: event.target.value }),
                )}
              />
            </Box>
          </Grid>
          <Flex mt="18px" justify="flex-end" gap="8px">
            <Button variant="outline" onClick={() => setConfigModal(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saving || !form.nome.trim()}
              onClick={() => void saveConfiguration()}
            >
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
            <Button
              variant="outline"
              onClick={() => void openList(listModal, search)}
            >
              Pesquisar
            </Button>
          </Flex>
          {listLoading ? (
            <Flex gap="8px">
              <Spinner size="sm" />
              <Text>Carregando...</Text>
            </Flex>
          ) : (
            <ListRows kind={listModal} rows={listRows} />
          )}
        </Modal>
      ) : null}
    </Stack>
  );
}
