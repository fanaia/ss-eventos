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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type ExecutionStatus = "Executando" | "Concluído" | "Erro";

interface IntegrationSummary {
  totalRecebidos?: number;
  totalInformadoPeloProvedor?: number;
  paginas?: number;
  processados?: number;
  criados?: number;
  atualizados?: number;
  semAlteracao?: number;
  ignorados?: number;
  removidos?: number;
  erros?: number;
}

interface IntegrationExecution {
  _id: string;
  provider: string;
  resource: string;
  operation: string;
  title: string;
  status: ExecutionStatus;
  startedAt: string;
  concludedAt?: string;
  durationMs?: number;
  message?: string;
  error?: string;
  summary?: IntegrationSummary;
  items?: Array<Record<string, unknown>>;
  itemCount?: number;
  itemsLimited?: boolean;
}

interface IntegrationResource {
  key: string;
  label: string;
  description: string;
  endpoint: string;
  order: number;
  actionLabel?: string;
  includeInFullSync?: boolean;
  latestExecution?: IntegrationExecution | null;
}

interface OmieWebhookDefinition {
  event: string;
  label: string;
  description: string;
  url: string | null;
}

interface OmieConfiguration {
  _id: string;
  nome: string;
  ambiente: string;
  urlPublica: string;
  contaCorrenteId: number | null;
  appKeyMascarada: string;
  credenciaisConfiguradas: boolean;
  statusConexao: string;
  ultimoErroConexao: string;
  webhookUrl: string;
  enabled: boolean;
  webhooks: OmieWebhookDefinition[];
}

interface ConfigurationResponse {
  configuracao: OmieConfiguration;
}

interface CatalogResponse {
  provider: string;
  data: IntegrationResource[];
}

interface HistoryResponse {
  data: IntegrationExecution[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

interface FormState {
  nome: string;
  urlPublica: string;
  contaCorrenteId: string;
  appKey: string;
  appSecret: string;
}

function errorMessage(error: unknown) {
  const candidate = error as {
    response?: { data?: { message?: string; error?: string; errors?: Array<{ error?: string }> } };
    message?: string;
  };
  return candidate.response?.data?.message
    || candidate.response?.data?.error
    || candidate.response?.data?.errors?.map((item) => item.error).filter(Boolean).join("; ")
    || candidate.message
    || "Não foi possível concluir a operação.";
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text as="label" display="block" fontSize="sm" fontWeight="600" mb="6px">
      {children}
    </Text>
  );
}

function numeric(value?: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(milliseconds?: number) {
  const value = numeric(milliseconds);
  if (value < 1000) return `${value} ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function statusPalette(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("conclu") || normalized === "ok") return "green";
  if (normalized.includes("erro")) return "red";
  if (normalized.includes("execut") || normalized.includes("process")) return "blue";
  return "gray";
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" bg="gray.50" px="10px" py="8px">
      <Text fontSize="xs" color="gray.600">{label}</Text>
      <Text mt="2px" fontSize="md" fontWeight="700" color="gray.800">{numeric(value)}</Text>
    </Box>
  );
}

function CompactSummary({ summary }: { summary?: IntegrationSummary }) {
  return (
    <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap="6px">
      <Metric label="Processados" value={summary?.processados} />
      <Metric label="Criados" value={summary?.criados} />
      <Metric label="Atualizados" value={summary?.atualizados} />
    </Grid>
  );
}

function itemLabel(item: Record<string, unknown>, index: number) {
  const code = item.codigo || item.code || item.id || item._id || index + 1;
  const description = item.descricao || item.description || item.nome || item.name || item.resultado;
  return {
    code: String(code),
    description: description ? String(description) : JSON.stringify(item),
  };
}

function ExecutionDetails({ execution }: { execution: IntegrationExecution }) {
  const items = Array.isArray(execution.items) ? execution.items : [];
  return (
    <Box borderWidth="1px" borderColor="blue.200" borderRadius="lg" bg="blue.50" p={{ base: "14px", md: "18px" }}>
      <Flex justify="space-between" align="start" gap="12px" wrap="wrap">
        <Box>
          <Flex align="center" gap="8px" wrap="wrap">
            <Text fontWeight="700">{execution.title}</Text>
            <Badge colorPalette={statusPalette(execution.status)} variant="subtle">
              {execution.status}
            </Badge>
          </Flex>
          <Text mt="3px" fontSize="xs" color="gray.600">
            {formatDateTime(execution.startedAt)} · {formatDuration(execution.durationMs)}
          </Text>
        </Box>
        <Text fontSize="xs" color="gray.500">{execution.resource}</Text>
      </Flex>

      {execution.error ? (
        <Box mt="12px" borderWidth="1px" borderColor="red.200" bg="red.50" color="red.800" borderRadius="md" p="10px">
          <Text fontSize="sm">{execution.error}</Text>
        </Box>
      ) : null}

      <Grid mt="14px" templateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }} gap="8px">
        <Metric label="Processados" value={execution.summary?.processados} />
        <Metric label="Criados" value={execution.summary?.criados} />
        <Metric label="Atualizados" value={execution.summary?.atualizados} />
        <Metric label="Sem alteração" value={execution.summary?.semAlteracao} />
        <Metric label="Erros" value={execution.summary?.erros} />
      </Grid>

      {items.length ? (
        <Box mt="14px" maxH="320px" overflowY="auto" borderWidth="1px" borderColor="gray.200" borderRadius="md" bg="white">
          {items.map((item, index) => {
            const display = itemLabel(item, index);
            return (
              <Flex
                key={`${display.code}-${index}`}
                px="10px"
                py="9px"
                gap="10px"
                align="start"
                borderBottomWidth={index < items.length - 1 ? "1px" : "0"}
                borderColor="gray.100"
              >
                <Badge variant="outline" colorPalette="blue" flexShrink={0}>{display.code}</Badge>
                <Text fontSize="sm" fontWeight="600" wordBreak="break-word">{display.description}</Text>
              </Flex>
            );
          })}
        </Box>
      ) : (
        <Text mt="12px" fontSize="sm" color="gray.600">
          Esta execução possui o resumo consolidado, sem detalhamento individual de itens.
        </Text>
      )}
    </Box>
  );
}

function ResourceCard({
  resource,
  active,
  disabled,
  expanded,
  onRun,
  onToggle,
}: {
  resource: IntegrationResource;
  active: boolean;
  disabled: boolean;
  expanded: boolean;
  onRun: () => void;
  onToggle: () => void;
}) {
  const last = resource.latestExecution;
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" p="14px" bg="gray.50">
      <Flex justify="space-between" align="start" gap="8px">
        <Text fontWeight="700" fontSize="sm">{resource.label}</Text>
        {last ? (
          <Badge colorPalette={statusPalette(last.status)} variant="subtle">{last.status}</Badge>
        ) : (
          <Badge colorPalette="gray" variant="subtle">Nunca executada</Badge>
        )}
      </Flex>
      <Text minH="42px" mt="4px" fontSize="xs" color="gray.600">{resource.description}</Text>

      {last ? (
        <Box mt="10px">
          <Text fontSize="xs" color="gray.500" mb="6px">
            Última: {formatDateTime(last.startedAt)} · {formatDuration(last.durationMs)}
          </Text>
          <CompactSummary summary={last.summary} />
        </Box>
      ) : null}

      <Flex mt="12px" gap="8px" wrap="wrap">
        <Button size="sm" flex="1" variant="outline" disabled={disabled} onClick={onRun}>
          {active ? "Executando..." : (resource.actionLabel || "Sincronizar")}
        </Button>
        <Button size="sm" variant="ghost" disabled={!last} onClick={onToggle}>
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        </Button>
      </Flex>
    </Box>
  );
}

export function OmieIntegrationPage({ page }: { page: OonPageDef }) {
  const { http } = useOonApi();
  const [configuration, setConfiguration] = useState<OmieConfiguration | null>(null);
  const [form, setForm] = useState<FormState>({
    nome: "",
    urlPublica: "",
    contaCorrenteId: "",
    appKey: "",
    appSecret: "",
  });
  const [catalog, setCatalog] = useState<IntegrationResource[]>([]);
  const [history, setHistory] = useState<IntegrationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeResource, setActiveResource] = useState<string | null>(null);
  const [expandedExecution, setExpandedExecution] = useState<IntegrationExecution | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedEvent, setCopiedEvent] = useState<string | null>(null);

  const applyConfiguration = useCallback((next: OmieConfiguration) => {
    setConfiguration(next);
    setForm({
      nome: next.nome || "",
      urlPublica: next.urlPublica || "",
      contaCorrenteId: next.contaCorrenteId ? String(next.contaCorrenteId) : "",
      appKey: "",
      appSecret: "",
    });
  }, []);

  const loadConfiguration = useCallback(async () => {
    const response = await http.get<ConfigurationResponse>("/integracoes/omie/configuracao");
    applyConfiguration(response.data.configuracao);
  }, [applyConfiguration, http]);

  const loadIntegrationData = useCallback(async () => {
    setSyncLoading(true);
    try {
      const [catalogResponse, historyResponse] = await Promise.all([
        http.get<CatalogResponse>("/integracoes/catalogo?provider=omie"),
        http.get<HistoryResponse>("/integracoes/historico?provider=omie&pageIndex=0&pageSize=12"),
      ]);
      setCatalog((catalogResponse.data.data || []).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)));
      setHistory(historyResponse.data.data || []);
    } finally {
      setSyncLoading(false);
    }
  }, [http]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await Promise.all([loadConfiguration(), loadIntegrationData()]);
      } catch (requestError) {
        setError(errorMessage(requestError));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadConfiguration, loadIntegrationData]);

  const expandedId = expandedExecution?._id;
  const running = activeResource !== null;
  const operationDisabled = running || !configuration?.credenciaisConfiguradas || !configuration?.enabled;
  const fullSyncResources = useMemo(
    () => catalog.filter((resource) => resource.includeInFullSync !== false),
    [catalog],
  );

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        nome: form.nome.trim(),
        urlPublica: form.urlPublica.trim(),
        contaCorrenteId: form.contaCorrenteId ? Number(form.contaCorrenteId) : null,
      };
      if (form.appKey.trim()) payload.appKey = form.appKey.trim();
      if (form.appSecret.trim()) payload.appSecret = form.appSecret;
      const response = await http.put<ConfigurationResponse>("/integracoes/omie/configuracao", payload);
      applyConfiguration(response.data.configuracao);
      setMessage("Configuração Omie salva com segurança.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await http.post<{ message?: string }>("/integracoes/omie/testar-conexao");
      setMessage(response.data.message || "Conexão com o Omie validada com sucesso.");
      await loadConfiguration();
    } catch (requestError) {
      setError(errorMessage(requestError));
      await loadConfiguration();
    } finally {
      setTesting(false);
    }
  }

  async function runResource(resource: IntegrationResource) {
    const action = resource.actionLabel || "Sincronizar";
    if (!window.confirm(`${action} ${resource.label} agora?`)) return;
    setActiveResource(resource.key);
    setMessage(null);
    setError(null);
    try {
      await http.post(resource.endpoint, {}, { timeout: 0 });
      setMessage(`${resource.label}: operação concluída.`);
      await loadIntegrationData();
    } catch (requestError) {
      setError(errorMessage(requestError));
      await loadIntegrationData();
    } finally {
      setActiveResource(null);
    }
  }

  async function runFullSync() {
    if (!window.confirm("Sincronizar todos os cadastros do Omie na ordem segura? A operação pode levar alguns minutos.")) return;
    setActiveResource("all");
    setMessage(null);
    setError(null);
    try {
      const response = await http.post<{ message?: string }>(
        "/integracoes/provedores/omie/sincronizar-tudo",
        {},
        { timeout: 0 },
      );
      setMessage(response.data.message || `${fullSyncResources.length} recursos sincronizados.`);
      await loadIntegrationData();
    } catch (requestError) {
      setError(errorMessage(requestError));
      await loadIntegrationData();
    } finally {
      setActiveResource(null);
    }
  }

  function toggleExecution(execution?: IntegrationExecution | null) {
    if (!execution) return;
    setExpandedExecution((current) => current?._id === execution._id ? null : execution);
  }

  async function copyWebhook(webhook: OmieWebhookDefinition) {
    if (!webhook.url) return;
    try {
      await navigator.clipboard.writeText(webhook.url);
      setCopiedEvent(webhook.event);
      window.setTimeout(() => setCopiedEvent(null), 1800);
    } catch {
      setError("Não foi possível copiar a URL. Selecione e copie manualmente.");
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

  return (
    <Stack gap="20px">
      <CorePageHeader
        title={page.title ?? "Integração Omie"}
        description="Credenciais, sincronizações, histórico e webhooks organizados em uma única operação."
        actions={
          <Flex gap="8px" wrap="wrap">
            <Badge colorPalette={configuration?.credenciaisConfiguradas ? "green" : "gray"} variant="subtle">
              {configuration?.credenciaisConfiguradas ? "Credenciais configuradas" : "Não configurado"}
            </Badge>
            <Badge colorPalette={configuration?.enabled ? "green" : "orange"} variant="subtle">
              {configuration?.enabled ? "Integração ativa" : "Integração desativada"}
            </Badge>
          </Flex>
        }
      />

      {message ? (
        <Box borderWidth="1px" borderColor="green.200" bg="green.50" color="green.800" borderRadius="md" p="12px">
          <Text fontSize="sm">{message}</Text>
        </Box>
      ) : null}
      {error ? (
        <Box borderWidth="1px" borderColor="red.200" bg="red.50" color="red.800" borderRadius="md" p="12px">
          <Text fontSize="sm">{error}</Text>
        </Box>
      ) : null}
      {!configuration?.enabled ? (
        <Box borderWidth="1px" borderColor="orange.200" bg="orange.50" color="orange.800" borderRadius="md" p="12px">
          <Text fontSize="sm">A configuração pode ser preenchida, mas as operações ficam bloqueadas enquanto OMIE_ENABLED não estiver ativo.</Text>
        </Box>
      ) : null}

      <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" bg="white" p={{ base: "16px", md: "22px" }}>
        <Flex justify="space-between" align="start" gap="16px" mb="18px" wrap="wrap">
          <Box>
            <Text fontWeight="700">Credenciais do aplicativo</Text>
            <Text fontSize="sm" color="gray.600" mt="4px">
              App Key e App Secret são gravados criptografados e nunca retornam ao navegador.
            </Text>
          </Box>
          <Badge colorPalette={statusPalette(configuration?.statusConexao)} variant="subtle">
            Conexão: {configuration?.statusConexao || "Não testado"}
          </Badge>
        </Flex>

        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="16px">
          <Box>
            <FieldLabel>Nome da integração</FieldLabel>
            <Input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} />
          </Box>
          <Box>
            <FieldLabel>URL pública do backend</FieldLabel>
            <Input value={form.urlPublica} placeholder="https://api.exemplo.com.br" onChange={(event) => setForm((current) => ({ ...current, urlPublica: event.target.value }))} />
          </Box>
          <Box>
            <FieldLabel>App Key</FieldLabel>
            <Input
              value={form.appKey}
              autoComplete="off"
              placeholder={configuration?.appKeyMascarada || "Chave do aplicativo Omie"}
              onChange={(event) => setForm((current) => ({ ...current, appKey: event.target.value }))}
            />
          </Box>
          <Box>
            <FieldLabel>App Secret</FieldLabel>
            <Input
              type="password"
              value={form.appSecret}
              autoComplete="new-password"
              placeholder={configuration?.credenciaisConfiguradas ? "Já configurado — preencha somente para substituir" : "Segredo do aplicativo Omie"}
              onChange={(event) => setForm((current) => ({ ...current, appSecret: event.target.value }))}
            />
          </Box>
          <Box>
            <FieldLabel>Conta corrente Omie</FieldLabel>
            <Input
              inputMode="numeric"
              value={form.contaCorrenteId}
              placeholder="Código da conta corrente"
              onChange={(event) => setForm((current) => ({ ...current, contaCorrenteId: event.target.value.replace(/\D/g, "") }))}
            />
          </Box>
        </Grid>

        {configuration?.ultimoErroConexao ? (
          <Text mt="12px" fontSize="sm" color="red.700">{configuration.ultimoErroConexao}</Text>
        ) : null}

        <Flex mt="20px" gap="10px" wrap="wrap">
          <Button onClick={save} disabled={saving || !form.nome.trim()}>
            {saving ? "Salvando..." : "Salvar configuração"}
          </Button>
          <Button variant="outline" onClick={testConnection} disabled={testing || !configuration?.credenciaisConfiguradas}>
            {testing ? "Testando..." : "Testar conexão"}
          </Button>
        </Flex>
      </Box>

      <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" bg="white" p={{ base: "16px", md: "22px" }}>
        <Flex justify="space-between" align="start" gap="14px" wrap="wrap">
          <Box>
            <Text fontWeight="700">Sincronizações Omie → Central</Text>
            <Text fontSize="sm" color="gray.600" mt="4px">
              Execute cada recurso isoladamente ou sincronize os cadastros na ordem segura.
            </Text>
          </Box>
          <Flex gap="8px" wrap="wrap">
            <Button size="sm" variant="outline" onClick={() => window.location.assign("/integracoes/esteira")}>Fila de integrações</Button>
            <Button size="sm" variant="outline" onClick={() => window.location.assign("/integracoes/eventos")}>Eventos recebidos</Button>
            <Button size="sm" disabled={operationDisabled} onClick={() => void runFullSync()}>
              {activeResource === "all" ? "Sincronizando tudo..." : "Sincronizar tudo"}
            </Button>
          </Flex>
        </Flex>

        {syncLoading ? (
          <Flex mt="18px" align="center" gap="10px">
            <Spinner size="sm" />
            <Text fontSize="sm">Carregando histórico das sincronizações...</Text>
          </Flex>
        ) : (
          <Grid mt="18px" templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="12px">
            {catalog.map((resource) => (
              <ResourceCard
                key={resource.key}
                resource={resource}
                active={activeResource === resource.key}
                disabled={operationDisabled}
                expanded={Boolean(resource.latestExecution && expandedId === resource.latestExecution._id)}
                onRun={() => void runResource(resource)}
                onToggle={() => toggleExecution(resource.latestExecution)}
              />
            ))}
          </Grid>
        )}

        {running ? (
          <Flex mt="16px" align="center" gap="10px" color="blue.700">
            <Spinner size="sm" />
            <Text fontSize="sm">Consultando o Omie e atualizando a Central. A operação pode levar alguns minutos.</Text>
          </Flex>
        ) : null}

        {expandedExecution ? (
          <Box mt="18px">
            <ExecutionDetails execution={expandedExecution} />
          </Box>
        ) : null}
      </Box>

      <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" bg="white" p={{ base: "16px", md: "22px" }}>
        <Flex justify="space-between" align="center" gap="12px" wrap="wrap" mb="14px">
          <Box>
            <Text fontWeight="700">Últimas integrações</Text>
            <Text fontSize="sm" color="gray.600" mt="4px">
              Histórico persistente das cargas manuais, reconciliações e falhas.
            </Text>
          </Box>
          <Badge variant="subtle" colorPalette="blue">{history.length} recentes</Badge>
        </Flex>

        {history.length ? (
          <Stack gap="8px">
            {history.map((execution) => (
              <Flex
                key={execution._id}
                borderWidth="1px"
                borderColor={expandedId === execution._id ? "blue.300" : "gray.200"}
                borderRadius="md"
                p="10px"
                align="center"
                justify="space-between"
                gap="12px"
                wrap="wrap"
              >
                <Box minW="220px" flex="1">
                  <Flex align="center" gap="8px" wrap="wrap">
                    <Text fontSize="sm" fontWeight="700">{execution.title}</Text>
                    <Badge variant="subtle" colorPalette={statusPalette(execution.status)}>{execution.status}</Badge>
                  </Flex>
                  <Text fontSize="xs" color="gray.500" mt="2px">
                    {formatDateTime(execution.startedAt)} · {formatDuration(execution.durationMs)}
                  </Text>
                </Box>
                <Flex gap="14px" align="center" wrap="wrap">
                  <Text fontSize="xs"><strong>{numeric(execution.summary?.processados)}</strong> processados</Text>
                  <Text fontSize="xs"><strong>{numeric(execution.summary?.criados)}</strong> criados</Text>
                  <Text fontSize="xs"><strong>{numeric(execution.summary?.atualizados)}</strong> atualizados</Text>
                  <Button size="xs" variant="ghost" onClick={() => toggleExecution(execution)}>
                    {expandedId === execution._id ? "Ocultar" : "Ver resumo"}
                  </Button>
                </Flex>
              </Flex>
            ))}
          </Stack>
        ) : (
          <Text fontSize="sm" color="gray.500">Nenhuma sincronização registrada ainda.</Text>
        )}
      </Box>

      <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" bg="white" p={{ base: "16px", md: "22px" }}>
        <Text fontWeight="700">Webhooks para configurar no Omie</Text>
        <Text fontSize="sm" color="gray.600" mt="4px" mb="16px">
          Cadastre a URL abaixo no aplicativo Omie. O endpoint é protegido por token e o evento recebido fica auditável na Central.
        </Text>

        <Stack gap="12px">
          {(configuration?.webhooks || []).map((webhook) => (
            <Box key={webhook.event} borderWidth="1px" borderColor="gray.200" borderRadius="md" p="14px">
              <Flex justify="space-between" align="start" gap="12px" wrap="wrap">
                <Box flex="1" minW="240px">
                  <Flex align="center" gap="8px" wrap="wrap">
                    <Text fontWeight="700" fontSize="sm">{webhook.label}</Text>
                    <Badge variant="subtle" colorPalette="blue">{webhook.event}</Badge>
                  </Flex>
                  <Text fontSize="sm" color="gray.600" mt="4px">{webhook.description}</Text>
                  <Box mt="10px" px="10px" py="8px" bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
                    <Text fontFamily="mono" fontSize="xs" wordBreak="break-all" color={webhook.url ? "gray.800" : "gray.500"}>
                      {webhook.url || "Informe a URL pública e salve a configuração para gerar o webhook."}
                    </Text>
                  </Box>
                </Box>
                <Button size="sm" variant="outline" disabled={!webhook.url} onClick={() => void copyWebhook(webhook)}>
                  {copiedEvent === webhook.event ? "Copiado" : "Copiar URL"}
                </Button>
              </Flex>
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
