import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_SITE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 4;

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19));
  }
  return normalized === "::" || normalized === "::1"
    || normalized.startsWith("fc") || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized);
}

async function validateUrl(value: string) {
  if (value.length > 2_048) throw new Error("URL muito longa");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Informe uma URL válida, incluindo https://"); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Somente links HTTP ou HTTPS são permitidos");
  if (url.username || url.password) throw new Error("Links com usuário ou senha não são permitidos");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("A porta informada não é permitida");
  if (url.hostname === "localhost" || !url.hostname.includes(".")) throw new Error("Endereço interno não é permitido");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) throw new Error("Endereço interno não é permitido");
  return url;
}

async function readLimited(response: Response) {
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_SITE_BYTES) throw new Error("O site excede o limite de 5 MB");
  if (!response.body) throw new Error("O site não retornou conteúdo");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SITE_BYTES) { await reader.cancel(); throw new Error("O site excede o limite de 5 MB"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function fetchExternalSite(value: string) {
  let url = await validateUrl(value.trim());
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "SequorKnowledgeBot/1.0", Accept: "text/html,application/xhtml+xml;q=0.9" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("O site excedeu o limite de redirecionamentos");
      url = await validateUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`O site respondeu com HTTP ${response.status}`);
    const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!mime || !["text/html", "application/xhtml+xml"].includes(mime)) throw new Error("O link não aponta para uma página HTML");
    const content = await readLimited(response);
    const sourceHeader = Buffer.from(`<p>Fonte externa: <a href="${url.toString().replace(/"/g, "&quot;")}">${url.toString()}</a></p>\n`, "utf8");
    return { url: url.toString(), buffer: Buffer.concat([sourceHeader, content]), mime: "text/html" as const };
  }
  throw new Error("Não foi possível carregar o site");
}
