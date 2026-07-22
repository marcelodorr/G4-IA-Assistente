import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { Db } from "@/lib/db";
import { generateDocument, generatePresentation, generateSpreadsheet } from "./artifacts";

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
});
