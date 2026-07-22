# G4 IA Assistente

**Para quem quer mais.**

O **G4 IA Assistente** é um chat de IA no estilo ChatGPT com a marca do G4, que você hospeda na sua própria conta Railway. Configure assistentes com prompts personalizados, alimente-os com uma base de conhecimento (PDFs e planilhas) e libere o acesso para a sua equipe — em poucos minutos, sem escrever uma linha de código.

## Instalação (alunos)

Pré-requisitos: uma conta no [Railway](https://railway.app) e [Node.js 20 ou superior](https://nodejs.org) instalado.

```bash
npm i -g @railway/cli && railway login
npx g4-ia-assistente
```

O comando cria o projeto, o banco de dados e faz o deploy na sua conta Railway. Ao final, o navegador abre automaticamente para você concluir a configuração inicial (usuário admin, chave da OpenAI e modelo padrão).

Passo a passo completo — com pré-requisitos, o wizard de configuração e solução de problemas comuns: **[docs/instalacao-aluno.md](docs/instalacao-aluno.md)**.

## Para desenvolvedores

Este repositório é um monorepo (npm workspaces) com o app Next.js (`apps/web`) e a CLI de instalação (`packages/cli`). Setup local, testes, migrations do banco e publicação da CLI: **[docs/desenvolvimento.md](docs/desenvolvimento.md)**.

## Deploy no Dokploy

O repositório inclui um `docker-compose.yml` de produção para conectar a aplicação a um PostgreSQL/pgvector gerenciado pelo Dokploy, com healthcheck e volume persistente para arquivos. Veja o passo a passo completo em **[docs/implantacao-dokploy.md](docs/implantacao-dokploy.md)**.

## Licença

MIT.
