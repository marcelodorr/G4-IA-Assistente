import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { saveUpload, readUpload, CHAT_MIMES, KB_MIMES, MAX_UPLOAD_BYTES, assertUploadSize } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "g4-test-"));
  });

  it("salva e lê arquivo com nome sanitizado", async () => {
    const { storedName } = await saveUpload(Buffer.from("dados"), "Relatório Final.pdf", "application/pdf", CHAT_MIMES);
    expect(storedName).toMatch(/^[0-9a-f-]{36}__relatorio-final\.pdf$/);
    const { buf, mime } = await readUpload(storedName);
    expect(buf.toString()).toBe("dados");
    expect(mime).toBe("application/pdf");
  });

  it("rejeita mime não permitido", async () => {
    await expect(saveUpload(Buffer.from("x"), "a.exe", "application/x-msdownload", CHAT_MIMES))
      .rejects.toThrow(/não permitido/i);
  });

  it("reconhece Markdown pela extensão quando o navegador omite o MIME", async () => {
    const saved = await saveUpload(Buffer.from("# Skill"), "SKILL.md", "", KB_MIMES);
    expect(saved.mime).toBe("text/markdown");
  });

  it.each([
    ["imagem.jpeg", "image/jpeg"],
    ["vetor.svg", "image/svg+xml"],
    ["manual.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["pagina.html", "text/html"],
  ])("reconhece %s pela extensão", async (filename, mime) => {
    await expect(saveUpload(Buffer.from("conteúdo"), filename, "", KB_MIMES)).resolves.toMatchObject({ mime });
  });

  it("rejeita arquivo acima do limite de 200 MB sem alocar o arquivo em memória", () => {
    expect(() => assertUploadSize(MAX_UPLOAD_BYTES + 1)).toThrow(/200 ?MB/i);
  });

  it("rejeita path traversal na leitura", async () => {
    await expect(readUpload("../../etc/passwd")).rejects.toThrow(/inválido/i);
  });
});
