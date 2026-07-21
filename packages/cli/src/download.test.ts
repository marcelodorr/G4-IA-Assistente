import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import * as tar from "tar";
import { downloadCode } from "./download";

describe("downloadCode", () => {
  it("baixa e extrai o tarball removendo a pasta raiz", async () => {
    // monta um tarball fixture: raiz/README.md
    const src = mkdtempSync(path.join(tmpdir(), "g4-src-"));
    mkdirSync(path.join(src, "G4-IA-Assistente-main"));
    writeFileSync(path.join(src, "G4-IA-Assistente-main", "README.md"), "# app");
    const tarball = path.join(src, "repo.tgz");
    await tar.c({ gzip: true, file: tarball, cwd: src }, ["G4-IA-Assistente-main"]);

    const dest = mkdtempSync(path.join(tmpdir(), "g4-dest-"));
    const fakeFetch = (async () => new Response(readFileSync(tarball))) as typeof fetch;
    await downloadCode(dest, { fetchImpl: fakeFetch });

    expect(existsSync(path.join(dest, "README.md"))).toBe(true);
  });

  it("lança em resposta HTTP de erro", async () => {
    const dest = mkdtempSync(path.join(tmpdir(), "g4-dest2-"));
    const fakeFetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    await expect(downloadCode(dest, { fetchImpl: fakeFetch })).rejects.toThrow(/baixar/i);
  });
});
