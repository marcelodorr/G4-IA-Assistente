import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { Db } from "@/lib/db";
import { generateDocument, generatePresentation, generateSpreadsheet, getOpenAIImageEndpoint, readImageApiResponse } from "./artifacts";

function fakeDb() {
  return {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => [{ id: "00000000-0000-0000-0000-000000000001", ...values }],
      }),
    }),
  } as unknown as Db;
}

describe("artifact generators", () => {
  let dataDir: string;
  const owner = { userId: "00000000-0000-0000-0000-000000000001", conversationId: "00000000-0000-0000-0000-000000000002" };

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "sequor-artifacts-"));
    process.env.DATA_DIR = dataDir;
  });

  it("gera Excel, Word, PDF e PowerPoint reais", async () => {
    const db = fakeDb();
    await generateSpreadsheet(db, owner, { title: "Orçamento Teste", headers: ["Item", "Valor"], rows: [["Serviço", 1000]] });
    await generateDocument(db, owner, { title: "Documento Teste", sections: [{ heading: "Resumo", content: "Conteúdo corporativo" }], format: "docx" });
    await generateDocument(db, owner, { title: "Documento Teste", sections: [{ heading: "Resumo", content: "Conteúdo corporativo" }], format: "pdf" });
    await generatePresentation(db, owner, { title: "Apresentação Teste", slides: [{ title: "Resultado", bullets: ["Meta atingida"] }], format: "pptx" });

    const names = await readdir(path.join(dataDir, "artifacts"));
    expect(names.some((name) => name.endsWith(".xlsx"))).toBe(true);
    expect(names.some((name) => name.endsWith(".docx"))).toBe(true);
    expect(names.some((name) => name.endsWith(".pdf"))).toBe(true);
    expect(names.some((name) => name.endsWith(".pptx"))).toBe(true);
    const pdfName = names.find((name) => name.endsWith(".pdf"))!;
    expect((await readFile(path.join(dataDir, "artifacts", pdfName))).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("normaliza a URL da API de imagens mesmo com /v1/ no final", () => {
    expect(getOpenAIImageEndpoint("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1/images/generations");
    expect(getOpenAIImageEndpoint("https://proxy.exemplo.com/")).toBe("https://proxy.exemplo.com/v1/images/generations");
  });

  it("transforma páginas HTML do provedor em erro compreensível", async () => {
    const response = new Response("<!DOCTYPE html><html><body>Bad gateway</body></html>", { status: 502, headers: { "Content-Type": "text/html" } });
    await expect(readImageApiResponse(response)).rejects.toThrow(/página web \(HTTP 502\).*OPENAI_BASE_URL/i);
  });

  it("aceita a resposta JSON válida da API de imagens", async () => {
    const response = new Response(JSON.stringify({ data: [{ b64_json: "aW1hZ2Vt" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    await expect(readImageApiResponse(response)).resolves.toEqual({ data: [{ b64_json: "aW1hZ2Vt" }] });
  });
});
