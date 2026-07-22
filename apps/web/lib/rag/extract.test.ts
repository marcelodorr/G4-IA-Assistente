import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractTextFromFile } from "./extract";

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

  it("lança para mime desconhecido", async () => {
    await expect(extractTextFromFile(Buffer.from("x"), "application/octet-stream")).rejects.toThrow(/não suportado/i);
  });
});
