import { mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as tar from "tar";

// O nome do repositório permanece legado por compatibilidade; a marca exibida pelo produto é Sequor.
const TARBALL_URL = "https://codeload.github.com/marcelodorr/G4-IA-Assistente/tar.gz/refs/heads/main";

export async function downloadCode(destDir: string, opts: { tarballUrl?: string; fetchImpl?: typeof fetch } = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = opts.tarballUrl ?? TARBALL_URL;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Falha ao baixar o código (${res.status}). Verifique sua conexão.`);
  const tmp = path.join(tmpdir(), `g4-ia-${Date.now()}.tgz`);
  await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  await mkdir(destDir, { recursive: true });
  await tar.x({ file: tmp, cwd: destDir, strip: 1 });
  await rm(tmp, { force: true });
}
