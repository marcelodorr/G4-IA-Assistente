export const INTEGRATION_PROVIDERS = ["google_calendar", "hubspot", "pipedrive", "apify", "jira"] as const;
export type IntegrationProvider = typeof INTEGRATION_PROVIDERS[number];

export type IntegrationDefinition = {
  id: IntegrationProvider;
  name: string;
  description: string;
  authType: "oauth" | "token";
  color: string;
  setupSteps: string[];
  userSteps: string[];
  capabilities: string[];
  examplePrompts: string[];
  limitations: string[];
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
    userSteps: ["Clique em Conectar e entre na sua conta Google.", "Autorize a leitura da sua agenda.", "Volte ao Sequor e faça uma pergunta normal no chat."],
    capabilities: ["Listar eventos em um período", "Pesquisar eventos por palavra-chave", "Mostrar horários, participantes, local e descrição", "Resumir sua agenda e identificar possíveis sobreposições"],
    examplePrompts: ["Quais compromissos tenho hoje no Google Calendar?", "Resuma minha agenda da próxima semana e destaque reuniões com clientes.", "Procure no meu calendário eventos sobre o projeto MES nos próximos 30 dias."],
    limitations: ["Somente leitura: não cria, edita ou cancela eventos", "Consulta o calendário principal", "Retorna no máximo 50 eventos por chamada"],
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
    userSteps: ["Clique em Conectar e entre no HubSpot.", "Escolha a conta/portal autorizado.", "Autorize a leitura e volte ao Sequor."],
    capabilities: ["Consultar contatos", "Consultar empresas", "Consultar negócios e seus estágios", "Pesquisar por nome, empresa, e-mail ou termo"],
    examplePrompts: ["Busque no HubSpot o contato maria@empresa.com.", "Liste os negócios recentes do HubSpot e mostre valor e estágio.", "Encontre empresas no HubSpot relacionadas à indústria automotiva."],
    limitations: ["Somente leitura: não cria nem altera registros", "Campos disponíveis dependem das permissões do portal", "Retorna no máximo 50 registros por chamada"],
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
    userSteps: ["Clique em Conectar e entre no Pipedrive.", "Escolha a empresa que deseja autorizar.", "Autorize o aplicativo e volte ao Sequor."],
    capabilities: ["Consultar negócios", "Consultar pessoas", "Consultar organizações", "Pesquisar registros por nome ou termo"],
    examplePrompts: ["Quais negócios aparecem no meu Pipedrive?", "Procure no Pipedrive a pessoa Marcelo.", "Busque organizações com Sequor no nome e resuma os resultados."],
    limitations: ["Somente leitura: não move negócios nem altera cadastros", "A busca respeita os acessos da conta conectada", "Retorna no máximo 50 registros por chamada"],
  },
  apify: {
    id: "apify",
    name: "Apify",
    description: "Consulta datasets, execuções e resultados de automações.",
    authType: "token",
    color: "#97D700",
    docsUrl: "https://docs.apify.com/api/v2",
    setupSteps: ["O administrador libera a integração para o usuário.", "Cada usuário copia seu token em Apify Console > Settings > API & Integrations.", "O wizard valida o token antes de armazená-lo."],
    userSteps: ["Abra Apify Console → Settings → API & Integrations.", "Copie seu API token e cole no wizard.", "Depois, peça no chat para consultar datasets, Actors ou execuções."],
    capabilities: ["Listar datasets", "Ler itens de um dataset pelo ID", "Listar Actors disponíveis", "Consultar execuções recentes"],
    examplePrompts: ["Liste meus datasets mais recentes da Apify.", "Leia os primeiros 20 itens do dataset ABC123.", "Mostre as execuções recentes dos meus Actors na Apify."],
    limitations: ["Somente leitura: não inicia nem interrompe Actors", "Para ler itens, informe o ID do dataset", "Retorna no máximo 50 itens por chamada"],
  },
  jira: {
    id: "jira",
    name: "Jira",
    description: "Consulta projetos e issues usando JQL.",
    authType: "oauth",
    color: "#1868DB",
    docsUrl: "https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/",
    setupSteps: ["Crie uma integração OAuth 2.0 (3LO) no Atlassian Developer Console.", "Adicione a Jira API e os escopos read:jira-work e read:jira-user.", "Cadastre a URL de callback exibida no painel administrativo."],
    userSteps: ["Clique em Conectar e entre na sua conta Atlassian.", "Escolha o site Jira que deseja autorizar.", "Autorize a leitura e volte ao Sequor."],
    capabilities: ["Listar projetos", "Pesquisar issues usando linguagem natural", "Executar consultas JQL de leitura", "Mostrar resumo, status, responsável, prioridade e atualização"],
    examplePrompts: ["Liste os projetos que posso acessar no Jira.", "Mostre minhas issues abertas atualizadas nos últimos 7 dias.", "No Jira, liste bugs de alta prioridade do projeto MES.", "Execute a JQL: project = MES AND status != Done ORDER BY priority DESC."],
    limitations: ["Somente leitura: não cria, comenta ou muda issues", "Resultados respeitam as permissões do Jira", "Retorna no máximo 50 issues por chamada"],
    scopes: ["read:jira-work", "read:jira-user", "offline_access"],
  },
};

export function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return typeof value === "string" && INTEGRATION_PROVIDERS.includes(value as IntegrationProvider);
}
