# Plano de melhorias do Sequor IA Assistente — guia “for dummies”

Este documento transforma a análise técnica do projeto em um plano de trabalho simples, dividido em fases.

Ele foi escrito para que uma pessoa não especialista consiga entender:

- qual é o problema;
- por que ele importa;
- o que precisa ser alterado;
- como saber se o trabalho terminou corretamente.

> Este é um roteiro de melhorias, não uma lista de erros críticos já explorados. O sistema tem uma base boa, mas precisa destas proteções para operar com mais usuários, arquivos e consumo real da OpenAI.

## Como usar este documento

Execute as fases na ordem apresentada. Dentro de cada fase, conclua primeiro os itens marcados como **Prioridade alta**.

Para cada tarefa:

1. Crie uma branch específica.
2. Faça a alteração.
3. Adicione ou atualize testes.
4. Rode lint, testes e build.
5. Marque o item como concluído somente depois de atender ao “Pronto quando”.

Comandos básicos de verificação:

```bash
npm install
npm run lint -w apps/web
npm test -w apps/web
npm test -w packages/cli
npm run build -w apps/web
```

Os testes que usam Postgres e pgvector também precisam de `TEST_DATABASE_URL`, conforme explicado em `docs/desenvolvimento.md`.

---

## Fase 0 — Criar uma rede de segurança

**Objetivo:** impedir que novas alterações quebrem silenciosamente o projeto.

### 0.1 Fazer o comando de teste da raiz testar tudo

**Prioridade:** alta

**Problema:** atualmente, `npm test` na raiz executa somente os testes do app web. Os testes da CLI podem quebrar sem que esse comando perceba.

**O que fazer:**

- alterar o `package.json` da raiz para testar web e CLI;
- adicionar scripts separados para `lint`, `typecheck` e, se desejado, `test:integration`;
- manter comandos simples para uso local e na CI.

Exemplo de resultado esperado:

```json
{
  "scripts": {
    "build": "npm run build -w apps/web && npm run build -w packages/cli",
    "lint": "npm run lint -w apps/web",
    "test": "npm test -w apps/web && npm test -w packages/cli"
  }
}
```

**Pronto quando:** `npm test` falha se qualquer teste da web ou da CLI falhar.

### 0.2 Criar integração contínua no GitHub Actions

**Prioridade:** alta

**Problema:** não existe uma verificação automática a cada push ou pull request.

**O que fazer:** criar um workflow em `.github/workflows/ci.yml` que:

1. use Node.js 22;
2. rode `npm ci`;
3. rode lint;
4. rode testes da web e da CLI;
5. rode o build de produção;
6. suba Postgres com pgvector para os testes de integração.

**Pronto quando:** um pull request não pode ser aprovado com lint, testes ou build quebrados.

### 0.3 Medir cobertura de testes

**Prioridade:** média

**Problema:** há bons testes, mas não existe uma medida objetiva das áreas que continuam sem cobertura.

**O que fazer:**

- criar um script `test:coverage`;
- começar com uma meta realista, por exemplo 70% para serviços e bibliotecas;
- não perseguir 100% apenas para melhorar o número;
- priorizar rotas, permissões, concorrência, uploads e cobrança da OpenAI.

**Pronto quando:** a CI publica ou exibe um relatório de cobertura e impede quedas relevantes.

### 0.4 Adicionar testes de ponta a ponta

**Prioridade:** média

**O que testar:**

- primeiro setup;
- login correto e incorreto;
- convite e criação de usuário;
- criação de assistente;
- upload de documento;
- criação de conversa;
- envio e persistência de mensagem;
- bloqueio de páginas administrativas para membros.

**Pronto quando:** os principais fluxos de usuário podem ser verificados automaticamente em um navegador.

---

## Fase 1 — Validar tudo que entra pela API

**Objetivo:** nunca confiar diretamente nos dados enviados pelo navegador.

### Explicação simples

TypeScript ajuda o programador enquanto ele escreve o código, mas não impede alguém de enviar manualmente um JSON inválido para a API. Por isso, cada rota precisa validar os dados durante a execução.

O projeto já possui Zod. Ele pode ser usado para criar schemas compartilhados.

### 1.1 Criar schemas Zod para todas as rotas

**Prioridade:** alta

**Rotas que precisam de validação:**

- setup;
- login, quando aplicável;
- criação e edição de assistentes;
- criação de conversas;
- chat;
- configurações;
- convites;
- aceite de convite;
- ativação e desativação de usuário;
- parâmetros `id`, `fileId` e `name` das URLs.

**Regras mínimas:**

- IDs devem ser UUIDs válidos;
- e-mail deve passar por validação de e-mail;
- `role` deve aceitar apenas `admin` ou `member`;
- `active` deve ser booleano real, sem conversão com `Boolean(...)`;
- nomes e prompts devem ter tamanho mínimo e máximo;
- modelos devem estar na lista permitida;
- propriedades desconhecidas devem ser rejeitadas ou removidas;
- mensagens devem ter quantidade e tamanho máximos.

**Pronto quando:** JSON inválido sempre recebe resposta `400` previsível e nunca chega ao banco ou à OpenAI.

### 1.2 Validar assistentes na criação de conversas

**Prioridade:** alta

**Problema:** uma conversa pode receber um `assistantId` sem verificar previamente se o assistente existe e está ativo.

**O que fazer:**

- buscar o assistente antes de criar a conversa;
- retornar `404` se ele não existir;
- impedir membros de iniciar novas conversas com assistentes inativos;
- decidir se administradores podem usar assistentes inativos para teste.

**Pronto quando:** nenhuma conversa nova referencia um assistente inválido ou indisponível.

### 1.3 Padronizar os erros da API

**Prioridade:** média

**O que fazer:** definir um formato comum, por exemplo:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Dados inválidos",
    "fields": {
      "email": "E-mail inválido"
    }
  }
}
```

Não devolver detalhes internos do Postgres, caminhos de arquivos, stack traces ou respostas completas da OpenAI.

**Pronto quando:** frontend e testes tratam erros pelo mesmo formato em todas as rotas.

---

## Fase 2 — Proteger login, setup e administração

**Objetivo:** reduzir risco de invasão, abuso e condições de corrida.

### 2.1 Adicionar rate limiting

**Prioridade:** alta

**Explicação simples:** rate limiting limita quantas tentativas alguém pode fazer em um período.

**Aplicar pelo menos em:**

- login: por IP e e-mail;
- setup: por IP;
- convite: por administrador;
- aceite de convite: por IP e token;
- chat: por usuário;
- uploads: por usuário;
- busca RAG e geração de embeddings.

Use um armazenamento compartilhado, como Postgres ou Redis. Um contador somente na memória não funciona bem após reinícios ou com mais de uma instância.

**Pronto quando:** excesso de requisições retorna `429 Too Many Requests`, com testes automatizados.

### 2.2 Tornar o setup inicial atômico

**Prioridade:** alta

**Problema:** duas requisições simultâneas podem verificar que o sistema ainda não foi configurado e tentar criar administradores ao mesmo tempo.

**O que fazer:**

- executar verificação e gravação dentro de uma proteção transacional;
- usar um advisory lock do Postgres ou outra trava equivalente;
- garantir no banco que somente uma inicialização vence;
- retornar `409` para as demais tentativas.

**Pronto quando:** um teste concorrente envia dois setups ao mesmo tempo e somente um cria o primeiro admin.

### 2.3 Garantir que sempre exista um administrador ativo

**Prioridade:** alta

**Problema:** dois administradores podem tentar desativar um ao outro ao mesmo tempo. Cada operação enxerga o outro ativo e as duas podem ser aceitas.

**O que fazer:** proteger a consulta e a atualização com transação e lock, ou modelar a regra de forma que o banco a garanta.

**Pronto quando:** mesmo com requisições concorrentes, o banco nunca termina sem um administrador ativo.

### 2.4 Melhorar segurança de autenticação

**Prioridade:** média

**O que fazer:**

- registrar tentativas de login sem registrar senhas;
- atrasar ou bloquear tentativas repetidas;
- considerar autenticação em dois fatores para administradores;
- implementar recuperação segura de senha;
- permitir encerramento de sessões existentes;
- definir política de expiração de sessão;
- avaliar aumento gradual do custo do hash de senha conforme a infraestrutura permitir.

**Pronto quando:** existe um processo documentado para senha esquecida e comprometimento de conta.

### 2.5 Criar trilha de auditoria administrativa

**Prioridade:** média

Registrar ações como:

- convite criado;
- usuário ativado ou desativado;
- chave OpenAI substituída, sem registrar a chave;
- modelo padrão alterado;
- assistente criado, editado ou removido;
- documento enviado ou apagado.

Cada evento deve guardar ator, ação, alvo e data.

**Pronto quando:** um administrador consegue descobrir quem fez uma alteração importante e quando.

---

## Fase 3 — Controlar arquivos e armazenamento

**Objetivo:** impedir vazamento, esgotamento de disco e processamento perigoso.

### 3.1 Rejeitar uploads grandes antes de carregá-los na memória

**Prioridade:** alta

**Problema:** o código atual transforma o arquivo inteiro em `Buffer` antes de aplicar o limite de 20 MB.

**O que fazer:**

- verificar `Content-Length` antes de ler o corpo, quando disponível;
- configurar limite de corpo no servidor/proxy;
- preferir streaming para arquivos maiores;
- interromper a leitura assim que ultrapassar o limite;
- limitar uploads simultâneos por usuário.

**Pronto quando:** um upload acima do limite é interrompido sem reservar memória proporcional ao arquivo inteiro.

### 3.2 Validar o conteúdo real do arquivo

**Prioridade:** alta

**Problema:** o MIME informado pelo navegador pode ser falso. A extensão também não prova o tipo do conteúdo.

**O que fazer:**

- conferir assinatura/magic bytes;
- exigir coerência entre extensão, MIME e conteúdo;
- rejeitar arquivos corrompidos;
- impor limites de páginas, planilhas, linhas e células;
- limitar o tamanho descompactado de XLSX para evitar “zip bombs”.

**Pronto quando:** renomear um arquivo malicioso para `.pdf` ou `.xlsx` não faz o sistema processá-lo.

### 3.3 Registrar propriedade dos arquivos de chat

**Prioridade:** alta

**Problema:** uploads de chat existem apenas no disco. Não há registro ligando o arquivo ao usuário ou à conversa.

**O que fazer:** criar uma tabela de uploads com:

- ID;
- nome armazenado;
- nome original;
- MIME real;
- tamanho;
- usuário proprietário;
- conversa, quando houver;
- data de criação;
- data de expiração;
- status de verificação.

A rota de download deve conferir a propriedade antes de entregar o arquivo.

**Pronto quando:** um usuário não consegue baixar um arquivo pertencente a outro usuário, mesmo sabendo o identificador.

### 3.4 Criar política de retenção e limpeza

**Prioridade:** alta

Definir respostas para estas perguntas:

- por quanto tempo anexos de chat ficam armazenados?
- apagar uma conversa também apaga seus arquivos?
- apagar um documento remove arquivo e chunks?
- como remover arquivos órfãos?
- existe limite total por usuário e por instalação?

Criar uma tarefa periódica para remover arquivos expirados e órfãos.

**Pronto quando:** o volume não cresce indefinidamente e a política está documentada para os usuários.

### 3.5 Evitar arquivos órfãos em falhas

**Prioridade:** média

**Problema:** se o arquivo for salvo no disco e a gravação no banco falhar, ele permanece sem referência.

**O que fazer:** apagar o arquivo em um bloco de compensação quando a operação seguinte falhar. Também criar uma varredura periódica de consistência.

**Pronto quando:** testes de falha simulada confirmam que banco e armazenamento continuam sincronizados.

### 3.6 Avaliar armazenamento de objetos

**Prioridade:** futura

Para uma instalação pequena, o volume Railway é suficiente. Para múltiplas instâncias, alta disponibilidade ou muitos arquivos, avaliar S3/R2/MinIO com URLs assinadas.

**Pronto quando:** a estratégia escolhida suporta backup, restauração e crescimento esperado.

---

## Fase 4 — Controlar o chat e os custos da IA

**Objetivo:** tornar mensagens confiáveis, previsíveis e financeiramente controladas.

### 4.1 Não confiar no histórico enviado pelo navegador

**Prioridade:** alta

**Problema:** a rota atual recebe o histórico completo do cliente e o envia ao modelo.

**O que fazer:**

1. receber somente a conversa e a nova mensagem do usuário;
2. buscar o histórico verdadeiro no banco;
3. confirmar que a conversa pertence ao usuário;
4. validar anexos e propriedade;
5. montar as mensagens no servidor;
6. persistir a nova mensagem antes ou de forma resiliente ao streaming;
7. persistir a resposta ao terminar.

**Pronto quando:** editar manualmente o JSON no navegador não permite forjar o histórico, papéis ou anexos.

### 4.2 Limitar contexto e tamanho de mensagens

**Prioridade:** alta

Definir limites para:

- caracteres por mensagem;
- quantidade de mensagens por requisição;
- quantidade de anexos;
- tokens enviados ao modelo;
- tokens máximos da resposta;
- número de chamadas de ferramenta;
- tempo total da operação.

Quando o histórico crescer, usar uma janela das mensagens recentes e, se necessário, um resumo das antigas.

**Pronto quando:** conversas longas continuam funcionando sem ultrapassar contexto ou gerar custos inesperados.

### 4.3 Criar cotas e painel de uso

**Prioridade:** alta

Registrar por usuário e conversa:

- modelo utilizado;
- tokens de entrada e saída;
- chamadas de embeddings;
- estimativa de custo;
- duração;
- sucesso ou falha.

Permitir limites diários ou mensais por usuário e por instalação.

**Pronto quando:** o administrador consegue identificar consumo e bloquear abuso antes de receber uma cobrança inesperada.

### 4.4 Melhorar persistência durante streaming

**Prioridade:** média

**Problema:** a conversa é substituída ao final do streaming. Se o processo cair ou o navegador desconectar, mensagens podem não ser persistidas corretamente.

**O que fazer:**

- persistir a mensagem do usuário antes de chamar a OpenAI;
- criar um registro de resposta com status `streaming`;
- atualizar ou finalizar a resposta ao concluir;
- marcar como interrompida em caso de falha;
- evitar substituir todo o histórico em cada resposta.

**Pronto quando:** uma interrupção deixa um estado recuperável, sem apagar mensagens anteriores.

### 4.5 Tratar prompt injection na base de conhecimento

**Prioridade:** média

Documentos podem conter frases como “ignore as instruções anteriores”. O modelo deve tratar documentos como dados, não como ordens.

**O que fazer:**

- reforçar essa regra no system prompt;
- delimitar claramente trechos recuperados;
- nunca colocar segredos nas mensagens enviadas ao modelo;
- exibir citações que permitam ao usuário conferir a fonte;
- testar documentos com instruções maliciosas.

**Pronto quando:** testes mostram que instruções dentro de documentos não substituem as regras do assistente.

### 4.6 Revisar política de modelos

**Prioridade:** média

**O que fazer:**

- centralizar modelos, capacidades e limites;
- distinguir modelos que aceitam imagens;
- verificar disponibilidade do modelo antes de salvar a configuração;
- prever descontinuação ou troca de nome de modelos;
- permitir desabilitar modelos caros.

**Pronto quando:** escolher um modelo incompatível gera uma mensagem clara antes da primeira conversa.

---

## Fase 5 — Tornar o RAG confiável

**Objetivo:** garantir que documentos sejam processados por completo e possam ser recuperados após falhas.

### 5.1 Trocar o processamento “solto” por uma fila persistente

**Prioridade:** alta

**Problema:** a ingestão é iniciada em segundo plano dentro do processo web. Um restart pode deixá-la presa em `processing`.

**O que fazer:**

- criar uma tabela de jobs ou usar uma fila externa;
- armazenar status, número de tentativas e próxima tentativa;
- executar o processamento em worker;
- recuperar jobs abandonados;
- usar retry com espera crescente;
- definir um limite de tentativas e estado final de erro.

**Pronto quando:** reiniciar a aplicação durante uma ingestão não exige intervenção manual.

### 5.2 Tornar a criação de chunks atômica

**Prioridade:** alta

**Problema:** uma falha depois de alguns lotes pode deixar chunks parciais no banco.

**O que fazer:**

- gerar chunks em staging ou dentro de estratégia transacional adequada;
- só trocar o documento para `ready` após todos os lotes existirem;
- remover dados parciais antes de retry;
- validar que cada texto recebeu um embedding com 1.536 dimensões.

**Pronto quando:** um documento aparece como `ready` somente se todos os chunks estiverem disponíveis.

### 5.3 Permitir reprocessamento manual

**Prioridade:** média

Adicionar no painel administrativo:

- botão “Tentar novamente”;
- mensagem de erro amigável;
- data da última tentativa;
- progresso aproximado;
- opção de cancelar.

**Pronto quando:** um administrador recupera um documento com erro sem reenviar o arquivo.

### 5.4 Melhorar qualidade da recuperação

**Prioridade:** média

Avaliar com um conjunto real de perguntas e respostas:

- tamanho e sobreposição dos chunks;
- quantidade `k` de resultados;
- similaridade mínima;
- inclusão de nome de aba e página;
- busca híbrida por vetor e palavras-chave;
- reranking;
- remoção de trechos duplicados.

Não alterar esses números apenas por intuição. Criar um pequeno conjunto de avaliação com respostas esperadas.

**Pronto quando:** existe uma medição repetível de qualidade do RAG.

### 5.5 Melhorar citações

**Prioridade:** média

Salvar metadados como página, aba, intervalo de linhas e título do documento. Retornar esses dados para o modelo e para a interface.

**Pronto quando:** o usuário consegue localizar rapidamente no documento original a informação citada.

---

## Fase 6 — Fortalecer instalação e atualização pela CLI

**Objetivo:** evitar instalações incompletas e atualizações imprevisíveis.

### 6.1 Baixar versões imutáveis

**Prioridade:** alta

**Problema:** a CLI sempre baixa a branch `main`. Duas instalações da mesma versão da CLI podem receber códigos diferentes.

**O que fazer:**

- publicar releases ou tags do app;
- relacionar cada versão da CLI a uma versão do app;
- validar checksum do arquivo baixado;
- permitir um canal explícito de preview, se necessário.

**Pronto quando:** reinstalar uma versão específica produz exatamente o mesmo código.

### 6.2 Atualizar o diretório de forma atômica

**Prioridade:** alta

**Problema:** o tarball é extraído sobre o diretório existente. Arquivos removidos da versão nova podem continuar presentes.

**O que fazer:**

1. baixar para diretório temporário;
2. validar conteúdo e checksum;
3. preservar somente metadados locais realmente necessários;
4. trocar diretórios de forma atômica;
5. manter uma cópia anterior para rollback;
6. sempre remover temporários em `finally`.

**Pronto quando:** atualizar remove arquivos antigos e uma falha de download não destrói a instalação funcional.

### 6.3 Esperar o deploy ficar saudável

**Prioridade:** alta

**Problema:** `railway up --detach` confirma apenas que o deploy foi enviado, não que a aplicação iniciou corretamente.

**O que fazer:**

- consultar o status do deploy;
- aguardar `/api/health` responder com sucesso;
- aplicar timeout claro;
- mostrar logs relevantes em caso de falha;
- abrir `/setup` somente após a aplicação estar saudável.

**Pronto quando:** a CLI só exibe “instalação concluída” depois de verificar app e banco.

### 6.4 Implementar retomada e rollback

**Prioridade:** média

Registrar localmente as etapas concluídas:

- projeto criado;
- banco criado;
- volumes anexados;
- app criado;
- deploy iniciado;
- domínio criado.

Ao rodar novamente, a CLI deve continuar com segurança ou explicar exatamente o que precisa ser removido. Em atualização, deve ser possível voltar à versão anterior.

**Pronto quando:** uma falha no meio da instalação não obriga o aluno a descobrir manualmente o estado do Railway.

### 6.5 Suportar múltiplas instalações

**Prioridade:** futura

O diretório local atual representa apenas um projeto. Criar uma estrutura por instalação, por exemplo:

```text
~/.g4-ia-assistente/projetos/<project-id>/
```

Adicionar comandos como `list`, `update`, `status` e `remove`.

**Pronto quando:** uma pessoa consegue administrar dois projetos sem sobrescrever o vínculo local.

### 6.6 Testar compatibilidade com versões da Railway CLI

**Prioridade:** média

**O que fazer:**

- verificar uma faixa suportada da Railway CLI;
- falhar cedo em versões incompatíveis;
- criar testes para mudanças no formato de saída;
- evitar depender apenas de regex em texto humano quando houver saída JSON.

**Pronto quando:** uma mudança conhecida da Railway CLI gera orientação clara em vez de falha genérica.

---

## Fase 7 — Operação, observabilidade e recuperação

**Objetivo:** conseguir perceber, investigar e recuperar falhas em produção.

### 7.1 Criar logs estruturados

**Prioridade:** alta

Cada log deve poder incluir:

- nível (`info`, `warn`, `error`);
- request ID;
- usuário, quando seguro;
- rota ou operação;
- duração;
- código de erro;
- conversa, assistente, arquivo ou job relacionado.

Nunca registrar senhas, tokens de convite, chave OpenAI, conteúdo privado completo ou headers de autorização.

**Pronto quando:** é possível acompanhar uma requisição do início ao fim usando um request ID.

### 7.2 Adicionar monitoramento e alertas

**Prioridade:** alta

Monitorar pelo menos:

- disponibilidade do app;
- conexão com banco;
- erros 5xx;
- latência do chat;
- falhas da OpenAI;
- jobs RAG parados;
- espaço em disco;
- uso e custo de tokens;
- falhas de migration.

**Pronto quando:** uma falha importante gera alerta antes de depender da reclamação de um usuário.

### 7.3 Definir backups e testar restauração

**Prioridade:** alta

Fazer backup de:

- Postgres;
- arquivos do volume;
- configuração necessária para descriptografar dados.

A `ENCRYPTION_KEY` precisa ser protegida e recuperável. Perder essa chave torna a chave OpenAI armazenada inutilizável.

Definir RPO e RTO:

- **RPO:** quanto dado pode ser perdido;
- **RTO:** quanto tempo a recuperação pode levar.

**Pronto quando:** uma restauração completa já foi ensaiada e documentada.

### 7.4 Criar processo seguro de migrations

**Prioridade:** média

**O que fazer:**

- testar migrations em cópia do banco;
- evitar mudanças destrutivas em uma única etapa;
- documentar rollback ou roll-forward;
- impedir duas instâncias de executar a mesma migration simultaneamente;
- validar espaço e tempo antes de migrations grandes.

**Pronto quando:** cada release informa como o banco será alterado e recuperado em caso de falha.

### 7.5 Definir política de privacidade e exclusão

**Prioridade:** alta antes de uso amplo

Documentar:

- quais dados são armazenados;
- quais dados são enviados à OpenAI;
- por quanto tempo conversas e arquivos são mantidos;
- como exportar ou apagar dados;
- quem pode acessar documentos;
- responsabilidades do administrador da instalação;
- tratamento de dados pessoais conforme a LGPD.

**Pronto quando:** a implementação e a documentação permitem atender pedidos de acesso e exclusão.

### 7.6 Manter dependências atualizadas com segurança

**Prioridade:** média

**O que fazer:**

- habilitar Dependabot ou Renovate;
- revisar alertas de vulnerabilidade;
- testar atualizações automaticamente;
- ter cuidado especial com Auth.js beta, parser de PDF, SheetJS e pacotes de IA;
- evitar atualização automática sem testes de dependências críticas.

**Pronto quando:** existe uma rotina periódica de atualização e resposta a vulnerabilidades.

---

## Fase 8 — Melhorias de produto e experiência

**Objetivo:** deixar o sistema mais fácil de operar por pessoas não técnicas.

### 8.1 Melhorar estados e mensagens da interface

Exibir estados claros para:

- documento aguardando processamento;
- processamento em andamento;
- erro com opção de tentar novamente;
- resposta interrompida;
- limite de uso atingido;
- OpenAI indisponível;
- modelo sem acesso;
- volume cheio.

**Pronto quando:** nenhuma falha comum deixa apenas um spinner infinito ou uma mensagem genérica.

### 8.2 Criar painel de saúde para administradores

Mostrar:

- estado do banco;
- configuração da OpenAI;
- jobs pendentes e com erro;
- uso recente;
- espaço de armazenamento;
- versão instalada;
- disponibilidade de atualização.

Não mostrar segredos.

**Pronto quando:** o administrador identifica os problemas mais comuns sem abrir o terminal do Railway.

### 8.3 Melhorar gestão de usuários

Considerar:

- revogar convites;
- reenviar ou copiar convite;
- filtrar convites expirados;
- alterar papel de usuário com proteção do último admin;
- encerrar sessões;
- exibir último acesso;
- exportar usuários.

**Pronto quando:** o ciclo de vida completo de uma conta pode ser administrado pela interface.

### 8.4 Melhorar acessibilidade e responsividade

Verificar:

- navegação por teclado;
- foco visível;
- labels e descrições de campos;
- contraste;
- leitores de tela;
- mensagens de erro associadas aos campos;
- uso em celular;
- redução de movimento.

**Pronto quando:** uma auditoria automatizada e testes manuais básicos não encontram bloqueios graves.

---

## Checklist resumido para lançamento

Antes de considerar a versão pronta para uso amplo, confirme:

- [ ] CI executa lint, testes web, testes CLI e build.
- [ ] Testes de integração rodam com Postgres e pgvector.
- [ ] Todas as entradas HTTP são validadas em runtime.
- [ ] Login, chat e upload possuem rate limiting.
- [ ] O servidor monta o histórico do chat usando o banco.
- [ ] Existem cotas e métricas de consumo da OpenAI.
- [ ] Arquivos possuem proprietário, autorização e expiração.
- [ ] Uploads são limitados antes de serem carregados na memória.
- [ ] O conteúdo real de PDF e Excel é validado.
- [ ] A ingestão RAG sobrevive a reinícios.
- [ ] Setup e regra do último admin estão protegidos contra concorrência.
- [ ] A CLI usa uma versão imutável e espera o healthcheck.
- [ ] Logs não expõem segredos.
- [ ] Monitoramento e alertas estão ativos.
- [ ] Backups de banco e arquivos são feitos e restaurados em teste.
- [ ] Existe política de privacidade, retenção e exclusão de dados.
- [ ] Existe procedimento de recuperação de senha.
- [ ] Dependências recebem atualizações e correções de segurança.

## Ordem prática sugerida

Se a equipe for pequena, esta é a sequência de melhor retorno por esforço:

1. CI e comando de testes completo.
2. Zod em todas as rotas.
3. Histórico do chat reconstruído pelo servidor.
4. Rate limiting e cotas de IA.
5. Propriedade, limite e limpeza de arquivos.
6. Locks no setup e na regra do último admin.
7. Fila persistente para RAG.
8. CLI versionada com healthcheck.
9. Logs, monitoramento e alertas.
10. Backups e teste de restauração.
11. Privacidade, retenção e auditoria.
12. Melhorias de UX, acessibilidade e administração.

Seguindo essa ordem, o projeto evolui primeiro nas áreas que reduzem risco de invasão, perda de dados e custos inesperados; depois ganha resiliência e refinamento de produto.
