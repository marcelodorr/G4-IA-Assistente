# Controle do chat e dos custos de IA

Esta implementação corresponde à Fase 4 do plano de melhorias.

## O que o sistema protege

- O navegador envia somente a conversa e a mensagem nova. O histórico usado pela IA é relido do PostgreSQL.
- Mensagens aceitam até 12.000 caracteres e quatro anexos pertencentes ao usuário.
- O contexto usa no máximo 30 mensagens recentes e aproximadamente 100.000 caracteres.
- Respostas usam por padrão no máximo 2.048 tokens, três consultas RAG e 120 segundos.
- A mensagem do usuário é persistida antes da OpenAI. A resposta é criada como `streaming` e termina como `completed` ou `interrupted`.
- Respostas presas por mais de cinco minutos são recuperadas como interrompidas ao reabrir a conversa.
- Documentos são delimitados como dados não confiáveis e não podem substituir o system prompt.

## Cotas

As cotas globais ficam em **Administração → Configurações**. Os padrões são:

- 200.000 tokens por dia para a instalação;
- 4.000.000 tokens por mês para a instalação;
- 2.048 tokens no máximo por resposta.

Em **Administração → Uso de IA**, o administrador pode definir uma cota diária e mensal específica para cada usuário. Campo vazio significa usar o limite global.

Antes da chamada à OpenAI, o sistema reserva a estimativa de entrada mais o limite máximo da resposta dentro de uma transação protegida por lock do PostgreSQL. Ao terminar, a reserva é substituída pelo consumo real. Excesso retorna HTTP `429`.

Os períodos usam UTC para evitar resultados diferentes entre servidores.

## Painel de uso

O painel mostra no mês atual:

- tokens de entrada e saída;
- chamadas e falhas;
- custo estimado em dólar;
- consumo por usuário;
- conversas com maior consumo.

Também são registrados embeddings de consultas RAG e de ingestão da base de conhecimento. Os custos são estimativas baseadas nos preços públicos cadastrados em `lib/ai/models.ts`; cache, Batch API e futuras alterações de preço podem mudar a cobrança real.

## Modelos

Capacidades, janela de contexto, limite de saída e preço ficam centralizados em `lib/ai/models.ts`. Modelos podem ser desabilitados em **Administração → Configurações**. O modelo padrão não pode ser desabilitado.

Ao atualizar preços ou modelos:

1. confira a documentação oficial da OpenAI;
2. atualize a data e a política centralizada;
3. rode typecheck, lint e testes;
4. faça novo deploy para aplicar a alteração.

## Deploy

O arquivo `drizzle/0001_polite_jackal.sql` cria as tabelas e colunas da Fase 4. O script de inicialização da imagem executa essa migração automaticamente antes de subir a aplicação.
