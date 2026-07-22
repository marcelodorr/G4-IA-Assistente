import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractTextFromFile } from "./extract";
import JSZip from "jszip";

const fixture = (n: string) => readFileSync(path.join(__dirname, "../../test/fixtures", n));

describe("extractTextFromFile", () => {
  it("extrai texto de PDF", async () => {
    const text = await extractTextFromFile(fixture("exemplo.pdf"), "application/pdf");
    expect(text).toContain("faturamento da Sequor");
  });

  it("extrai todas as abas de Excel como CSV", async () => {
    const text = await extractTextFromFile(
      fixture("exemplo.xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(text).toContain("### Aba: Vendas");
    expect(text).toContain("Produto,Receita");
    expect(text).toContain("Imersao,5000000");
  });

  it("extrai arquivos de texto usados por documentos e skills", async () => {
    await expect(extractTextFromFile(Buffer.from("regra corporativa"), "text/markdown")).resolves.toBe("regra corporativa");
  });

  it("extrai HTML e SVG sem scripts nem tags", async () => {
    await expect(extractTextFromFile(Buffer.from("<h1>Sequor &amp; MES</h1><script>segredo()</script>"), "text/html")).resolves.toBe("Sequor & MES");
    await expect(extractTextFromFile(Buffer.from("<svg><title>Diagrama</title><text>Produção</text></svg>"), "image/svg+xml")).resolves.toContain("Produção");
  });

  it("extrai texto de Word e PowerPoint modernos", async () => {
    const docx = new JSZip();
    docx.file("word/document.xml", "<w:document><w:p><w:r><w:t>Política Sequor</w:t></w:r></w:p></w:document>");
    await expect(extractTextFromFile(await docx.generateAsync({ type: "nodebuffer" }), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).resolves.toContain("Política Sequor");

    const pptx = new JSZip();
    pptx.file("ppt/slides/slide1.xml", "<p:sld><a:p><a:r><a:t>Resultado MES</a:t></a:r></a:p></p:sld>");
    const slides = await extractTextFromFile(await pptx.generateAsync({ type: "nodebuffer" }), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(slides).toContain("### Slide 1");
    expect(slides).toContain("Resultado MES");
  });

  it("lança para mime desconhecido", async () => {
    await expect(extractTextFromFile(Buffer.from("x"), "application/octet-stream")).rejects.toThrow(/não suportado/i);
  });
});
