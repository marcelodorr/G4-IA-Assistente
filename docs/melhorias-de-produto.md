# Melhorias de produto e experiência

Esta implementação corresponde à Fase 8 do plano de melhorias.

## Estados e mensagens

O sistema diferencia:

- documento aguardando, processando, pronto, com erro ou travado;
- resposta de chat interrompida;
- cota de uso atingida;
- chave OpenAI inválida ou sem créditos;
- limite temporário e indisponibilidade da OpenAI;
- modelo sem acesso;
- timeout de serviço;
- armazenamento cheio.

Documentos com erro ou sem progresso há mais de dez minutos exibem **Tentar novamente**. O polling é interrompido para documentos travados, evitando spinner infinito.

## Painel de saúde

Administradores acessam **Administração → Saúde** para consultar:

- conexão e latência do PostgreSQL;
- configuração e disponibilidade da OpenAI;
- documentos pendentes, processando ou com erro;
- uso de IA das últimas 24 horas;
- espaço total, livre e percentual utilizado no volume;
- versão instalada e release mais recente disponível.

O painel nunca devolve chave OpenAI, conexão do banco ou outros segredos. A consulta externa possui timeout de cinco segundos.

`APP_VERSION` é opcional no Dokploy e assume `0.1.0`. Atualize a variável quando publicar uma nova versão. A disponibilidade de atualização depende de uma release publicada no GitHub.

## Gestão de contas

Na página de usuários, o administrador pode:

- criar, copiar, revogar e renovar convites;
- filtrar convites pendentes, expirados, utilizados e revogados;
- promover membros e rebaixar administradores;
- ativar e desativar contas;
- encerrar todas as sessões de uma conta;
- consultar o último login;
- exportar usuários em CSV.

Alterar papel, desativar uma conta ou encerrar sessões incrementa a versão de sessão do usuário. Tokens JWT anteriores deixam de funcionar na próxima requisição. Um lock no PostgreSQL impede que ações concorrentes removam o último administrador ativo.

## Acessibilidade e celular

- menu lateral adaptado para celular, com abertura por botão, fechamento por Escape e rótulos ARIA;
- navegação administrativa com rolagem horizontal em telas pequenas;
- foco visível global;
- mensagens de erro anunciadas com `role="alert"`;
- chat marcado com `aria-live` e estado de carregamento;
- ações que apareciam apenas no hover também aparecem ao receber foco;
- redução de animações respeitando `prefers-reduced-motion`;
- tabelas administrativas com rolagem horizontal.

O lint `core-web-vitals` funciona como verificação automatizada básica. Antes de cada lançamento, valide manualmente teclado, leitor de tela e larguras de 320, 768 e 1280 pixels.

## Deploy

A migration `0002_clever_emma_frost.sql` adiciona revogação de convites, criador do convite, último login e versão de sessão. Ela é aplicada automaticamente pelo script de inicialização.
