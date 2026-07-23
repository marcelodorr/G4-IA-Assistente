import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { executeIntegrationQuery } from "@/lib/integrations/client";
import { listUserIntegrations } from "@/lib/services/integrations";
import type { IntegrationProvider } from "@/lib/integrations/catalog";

type Owner = { userId: string; conversationId: string };

export async function createIntegrationTools(db: Db, owner: Owner, options?: { beforeCall?: () => void; providers?: IntegrationProvider[] }): Promise<ToolSet> {
  const integrations = await listUserIntegrations(db, owner.userId);
  const allowed = options?.providers ? new Set(options.providers) : null;
  const connected = new Set(integrations.filter((item) => item.connected && (!allowed || allowed.has(item.id))).map((item) => item.id));
  const execute = (provider: Parameters<typeof executeIntegrationQuery>[1]["provider"], action: string, params: Record<string, unknown>) => {
    options?.beforeCall?.();
    return executeIntegrationQuery(db, { ...owner, provider, action, params });
  };
  const tools: ToolSet = {};

  if (connected.has("google_calendar")) tools.consultarGoogleCalendar = tool({
    description: "Consulta eventos reais do Google Calendar conectado pelo usuário. Use somente quando a pergunta depender da agenda atual.",
    inputSchema: z.object({
      from: z.string().datetime().optional().describe("Início ISO 8601; padrão: agora"),
      to: z.string().datetime().optional().describe("Fim ISO 8601; padrão: 30 dias"),
      query: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    execute: (params) => execute("google_calendar", "list_events", params),
  });

  if (connected.has("hubspot")) tools.consultarHubSpot = tool({
    description: "Consulta dados atuais e somente leitura no HubSpot do usuário: contatos, empresas ou negócios.",
    inputSchema: z.object({ resource: z.enum(["contacts", "companies", "deals"]), query: z.string().max(200).optional(), limit: z.number().int().min(1).max(50).default(20) }),
    execute: (params) => execute("hubspot", `consult_${params.resource}`, params),
  });

  if (connected.has("pipedrive")) tools.consultarPipedrive = tool({
    description: "Consulta dados atuais e somente leitura no Pipedrive do usuário: negócios, pessoas ou organizações.",
    inputSchema: z.object({ resource: z.enum(["deals", "persons", "organizations"]), query: z.string().max(200).optional(), limit: z.number().int().min(1).max(50).default(20) }),
    execute: (params) => execute("pipedrive", `consult_${params.resource}`, params),
  });

  if (connected.has("apify")) tools.consultarApify = tool({
    description: "Consulta datasets, Actors e execuções atuais da conta Apify do usuário. Não inicia Actors e não altera dados.",
    inputSchema: z.object({ action: z.enum(["list_datasets", "list_actors", "list_runs", "dataset_items"]), datasetId: z.string().max(200).optional(), limit: z.number().int().min(1).max(50).default(20) }),
    execute: (params) => execute("apify", params.action, params),
  });

  if (connected.has("jira")) tools.consultarJira = tool({
    description: "Consulta projetos e issues atuais do Jira do usuário. Para issues, use JQL somente leitura.",
    inputSchema: z.object({ action: z.enum(["search_issues", "list_projects"]), jql: z.string().max(1_000).optional(), limit: z.number().int().min(1).max(50).default(20) }),
    execute: (params) => execute("jira", params.action, params),
  });

  if (connected.has("gitbook")) tools.consultarGitBook = tool({
    description: "Consulta documentação atual e somente leitura no GitBook do usuário: organizações, espaços, buscas e páginas em Markdown. Use como fonte principal quando este assistente estiver configurado com GitBook.",
    inputSchema: z.object({
      action: z.enum(["list_organizations", "list_spaces", "search", "list_pages", "get_page"]),
      organizationId: z.string().max(200).optional().describe("Obrigatório para listar espaços ou pesquisar"),
      spaceId: z.string().max(200).optional().describe("Obrigatório para listar ou ler páginas"),
      pageId: z.string().max(200).optional().describe("Obrigatório para ler uma página"),
      query: z.string().max(512).optional().describe("Texto da busca"),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    execute: (params) => execute("gitbook", params.action, params),
  });
  return tools;
}
