// Mock HTTP mínimo da API da OpenAI, usado pelo teste de integração da rota
// de chat (vitest, sem rede real). Cobre só o necessário para o fluxo:
// - POST /v1/chat/completions (streaming, usado por streamText no chat)
// - POST /v1/chat/completions (não-streaming, usado por generateText no título)
// - POST /v1/embeddings (RAG, não exercitado pelo happy-path do chat mas
//   incluído para deixar o mock reutilizável por outros testes futuros)
// - GET  /v1/models
import { createServer } from "node:http";

export const FIXED_REPLY = "Olá! Como posso ajudar o seu negócio hoje?";

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// vetor determinístico de 1536 dims — não precisa ser semanticamente real,
// só ter o formato (dimensão) que o schema `chunks.embedding` espera.
function fakeEmbedding(seed) {
  const v = new Array(1536).fill(0);
  v[((seed % 1536) + 1536) % 1536] = 1;
  return v;
}

function handleChatCompletions(body, res) {
  const model = body?.model ?? "gpt-4o-mini";
  const now = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-mock-${now}-${Math.random().toString(36).slice(2, 8)}`;

  if (body?.stream) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const contentChunk = {
      id,
      object: "chat.completion.chunk",
      created: now,
      model,
      choices: [
        { index: 0, delta: { role: "assistant", content: FIXED_REPLY }, finish_reason: null },
      ],
    };
    const finalChunk = {
      id,
      object: "chat.completion.chunk",
      created: now,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    };

    res.write(`data: ${JSON.stringify(contentChunk)}\n\n`);
    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  // não-streaming: usado por generateText (ex.: geração do título da conversa)
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      id,
      object: "chat.completion",
      created: now,
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: FIXED_REPLY },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    }),
  );
}

function handleEmbeddings(body, res) {
  const inputs = Array.isArray(body?.input) ? body.input : [body?.input ?? ""];
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      object: "list",
      data: inputs.map((text, i) => ({
        object: "embedding",
        index: i,
        embedding: fakeEmbedding(String(text).length + i),
      })),
      model: body?.model ?? "text-embedding-3-small",
      usage: { prompt_tokens: inputs.length, total_tokens: inputs.length },
    }),
  );
}

function handleModels(res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      object: "list",
      data: [{ id: "gpt-4o-mini", object: "model", created: 0, owned_by: "mock" }],
    }),
  );
}

/**
 * Sobe o mock HTTP da OpenAI numa porta efêmera (ou na porta informada).
 * @param {number} [port]
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function startMockOpenAI(port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");

      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        const body = await readJsonBody(req);
        handleChatCompletions(body, res);
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/embeddings") {
        const body = await readJsonBody(req);
        handleEmbeddings(body, res);
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/models") {
        handleModels(res);
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: `mock: rota não implementada ${req.method} ${url.pathname}` } }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: String(err?.message ?? err) } }));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
