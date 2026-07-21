# g4-ia-assistente (CLI)

Instala o **G4 IA Assistente** na sua própria conta Railway com um único comando.

## Pré-requisitos

- **Node.js 20+**
- **Railway CLI** instalada e logada:
  ```bash
  npm install -g @railway/cli   # ou: brew install railway (mac)
  railway login
  ```

## Uso

```bash
npx g4-ia-assistente
```

Siga as instruções interativas. Ao final, o navegador abre automaticamente na tela de configuração inicial (`/setup`) do seu assistente.

## O que a CLI faz

1. Verifica se a Railway CLI está instalada e logada.
2. Baixa o código-fonte mais recente do G4 IA Assistente (tarball do GitHub).
3. Cria um novo projeto na sua conta Railway (`railway init`).
4. Provisiona um banco Postgres com a extensão `pgvector` (imagem `pgvector/pgvector:pg17`, já que o template padrão de Postgres do Railway não inclui a extensão).
5. Anexa um volume persistente ao serviço do banco (`/var/lib/postgresql/data`).
6. Cria o serviço da aplicação, gerando automaticamente as chaves de segurança (`AUTH_SECRET`, `ENCRYPTION_KEY`) e configurando a `DATABASE_URL` via rede privada do Railway.
7. Anexa um volume persistente ao serviço da aplicação (`/data`).
8. Faz o deploy, gera o domínio público e abre o navegador em `/setup` para você concluir a configuração (chave da OpenAI, usuário admin, etc.).

## Uso por agentes de IA / não-interativo

Se este comando for executado por um agente de IA (ex.: Claude Code) ou em qualquer terminal sem TTY, o wizard interativo não funciona — nesse caso a CLI imprime uma orientação em vez de travar esperando input. O caminho recomendado para agentes é rodar direto no modo não-interativo:

```bash
npx g4-ia-assistente --yes --nome <nome-do-projeto>
```

- `--nome <nome>`: nome do projeto no Railway (letras minúsculas, números e hífens, 3-40 caracteres).
- `--yes` / `-y`: pula todas as perguntas. Sem `--nome`, usa `g4-ia-assistente` como padrão.
- Passar apenas `--nome` (sem `--yes`) também ativa o modo não-interativo — a intenção já fica clara.
- `--help` / `-h`: mostra a ajuda.

Nesse modo a CLI não abre o navegador ao final (não faz sentido em um agente ou servidor); em vez disso, imprime a URL do assistente e a instrução `Acesse <url>/setup para concluir a configuração.`. Se já existir uma instalação vinculada, o mesmo comando atualiza e refaz o deploy automaticamente, sem perguntar.

## Atualizando uma instalação existente

Rode o mesmo comando novamente:

```bash
npx g4-ia-assistente
```

A CLI detecta a instalação existente, pergunta se você quer atualizar e, se confirmado, baixa a versão mais recente do código e refaz o deploy (`railway up`) — sem recriar o projeto, o banco ou os serviços.

Isso só é seguro quando a instalação anterior terminou com sucesso. Se a primeira instalação falhou no meio do caminho (nunca chegou a imprimir o endereço público), a re-execução **não** retoma o provisionamento de onde parou — como um projeto já ficou vinculado localmente, a CLI tentaria apenas atualizar esse projeto incompleto. Nesse caso, apague o projeto incompleto no [painel do Railway](https://railway.app/dashboard) e rode `npx g4-ia-assistente` de novo do zero.

## Solução de problemas

- **"Você não está logado na Railway CLI"**: rode `railway login` e execute o comando novamente.
- **"A Railway CLI não está instalada"**: instale com `npm install -g @railway/cli` (ou `brew install railway` no mac).
- **Build ou deploy falhou no Railway**: veja os logs do serviço com `railway logs` (dentro da pasta `~/.g4-ia-assistente/app`, ou com `railway logs --service app` de qualquer lugar depois de linkar o projeto).
- **Erro ao baixar o código**: verifique sua conexão com a internet e tente novamente.
- **A instalação falhou antes de terminar**: apague o projeto incompleto no [painel do Railway](https://railway.app/dashboard) e rode `npx g4-ia-assistente` de novo — não tente apenas rodar o comando de novo por cima, veja o aviso acima.
- Se o problema persistir, entre em contato com o suporte do G4.
