import {
  Box,
  Button,
  Flex,
  Grid,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  CorePageHeader,
  type OonPageDef,
} from "@oondemand/oon-core-front";
import { useNavigate } from "react-router-dom";

interface SettingsCard {
  title: string;
  description: string;
  path: string;
  action: string;
}

interface SettingsGroup {
  title: string;
  description: string;
  cards: SettingsCard[];
}

const GROUPS: SettingsGroup[] = [
  {
    title: "Cadastros auxiliares",
    description:
      "Tabelas internas utilizadas pelos processos da Central e pelos lançamentos financeiros.",
    cards: [
      {
        title: "Categorias/Subcategorias",
        description:
          "Organize as categorias internas e relacione a Categoria Omie usada nos Contas a Pagar.",
        path: "/categorias",
        action: "Abrir categorias",
      },
      {
        title: "Responsáveis",
        description:
          "Cadastre responsáveis operacionais e financeiros utilizados nos projetos, itens e pagamentos.",
        path: "/responsaveis",
        action: "Abrir responsáveis",
      },
    ],
  },
  {
    title: "Integrações",
    description:
      "Configuração, operação e acompanhamento das comunicações com sistemas externos.",
    cards: [
      {
        title: "Omie",
        description:
          "Credenciais, cadastros sincronizados, financeiro, histórico técnico e webhooks.",
        path: "/integracoes/omie",
        action: "Abrir Omie",
      },
      {
        title: "Fila de integrações",
        description:
          "Acompanhe tickets pendentes, processando, concluídos ou com erro e faça reprocessamentos.",
        path: "/integracoes/esteira",
        action: "Abrir fila",
      },
      {
        title: "Eventos recebidos",
        description:
          "Consulte webhooks recebidos, processamento, tentativas e eventuais falhas.",
        path: "/integracoes/eventos",
        action: "Abrir eventos",
      },
    ],
  },
  {
    title: "Auditoria",
    description:
      "Rastreabilidade das execuções automáticas e das integrações realizadas pela Central.",
    cards: [
      {
        title: "Histórico de integrações",
        description:
          "Consulte endpoint, request e response sanitizados, duração, resultado e erros por execução.",
        path: "/integracoes/historico",
        action: "Abrir histórico",
      },
    ],
  },
];

function SettingsCardView({ card }: { card: SettingsCard }) {
  const navigate = useNavigate();

  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      bg="white"
      p="18px"
      minH="190px"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      boxShadow="0 1px 2px rgba(15, 23, 42, 0.04)"
    >
      <Box>
        <Text fontWeight="800" color="#24323A" fontSize="md">
          {card.title}
        </Text>
        <Text mt="7px" color="gray.600" fontSize="sm" lineHeight="1.55">
          {card.description}
        </Text>
      </Box>
      <Button
        mt="18px"
        alignSelf="flex-start"
        size="sm"
        variant="outline"
        onClick={() => navigate(card.path)}
      >
        {card.action}
      </Button>
    </Box>
  );
}

export function SettingsHomePage({ page }: { page: OonPageDef }) {
  return (
    <Stack gap="24px">
      <CorePageHeader
        title={page.title ?? "Configurações"}
        description="Cadastros auxiliares, integrações e auditoria da Central SS Eventos."
      />

      {GROUPS.map((group) => (
        <Box key={group.title}>
          <Flex align="flex-start" justify="space-between" gap="16px" mb="12px">
            <Box>
              <Text fontWeight="800" color="#24323A" fontSize="lg">
                {group.title}
              </Text>
              <Text mt="3px" color="gray.600" fontSize="sm">
                {group.description}
              </Text>
            </Box>
          </Flex>
          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }}
            gap="14px"
          >
            {group.cards.map((card) => (
              <SettingsCardView key={card.path} card={card} />
            ))}
          </Grid>
        </Box>
      ))}
    </Stack>
  );
}
