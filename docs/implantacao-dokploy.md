# Implantação no Dokploy

Este guia coloca o G4 IA Assistente e seu banco PostgreSQL com pgvector no mesmo serviço Docker Compose do Dokploy.

O resultado terá:

- aplicação Next.js;
- PostgreSQL 17 com pgvector;
- migrations executadas automaticamente antes do app iniciar;
- volume persistente para o banco;
- volume persistente para PDFs, planilhas e anexos;
- banco acessível somente pela rede interna do Compose;
- acesso de saída do app à API da OpenAI;
- healthchecks para o banco e para a aplicação.

## Antes de começar

Você precisa de:

1. um servidor com Dokploy funcionando;
2. este repositório disponível no GitHub ou em outro provedor Git;
3. um domínio apontando para o IP do servidor, se quiser HTTPS com domínio próprio;
4. acesso ao terminal local para gerar três segredos.

O arquivo usado pelo deploy é `docker-compose.yml`, na raiz do repositório.

## 1. Gere os segredos

Rode os comandos abaixo no seu computador:

```bash
openssl rand -hex 24
openssl rand -base64 32
openssl rand -hex 32
```

Use as três saídas, na mesma ordem, como:

1. `POSTGRES_PASSWORD`;
2. `AUTH_SECRET`;
3. `ENCRYPTION_KEY`.

Não reutilize os exemplos do repositório.

> Guarde `ENCRYPTION_KEY` em um gerenciador de senhas. Ela protege a chave OpenAI armazenada no banco. Se for perdida, restaurar apenas o banco não será suficiente para recuperar essa configuração.

## 2. Crie o serviço Compose

No Dokploy:

1. crie ou abra um projeto;
2. crie um serviço do tipo **Compose**;
3. escolha **Docker Compose**, e não Docker Stack;
4. conecte o provedor Git e selecione este repositório;
5. selecione a branch que será usada em produção;
6. informe `./docker-compose.yml` como **Compose Path**;
7. salve a configuração;
8. se a opção estiver disponível, habilite **Isolated Deployments**.

Docker Stack não deve ser usado neste projeto porque o Compose faz o build da imagem diretamente pelo `Dockerfile` do repositório.

## 3. Configure as variáveis

Abra a aba **Environment** do serviço Compose e adicione:

```dotenv
POSTGRES_PASSWORD=<resultado-do-primeiro-comando>
POSTGRES_USER=postgres
POSTGRES_DB=g4_assistente
AUTH_SECRET=<resultado-do-segundo-comando>
ENCRYPTION_KEY=<resultado-do-terceiro-comando>
```

O arquivo `dokploy.env.example` contém o mesmo modelo.

Não é necessário configurar `DATABASE_URL`: o Compose a monta usando o endereço interno do serviço `database`.

O Dokploy salva as variáveis da aba Environment em um arquivo `.env` ao lado do Compose. O `docker-compose.yml` referencia explicitamente cada variável necessária, portanto elas serão interpoladas no deploy.

### Regras importantes para os valores

- `ENCRYPTION_KEY` deve ter exatamente 64 caracteres hexadecimais.
- Use uma senha hexadecimal em `POSTGRES_PASSWORD` para evitar caracteres reservados em URLs.
- Nunca envie esses valores para o Git.
- Não altere `ENCRYPTION_KEY` depois do primeiro setup sem antes planejar a rotação da chave OpenAI criptografada.

## 4. Faça o primeiro deploy

Clique em **Deploy**.

A ordem esperada é:

1. o Dokploy constrói a imagem do app;
2. o PostgreSQL inicia e passa no `pg_isready`;
3. o app inicia;
4. `apps/web/scripts/start.mjs` aplica as migrations;
5. o servidor Next.js começa a responder;
6. `/api/health` consulta o banco e marca o container como saudável.

Nos logs do serviço `app`, procure por:

```text
[start] aplicando migrations...
[start] migrations ok
```

No primeiro deploy, o app ainda não terá uma chave OpenAI. Ela será cadastrada pelo wizard depois que o domínio estiver funcionando.

## 5. Configure o domínio

Use o gerenciamento nativo de domínios do Dokploy:

1. abra a aba **Domains** do serviço Compose;
2. clique em **Add Domain**;
3. selecione o serviço `app`;
4. informe a porta interna `3000`;
5. use `/` como path e internal path;
6. configure seu domínio e HTTPS;
7. salve e faça um novo deploy do Compose.

Não associe um domínio ao serviço `database` e não publique a porta `5432`.

O Compose usa `expose: 3000`, não `ports`. Assim, a aplicação é alcançada pelo proxy reverso do Dokploy sem abrir uma porta pública adicional no servidor.

As instruções seguem o método recomendado na documentação oficial: [Docker Compose Domains](https://docs.dokploy.com/docs/core/docker-compose/domains).

## 6. Conclua o setup

Acesse:

```text
https://seu-dominio.com/setup
```

Preencha:

1. nome, e-mail e senha do administrador;
2. chave da OpenAI;
3. modelo padrão.

Depois do setup, confirme:

- login funcionando;
- criação de conversa;
- resposta da OpenAI;
- criação de assistente;
- upload e processamento de um PDF pequeno;
- acesso a `https://seu-dominio.com/api/health`, que deve retornar `{"ok":true}`.

## Persistência dos dados

O Compose cria dois volumes nomeados:

| Volume | Conteúdo | Consequência se for perdido |
|---|---|---|
| `postgres_data` | usuários, conversas, configurações, assistentes, chunks e embeddings | perda dos dados do sistema |
| `app_data` | PDFs, planilhas e anexos enviados | documentos deixam de estar disponíveis |

Um redeploy normal preserva esses volumes. Remover o Compose junto com seus volumes apaga os dados.

### Backups

Configure backups periódicos no Dokploy para os dois volumes. Para o banco, também é recomendado gerar dumps lógicos com `pg_dump`, pois eles são mais adequados para restauração e migração entre versões do PostgreSQL.

Guarde fora do servidor:

- backup do PostgreSQL;
- backup do volume `app_data`;
- cópia segura de `ENCRYPTION_KEY`;
- versão/tag da aplicação usada pelo backup.

Faça pelo menos um teste real de restauração antes de depender desses backups.

## Atualizações

Para atualizar:

1. faça backup do banco e dos arquivos;
2. revise novas migrations;
3. atualize a branch ou tag configurada no Dokploy;
4. faça o deploy;
5. acompanhe os logs de migration;
6. teste `/api/health`, login, chat e upload.

As migrations são aplicadas automaticamente. Não execute duas versões incompatíveis do app contra o mesmo banco durante uma atualização.

## Deploy local para conferência

O mesmo Compose pode ser testado em uma máquina com Docker:

```bash
cp dokploy.env.example .env
```

Edite `.env` com valores válidos e rode:

```bash
docker compose config
docker compose up --build
```

Acesse `http://localhost:3000` somente se adicionar temporariamente uma publicação local de porta, por exemplo com um arquivo `docker-compose.override.yml` não versionado:

```yaml
services:
  app:
    ports:
      - "3000:3000"
```

Não adicione essa publicação de porta ao Compose de produção.

## Solução de problemas

### `ENCRYPTION_KEY deve ter 64 caracteres`

Gere novamente com:

```bash
openssl rand -hex 32
```

Atualize a variável antes do primeiro setup. Se o sistema já estiver configurado, restaurar ou trocar a chave exige recadastrar a chave OpenAI.

### O banco não fica saudável

Confira os logs de `database`. Verifique:

- `POSTGRES_PASSWORD` definida;
- espaço livre no servidor;
- permissões e estado do volume;
- se o volume veio de uma versão incompatível do PostgreSQL.

### O app mostra erro de pgvector

Confirme que o serviço usa exatamente a imagem `pgvector/pgvector:pg17`. A migration inicial executa `CREATE EXTENSION IF NOT EXISTS vector`.

### O app não encontra o banco

Confirme que os serviços `app` e `database` continuam ligados à rede interna `backend`, que o app continua ligado à rede `frontend` e que o Dokploy adicionou sua rede de proxy ao serviço `app`. Use **Preview Compose** no Dokploy para conferir a configuração final.

### O domínio retorna 502

Confirme na aba Domains:

- serviço: `app`;
- container port: `3000`;
- container do app saudável;
- DNS apontando para o servidor;
- Compose redeployado depois de alterar o domínio.

### O deploy fica preso na migration

Veja os logs dos dois serviços. O app só começa a servir depois que o banco fica saudável e todas as migrations terminam. Não interrompa uma migration sem antes verificar o estado do banco.

## Checklist final

- [ ] Serviço criado como Docker Compose.
- [ ] Compose Path definido como `./docker-compose.yml`.
- [ ] Segredos gerados e salvos fora do Git.
- [ ] `ENCRYPTION_KEY` possui 64 caracteres hexadecimais.
- [ ] Banco e app estão saudáveis.
- [ ] Domínio aponta para o serviço `app` na porta `3000`.
- [ ] Porta `5432` não está publicada.
- [ ] HTTPS está ativo.
- [ ] Setup inicial foi concluído.
- [ ] Chat e upload foram testados.
- [ ] Backups dos dois volumes estão configurados.
- [ ] Uma restauração de backup foi testada.

Referências oficiais do Dokploy:

- [Docker Compose](https://docs.dokploy.com/docs/core/docker-compose)
- [Domínios em Docker Compose](https://docs.dokploy.com/docs/core/docker-compose/domains)
- [Variáveis de ambiente](https://docs.dokploy.com/docs/core/variables)
- [Provedores Git](https://docs.dokploy.com/docs/core/providers)
