import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const CHAT_MIMES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export const KB_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/yaml",
  "text/yaml",
  "application/x-yaml",
];

const EXT_MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv",
  ".json": "application/json", ".yaml": "application/yaml", ".yml": "application/yaml",
};

export function uploadsDir() {
  return path.join(process.env.DATA_DIR ?? "/data", "uploads");
}

function sanitize(name: string) {
  return name.normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function saveUpload(buf: Buffer, originalName: string, mime: string, allowed: string[]) {
  const extensionMime = EXT_MIME[path.extname(originalName).toLowerCase()];
  const resolvedMime = allowed.includes(mime) ? mime : extensionMime ?? (mime || "application/octet-stream");
  if (!allowed.includes(resolvedMime)) throw new Error(`Tipo de arquivo não permitido: ${resolvedMime}`);
  if (buf.byteLength > MAX_UPLOAD_BYTES) throw new Error("Arquivo excede o limite de 20 MB");
  const storedName = `${randomUUID()}__${sanitize(originalName)}`;
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(path.join(uploadsDir(), storedName), buf);
  return { storedName, mime: resolvedMime };
}

export async function readUpload(storedName: string) {
  if (storedName.includes("/") || storedName.includes("\\") || storedName.includes("..")) {
    throw new Error("Nome de arquivo inválido");
  }
  const mime = EXT_MIME[path.extname(storedName)] ?? "application/octet-stream";
  const buf = await readFile(path.join(uploadsDir(), storedName));
  return { buf, mime };
}
