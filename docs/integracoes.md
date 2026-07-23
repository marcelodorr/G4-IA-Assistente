# Integrações — guia passo a passo

Esta fase adiciona Google Calendar, HubSpot, Pipedrive, Apify e Jira ao Sequor IA Assistente.

## Como funciona

1. O administrador abre **Administração → Integrações**.
2. Para integrações OAuth, informa o Client ID e o Client Secret do aplicativo criado na plataforma externa.
3. Copia a URL de callback exibida pelo Sequor para o cadastro do aplicativo externo.
4. Seleciona os usuários autorizados e ativa a integração.
5. Cada usuário abre **Integrações** no menu lateral e segue o wizard para conectar a própria conta.
6. No chat, o agente chama automaticamente a ferramenta correspondente quando a pergunta depende de dados atuais.

Tokens de acesso, refresh tokens, Client Secrets e o token da Apify são criptografados com `ENCRYPTION_KEY`. As consultas iniciais e as consultas feitas no chat são incorporadas à base corporativa, com origem identificada para gestão exclusiva do administrador.

## Variável obrigatória para OAuth

Configure no serviço do Dokploy:

```env
APP_URL=https://sequorai.4growco.com
```

Não coloque barra no final. Depois do deploy, use exatamente as URLs de callback mostradas em **Administração → Integrações**.

## Google Calendar

- Crie um cliente OAuth do tipo **Web application** no Google Cloud.
- Ative a **Google Calendar API**.
- Cadastre a callback mostrada no painel.
- Escopos utilizados: perfil básico e `calendar.readonly`.
- Referência: <https://developers.google.com/identity/protocols/oauth2/web-server>

## HubSpot

- Crie um aplicativo público no HubSpot Developer.
- Configure OAuth e a callback mostrada no painel.
- Habilite os escopos `crm.objects.contacts.read`, `crm.objects.companies.read` e `crm.objects.deals.read`.
- Referência: <https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/working-with-oauth>

## Pipedrive

- Crie um aplicativo OAuth no Developer Hub do Pipedrive.
- Libere leitura de negócios, pessoas e organizações.
- Cadastre a callback mostrada no painel.
- Referência: <https://pipedrive.readme.io/docs/marketplace-oauth-authorization>

## Apify

- Não exige Client ID nem Client Secret no painel administrativo.
- Ative e selecione os usuários autorizados.
- Cada usuário informa o próprio token encontrado em **Apify Console → Settings → API & Integrations**.
- O token é enviado em cabeçalho Bearer, validado em `/v2/users/me` e armazenado criptografado.
- Referência: <https://docs.apify.com/api/v2>

## Jira

- Crie uma integração **OAuth 2.0 (3LO)** no Atlassian Developer Console.
- Adicione a Jira API e configure a callback mostrada no painel.
- Habilite `read:jira-work`, `read:jira-user` e `offline_access`.
- A aplicação identifica o `cloudId` autorizado e renova refresh tokens rotativos.
- Referência: <https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/>

## Operações disponíveis no chat

| Integração | Consultas iniciais |
|---|---|
| Google Calendar | Eventos por período e termo |
| HubSpot | Contatos, empresas e negócios |
| Pipedrive | Negócios, pessoas e organizações |
| Apify | Datasets, Actors, execuções e itens de dataset |
| Jira | Projetos e issues por JQL |

A fase inicial é somente leitura. O agente não cria eventos, não altera negócios, não executa Actors e não modifica issues.

## Deploy

A migration `0006_dusty_lady_bullseye.sql` é aplicada automaticamente quando o container inicia. Depois do deploy:

1. Confirme `APP_URL` no Dokploy.
2. Abra o painel de integrações.
3. Configure os aplicativos OAuth.
4. Libere primeiro um usuário de teste.
5. Conecte cada plataforma e faça uma consulta no chat.
