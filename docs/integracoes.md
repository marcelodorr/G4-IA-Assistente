# Integrações — guia passo a passo

Esta fase adiciona Google Calendar, Microsoft Teams, HubSpot, Pipedrive, Apify, Jira e GitBook ao Sequor IA Assistente.

## Como funciona

1. O administrador abre **Administração → Integrações**.
2. Para integrações OAuth, informa o Client ID e o Client Secret do aplicativo criado na plataforma externa.
3. Copia a URL de callback exibida pelo Sequor para o cadastro do aplicativo externo.
4. Seleciona os usuários autorizados e ativa a integração.
5. Cada usuário abre **Integrações** no menu lateral e segue o wizard para conectar a própria conta.
6. No chat, o agente chama automaticamente a ferramenta correspondente quando a pergunta depende de dados atuais.

Tokens de acesso, refresh tokens, Client Secrets e o token da Apify são criptografados com `ENCRYPTION_KEY`. As consultas iniciais e as consultas feitas no chat são incorporadas à base corporativa, com origem identificada para gestão exclusiva do administrador.

## Como o usuário chama uma integração no chat

Não existe comando especial, barra (`/`) ou botão dentro da mensagem. Depois que a conta estiver conectada, o usuário escreve o pedido em português normal e, quando os dados atuais forem necessários, o agente chama a ferramenta correta automaticamente.

Exemplos:

- `Quais compromissos tenho hoje no Google Calendar?`
- `Busque no HubSpot o contato maria@empresa.com.`
- `Procure no Pipedrive negócios relacionados à empresa ABC.`
- `Leia os primeiros 20 itens do dataset ABC123 na Apify.`
- `No Jira, liste bugs de alta prioridade do projeto MES.`

Durante a consulta, o chat mostra um aviso como **Consultando Jira...**. Depois, o agente transforma os dados retornados em uma resposta legível. Se uma plataforma não estiver conectada ou liberada, sua ferramenta não fica disponível para aquele usuário.

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

## Microsoft Teams e módulo Reuniões

- Registre uma aplicação Web no Microsoft Entra ID e cadastre a callback exibida no painel.
- Adicione as permissões delegadas `User.Read`, `Calendars.Read` e `OnlineMeetings.Read`, além de `openid`, `profile`, `email` e `offline_access`.
- Se a empresa for single-tenant, defina `MICROSOFT_TENANT_ID`; sem essa variável o OAuth usa o tenant `common`.
- O administrador ativa a integração, escolhe o modo individual e libera os usuários. No painel **Usuários → Acessos e limites**, também deve habilitar o **Módulo Reuniões** para cada pessoa.
- O módulo sincroniza a agenda enquanto está aberto, permite abrir a call no Teams e associa um assistente já existente ao acompanhamento.
- O endpoint `POST /api/meetings/{meetingId}/transcript` recebe trechos com Bearer `TRANSCRIPTION_WEBHOOK_SECRET`. Payload: `{ "speaker": "Cliente", "text": "...", "isFinal": true, "source": "elevenlabs" }`.
- A cada trecho final, o assistente analisa a transcrição recente e a própria base de conhecimento para gerar um insight.

O Teams é opcional no módulo Reuniões. Sem conectar nenhuma agenda, o usuário pode criar uma reunião avulsa e usar a captura universal descrita abaixo.

## Captura universal com ElevenLabs

### Modo recomendado: bot participante

Para funcionar como Read AI em chamadas abertas no Teams Desktop, Zoom ou Google Meet:

1. Crie uma conta Recall.ai e escolha uma região única para todos os recursos.
2. Cadastre a chave ElevenLabs como provedor de transcrição no dashboard da Recall.ai.
3. Gere uma API Key e um Workspace Verification Secret (`whsec_...`) na mesma região.
4. Em **Administração → Configurações → Bot de reuniões**, informe a chave, o segredo, a região e o nome que aparecerá na lista de participantes.
5. No dashboard de webhooks da Recall.ai, cadastre `https://SEU_DOMINIO/api/meetings/recall/webhook` para eventos `bot.*`. O endpoint de transcrição ao vivo é configurado automaticamente em cada bot.
6. O usuário cria ou seleciona a reunião, escolhe o assistente e clica em **Enviar copiloto**. Se houver sala de espera, o organizador precisa admitir o bot.

O backend envia o bot ao link da call e configura `elevenlabs_streaming` com Scribe v2 Realtime. Cada evento `transcript.data` é validado por HMAC antes de ser persistido. O nome do participante fornecido pela plataforma é preservado e o trecho dispara o pipeline de insights.

Para produção, `APP_URL` precisa ser uma URL HTTPS pública e estável. API Key, Workspace Secret e região são específicos da mesma região Recall.ai.

### Alternativa: captura local do navegador

1. Em **Administração → Configurações**, cadastre uma chave ElevenLabs com acesso ao Scribe Realtime. Também é possível usar `ELEVENLABS_API_KEY` no ambiente.
2. O administrador libera o **Módulo Reuniões** para o usuário.
3. Em **Reuniões**, o usuário cria uma reunião pelo botão `+`, escolhe um assistente e clica em **Compartilhar áudio**.
4. No seletor do navegador, escolhe a aba onde a chamada está acontecendo e marca **Compartilhar áudio da aba**.
5. O sistema pede o microfone separadamente. Assim, a fala local é identificada como **Você** e o áudio da aba como **Reunião**.
6. Dois canais PCM mono de 16 kHz são transmitidos ao Scribe v2 Realtime usando tokens temporários de uso único. A chave principal nunca chega ao navegador.
7. Trechos consolidados alimentam o painel e disparam insights do assistente com intervalo mínimo de dez segundos.

A captura funciona sem OAuth da plataforma de reunião. Ela depende de HTTPS e de um navegador que ofereça áudio em `getDisplayMedia`; Chrome e Edge são os alvos principais. Chamadas abertas somente em aplicativos desktop não disponibilizam seu áudio para a aba do navegador.

O endpoint `POST /api/meetings/{meetingId}/transcript` continua disponível para integrações externas e exige sessão autenticada ou Bearer `TRANSCRIPTION_WEBHOOK_SECRET`.

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
| Microsoft Teams | Reuniões online do calendário por período |
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
