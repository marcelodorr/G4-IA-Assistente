import { describe, it, expect } from "vitest";
import { prepareModelMessages } from "./prepare-messages";

const deps = {
  readFile: async (name: string) => ({
    buf: Buffer.from(name.includes("img") ? "PNGDATA" : "PDFDATA"),
    mime: name.includes("img") ? "image/png" : "application/pdf",
  }),
  extractPdfText: async () => "Texto extraído do PDF",
};

describe("prepareModelMessages", () => {
  it("mensagens de texto passam direto", async () => {
    const out = await prepareModelMessages([
      { id: "1", role: "user", parts: [{ type: "text", text: "Olá" }] },
    ] as any, deps);
    expect(out).toEqual([{ role: "user", content: [{ type: "text", text: "Olá" }] }]);
  });

  it("imagem local vira data URL", async () => {
    const out = await prepareModelMessages([
      { id: "1", role: "user", parts: [
        { type: "text", text: "veja" },
        { type: "file", url: "/api/files/abc__img.png", mediaType: "image/png", filename: "img.png" },
      ]},
    ] as any, deps);
    const filePart = (out[0].content as any[]).find((p) => p.type === "file");
    // AI SDK v7: convertToModelMessages emite `data` como `{ type: "url", url: URL }`
    // (não mais uma string bruta como em v5) — asserção ajustada ao formato real.
    expect(filePart.data.url.toString()).toContain(`data:image/png;base64,${Buffer.from("PNGDATA").toString("base64")}`);
  });

  it("PDF local vira texto no contexto", async () => {
    const out = await prepareModelMessages([
      { id: "1", role: "user", parts: [
        { type: "file", url: "/api/files/abc__doc.pdf", mediaType: "application/pdf", filename: "doc.pdf" },
        { type: "text", text: "resuma" },
      ]},
    ] as any, deps);
    const texts = (out[0].content as any[]).filter((p) => p.type === "text").map((p) => p.text).join("\n");
    expect(texts).toContain("doc.pdf");
    expect(texts).toContain("Texto extraído do PDF");
    expect((out[0].content as any[]).some((p) => p.type === "file")).toBe(false);
  });

  it("descarta file parts com URL externa", async () => {
    const out = await prepareModelMessages([
      { id: "1", role: "user", parts: [
        { type: "file", url: "https://evil.com/x.png", mediaType: "image/png", filename: "x.png" },
        { type: "text", text: "oi" },
      ]},
    ] as any, deps);
    expect((out[0].content as any[]).every((p) => p.type === "text")).toBe(true);
  });
});
