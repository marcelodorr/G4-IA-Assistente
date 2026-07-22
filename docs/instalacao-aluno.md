# Guia de instalação — Sequor IA Assistente

Este guia mostra, passo a passo, como colocar o **Sequor IA Assistente** no ar na sua própria conta Railway. Não é necessário saber programar — todo o processo é feito por um assistente de instalação que roda no seu terminal.

Tempo estimado: 10 a 15 minutos.

## O que você vai precisar

1. Um computador (Windows ou Mac) com acesso à internet.
2. Uma conta no [Railway](https://railway.app) — é a plataforma onde o seu Sequor IA Assistente vai ficar hospedado.
3. Uma conta na [OpenAI](https://platform.openai.com) — é ela quem fornece a inteligência artificial usada pelo chat. O uso é cobrado por consumo (veja o aviso sobre custos no passo 5).

## Passo 1 — Criar conta no Railway

1. Acesse [railway.app](https://railway.app) e crie uma conta (pode entrar com o GitHub, Google ou e-mail).
2. Confirme seu e-mail se for solicitado.
3. O Railway pode pedir a confirmação de um cartão de crédito para liberar o uso de serviços fora do período gratuito de teste. O Sequor IA Assistente roda em uma única aplicação + um banco de dados pequeno, então o custo mensal de hospedagem costuma ser baixo — consulte os planos atuais em [railway.app/pricing](https://railway.app/pricing).

## Passo 2 — Instalar o Node.js

O Node.js é o programa que executa o instalador do Sequor IA Assistente no seu computador.

1. Acesse [nodejs.org](https://nodejs.org) e baixe a versão **LTS** (recomendada), que já atende ao requisito mínimo (Node.js 20 ou superior).
   - **Windows**: baixe o instalador `.msi`, execute e siga o assistente (Next, Next, Finish).
   - **Mac**: baixe o instalador `.pkg`, execute e siga o assistente. Se preferir, com o [Homebrew](https://brew.sh) instalado: `brew install node`.
2. Para confirmar que deu certo, abra o terminal (Prompt de Comando/PowerShell no Windows, Terminal no Mac) e rode:
   ```bash
   node -v
   ```
   O comando deve mostrar uma versão `v20` ou superior.

## Passo 3 — Instalar e logar a Railway CLI

A Railway CLI é a ferramenta de linha de comando que o instalador usa para criar seus serviços no Railway.

1. No terminal, instale:
   ```bash
   npm install -g @railway/cli
   ```
   No Mac, também é possível usar `brew install railway`.
2. Faça login (abre uma janela no navegador para você autorizar):
   ```bash
   railway login
   ```

## Passo 4 — Rodar o instalador

Com o Node.js e a Railway CLI prontos, rode no terminal:

```bash
npx g4-ia-assistente
```

O instalador vai perguntar o nome do projeto e, em seguida, fazer tudo sozinho:

1. Baixa o código mais recente do Sequor IA Assistente.
2. Cria um novo projeto na sua conta Railway.
3. Provisiona um banco de dados Postgres com suporte a busca vetorial (necessário para a base de conhecimento) — usa a imagem `pgvector/pgvector`, já que o Postgres padrão do Railway não inclui essa extensão.
4. Anexa um volume de armazenamento persistente ao banco, para os dados não se perderem entre deploys.
5. Cria o serviço da aplicação, já gerando as chaves de segurança necessárias.
6. Anexa um volume persistente à aplicação (para os arquivos enviados na base de conhecimento).
7. Faz o deploy e gera um endereço público (algo como `https://seu-projeto.up.railway.app`).
8. Abre o navegador automaticamente na tela `/setup` para você concluir a configuração.

Esse processo leva alguns minutos — o deploy inicial da aplicação é a etapa mais demorada.

> Se você usa um agente de IA (ex.: Claude Code), peça a ele para rodar `npx g4-ia-assistente --yes --nome <nome>`.

## Passo 5 — Concluir o wizard de configuração

Quando o navegador abrir em `/setup`, você vai preencher 3 passos:

**1. Seus dados de administrador** — nome, e-mail e uma senha (mínimo de 8 caracteres). Essa será a sua conta de login.

**2. Chave da OpenAI**
- Acesse [platform.openai.com/api-keys](https://platform.openai.com/api-keys), faça login (ou crie uma conta) e clique em **Create new secret key**.
- Copie a chave (começa com `sk-`) e cole no wizard. Ela fica salva de forma criptografada no seu banco de dados — nunca em texto puro.
- **Atenção aos custos**: essa chave é cobrada por uso (pay-as-you-go) pela própria OpenAI, conforme a quantidade de mensagens e o modelo escolhido. É comum precisar adicionar um saldo/cartão de crédito na sua conta OpenAI antes da chave funcionar. Acompanhe o consumo em [platform.openai.com/usage](https://platform.openai.com/usage).

**3. Modelo padrão** — escolha o modelo de IA que será usado por padrão (ex: `gpt-5-mini`, uma opção rápida e econômica). Você pode trocar esse modelo depois, a qualquer momento, em **Configurações**, e também pode definir um modelo específico para cada assistente.

Ao concluir, você já entra logado como administrador.

## Passo 6 — Convidar a sua equipe

1. No menu, acesse **Usuários** (`/admin/usuarios`).
2. Clique em **Convidar usuário**, informe o e-mail da pessoa e escolha o papel (**Membro** ou **Administrador**).
3. Clique em **Gerar convite** e copie o link gerado — envie esse link para a pessoa por WhatsApp, e-mail, etc.
4. O link de convite expira em 7 dias e só pode ser usado uma vez.

## Passo 7 — Criar assistentes e alimentar a base de conhecimento

1. No menu, acesse **Assistentes** (`/admin/assistentes`) e clique em **Novo assistente**.
2. Preencha:
   - **Nome** (ex: "Vendas", "Suporte", "RH").
   - **Descrição** (opcional).
   - **System prompt**: as instruções que definem como esse assistente deve se comportar (ex: "Você é um especialista em vendas da Sequor, responda de forma direta e objetiva...").
   - **Modelo**: use o padrão do sistema ou escolha um modelo específico para esse assistente.
3. Clique em **Criar assistente**.
4. Abra o assistente criado e envie os documentos da base de conhecimento (PDF ou Excel — `.pdf`, `.xlsx`, `.xls`). Os arquivos são automaticamente processados e transformados em uma base vetorial pesquisável.
5. Pronto: ao conversar com esse assistente, a IA consulta os documentos enviados sempre que a pergunta puder ser respondida por eles, e cita os trechos usados na resposta.

Você pode criar quantos assistentes fizerem sentido para o seu negócio, cada um com seu próprio prompt e sua própria base de documentos.

## Como atualizar para uma versão mais nova

Sempre que quiser atualizar o Sequor IA Assistente instalado, rode o mesmo comando de novo, no mesmo computador em que fez a instalação original:

```bash
npx g4-ia-assistente
```

O instalador detecta que já existe uma instalação vinculada, pergunta se você quer atualizar e, se confirmado, baixa a versão mais recente do código e refaz o deploy — sem recriar o projeto, o banco de dados ou os serviços já existentes. Seus dados, assistentes e usuários são preservados.

Isso só é seguro quando a instalação anterior terminou com sucesso (você chegou a ver o endereço público e a tela `/setup`). Se a primeira instalação falhou no meio do caminho, veja "A instalação falhou antes de terminar" em Problemas comuns abaixo — rodar o comando de novo nesse caso **não** retoma de onde parou, ele tenta atualizar um projeto incompleto.

## Problemas comuns

- **"Você não está logado na Railway CLI"**: rode `railway login` novamente e execute `npx g4-ia-assistente` de novo.
- **"A Railway CLI não está instalada"**: instale com `npm install -g @railway/cli` (ou `brew install railway` no Mac).
- **O deploy falhou no Railway**: veja os logs do serviço da aplicação para entender o erro:
  ```bash
  railway logs --service app
  ```
  (rode dentro da pasta `~/.g4-ia-assistente/app`, criada pelo instalador, ou de qualquer lugar depois de rodar `railway link` e selecionar o projeto).
- **"Chave OpenAI inválida"** no wizard de configuração: confira se copiou a chave completa (começa com `sk-`) de [platform.openai.com/api-keys](https://platform.openai.com/api-keys) e se a conta OpenAI tem saldo/cartão configurado. Você pode tentar novamente direto na tela de configuração — nada é perdido.
- **A aplicação não abre / fica com erro após o deploy**: o Railway verifica automaticamente a saúde do serviço em `/api/health`; se o deploy não ficar saudável, confira `railway logs --service app` para identificar o erro (é comum ser um problema temporário de conexão com o banco — aguarde alguns instantes e recarregue a página).
- **Esqueci minha senha de administrador**: hoje não existe um fluxo de "esqueci minha senha" no produto; peça a outro administrador para te convidar novamente, ou entre em contato com o suporte da Sequor.
- **A instalação falhou antes de terminar** (nunca chegou a mostrar o endereço público): o instalador não retoma automaticamente de onde parou — como um projeto já foi vinculado no seu computador, rodar `npx g4-ia-assistente` de novo tentaria apenas *atualizar* esse projeto incompleto, o que não corrige as partes que faltaram (banco, volumes, etc.). O caminho seguro é: apague o projeto incompleto no [painel do Railway](https://railway.app/dashboard) e rode `npx g4-ia-assistente` novamente do zero.
- Se nenhuma dessas soluções resolver, entre em contato com o suporte da Sequor.
