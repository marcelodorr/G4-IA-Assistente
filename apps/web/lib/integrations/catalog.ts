export const INTEGRATION_PROVIDERS = ["google_calendar", "hubspot", "pipedrive", "apify", "jira"] as const;
export type IntegrationProvider = typeof INTEGRATION_PROVIDERS[number];

export type IntegrationDefinition = {
  id: IntegrationProvider;
  name: string;
  description: string;
  authType: "oauth" | "token";
  color: string;
  setupSteps: string[];
  docsUrl: string;
  scopes?: string[];
};

export const INTEGRATIONS: Record<IntegrationProvider, IntegrationDefinition> = {
  google_calendar: {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Consulta agendas, compromissos e eventos do usuário.",
    authType: "oauth",
    color: "#4285F4",
    docsUrl: "https://developers.google.com/identity/protocols/oauth2/web-server",
    setupSteps: ["Crie um cliente OAuth do tipo Aplicação Web no Google Cloud.", "Ative a Google Calendar API.", "Cadastre a URL de callback exibida no painel administrativo."],
    scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.readonly"],
  },
  hubspot: {
    id: "hubspot",
    name: "HubSpot",
    description: "Consulta contatos, empresas e negócios do CRM.",
    authType: "oauth",
    color: "#FF7A59",
    docsUrl: "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/working-with-oauth",
    setupSteps: ["Crie um aplicativo público no HubSpot Developer.", "Habilite os escopos de leitura de contatos, empresas e negócios.", "Cadastre a URL de callback exibida no painel administrativo."],
    scopes: ["oauth", "crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"],
  },
  pipedrive: {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Consulta negócios, pessoas e organizações do CRM.",
    authType: "oauth",
    color: "#017737",
    docsUrl: "https://pipedrive.readme.io/docs/marketplace-oauth-authorization",
    setupSteps: ["Crie um aplicativo OAuth no Developer Hub do Pipedrive.", "Libere leitura de negócios, pessoas e organizações.", "Cadastre a URL de callback exibida no painel administrativo."],
  },
  apify: {
    id: "apify",
    name: "Apify",
    description: "Consulta datasets, execuções e resultados de automações.",
    authType: "token",
    color: "#97D700",
    docsUrl: "https://docs.apify.com/api/v2",
    setupSteps: ["O administrador libera a integração para o usuário.", "Cada usuário copia seu token em Apify Console > Settings > API & Integrations.", "O wizard valida o token antes de armazená-lo."],
  },
  jira: {
    id: "jira",
    name: "Jira",
    description: "Consulta projetos e issues usando JQL.",
    authType: "oauth",
    color: "#1868DB",
    docsUrl: "https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/",
    setupSteps: ["Crie uma integração OAuth 2.0 (3LO) no Atlassian Developer Console.", "Adicione a Jira API e os escopos read:jira-work e read:jira-user.", "Cadastre a URL de callback exibida no painel administrativo."],
    scopes: ["read:jira-work", "read:jira-user", "offline_access"],
  },
};

export function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return typeof value === "string" && INTEGRATION_PROVIDERS.includes(value as IntegrationProvider);
}
