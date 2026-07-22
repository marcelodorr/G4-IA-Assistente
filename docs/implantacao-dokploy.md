# Implantação no Dokploy

Este projeto usa dois recursos no Dokploy:

1. um banco PostgreSQL gerenciado pelo Dokploy, com pgvector;
2. um serviço Docker Compose para a aplicação.

O app acessa o banco pela URL interna do Dokploy. O banco não precisa ter a porta `5432` exposta à internet.

## 1. Prepare o banco

Crie um banco PostgreSQL no mesmo servidor/ambiente do app.

O G4 IA Assistente exige a extensão pgvector. Antes do primeiro deploy do app, abra as configurações avançadas do banco e confirme que ele usa uma imagem pgvector compatível com a versão principal do PostgreSQL, por exemplo:

```text
pgvector/pgvector:pg17
```

Não altere um banco existente entre versões principais do PostgreSQL, como 16 para 17, apenas trocando a imagem. Para um banco já em uso, faça backup e siga um processo de upgrade do PostgreSQL.

Na página do banco, abra **Connection** e copie a **Internal Connection URL**. Ela terá este formato:

```text
postgresql://USUARIO:SENHA@HOST_INTERNO:5432/BANCO
```

Use a URL interna. Não habilite acesso externo ao banco apenas para conectar o app.

## 2. Gere os segredos do app

Rode no seu computador:

```bash
echo "AUTH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Guarde `ENCRYPTION_KEY` em um gerenciador de senhas. Ela protege a chave OpenAI armazenada no banco. Se essa chave for perdida, a configuração criptografada não poderá ser recuperada somente com o backup do banco.

## 3. Crie o serviço Compose

No Dokploy:

1. crie um serviço do tipo **Compose**;
2. escolha **Docker Compose**, e não Docker Stack;
3. conecte o repositório Git;
4. selecione a branch de produção;
5. use `./docker-compose.yml` como **Compose Path**;
6. salve.

O Compose constrói o `Dockerfile` do repositório e conecta o app à rede externa `dokploy-network`, usada para alcançar o banco gerenciado e o proxy do Dokploy.

## 4. Configure as variáveis

Abra a aba **Environment** do serviço Compose e informe:

```dotenv
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_INTERNO:5432/BANCO
AUTH_SECRET=<valor-gerado>
ENCRYPTION_KEY=<64-caracteres-hexadecimais>
```

Use como `DATABASE_URL` a **Internal Connection URL** copiada do banco. Não inclua aspas nem espaços ao redor do `=`.

O arquivo `dokploy.env.example` mostra apenas o formato. Nunca grave a conexão real no repositório.

## 5. Faça o deploy

Clique em **Deploy**.

No início do container, o app:

1. valida as três variáveis obrigatórias;
2. conecta ao PostgreSQL;
3. executa as migrations;
4. cria a extensão `vector`, caso ainda não exista;
5. inicia o servidor Next.js.

Nos logs do serviço `app`, procure por:

```text
[start] aplicando migrations...
[start] migrations ok
```

Se o banco ainda estiver reiniciando, o container do app sairá e será reiniciado automaticamente pela política `restart: unless-stopped`.

## 6. Configure o domínio

Na aba **Domains** do Compose:

1. clique em **Add Domain**;
2. selecione o serviço `app`;
3. use a porta interna `3000`;
4. use `/` como path e internal path;
5. configure domínio e HTTPS;
6. salve e faça um novo deploy.

Não associe um domínio ao banco e não publique a porta `5432`.

O uso do domínio pelo painel é o método recomendado na documentação oficial: [Docker Compose Domains](https://docs.dokploy.com/docs/core/docker-compose/domains).

## 7. Conclua o setup

Acesse:

```text
https://seu-dominio.com/setup
```

Cadastre:

1. administrador inicial;
2. chave da OpenAI;
3. modelo padrão.

Depois, confirme:

- `/api/health` retorna `{"ok":true}`;
- login funciona;
- uma conversa recebe resposta;
- um assistente pode ser criado;
- um PDF pequeno pode ser enviado e processado.

## Dados persistentes e backups

O banco é persistido e copiado pelo recurso de backups do banco no Dokploy. Configure um destino S3 e uma agenda de backup no painel.

O Compose mantém os documentos e anexos no volume nomeado `app_data`. Configure também **Volume Backups** para esse volume.

Guarde fora do servidor:

- backup do banco;
- backup de `app_data`;
- `ENCRYPTION_KEY`;
- versão/tag da aplicação.

Teste uma restauração completa antes de depender dos backups.

## Atualizações

1. faça backup do banco e de `app_data`;
2. revise migrations novas;
3. atualize a branch ou tag no Dokploy;
4. faça o deploy;
5. acompanhe os logs;
6. teste healthcheck, login, chat e upload.

## Erros comuns

### `required variable DATABASE_URL is missing`

A variável não foi cadastrada ou salva na aba Environment do serviço Compose. Cole a Internal Connection URL do banco como `DATABASE_URL` e faça outro deploy.

### `required variable AUTH_SECRET is missing`

Gere e cadastre:

```bash
openssl rand -hex 32
```

### `ENCRYPTION_KEY deve ter exatamente 64 caracteres`

Gere novamente:

```bash
openssl rand -hex 32
```

Não troque a chave de uma instalação já configurada sem planejar a rotação da chave OpenAI.

### `extension "vector" is not available`

O banco está usando uma imagem PostgreSQL sem pgvector. Configure uma imagem `pgvector/pgvector` compatível com a versão principal do banco e reinicie-o. Não faça troca de versão principal sem backup e processo de upgrade.

### `getaddrinfo ENOTFOUND` para o host do banco

O app não está alcançando a rede interna do Dokploy. Confirme:

- o hostname veio da Internal Connection URL;
- app e banco estão no mesmo servidor/ambiente;
- a rede externa `dokploy-network` existe;
- o serviço `app` aparece nessa rede no **Preview Compose**.

### Domínio retorna 502

Confirme:

- serviço do domínio: `app`;
- container port: `3000`;
- app saudável;
- DNS apontando para o servidor;
- Compose redeployado após alterar o domínio.

## Checklist

- [ ] Banco criado no Dokploy.
- [ ] Imagem do banco inclui pgvector.
- [ ] Internal Connection URL copiada.
- [ ] Compose Path é `./docker-compose.yml`.
- [ ] `DATABASE_URL`, `AUTH_SECRET` e `ENCRYPTION_KEY` foram salvas.
- [ ] Nenhum segredo foi enviado ao Git.
- [ ] App está saudável.
- [ ] Domínio aponta para `app:3000`.
- [ ] Porta `5432` não está pública.
- [ ] Setup foi concluído.
- [ ] Backups do banco e de `app_data` estão configurados.
- [ ] Uma restauração foi testada.

Referências oficiais:

- [Conexão com bancos no Dokploy](https://docs.dokploy.com/docs/core/databases/connection)
- [Bancos e backups](https://docs.dokploy.com/docs/core/databases)
- [Docker Compose](https://docs.dokploy.com/docs/core/docker-compose)
- [Domínios em Docker Compose](https://docs.dokploy.com/docs/core/docker-compose/domains)
