import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const EXCEL_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1), entity[1]?.toLowerCase() === "x" ? 16 : 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

export function extractTextFromMarkup(markup: string) {
  return decodeEntities(markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, (svg) => svg.includes("<text") || svg.includes("<title") || svg.includes("<desc") ? svg : " ")
    .replace(/<\/(p|div|section|article|header|footer|li|h[1-6]|tr|a:p|w:p)>/gi, "\n")
    .replace(/<\/(td|th|w:tc)>/gi, "\t")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractOfficeXml(buf: Buffer, type: "docx" | "pptx") {
  const zip = await JSZip.loadAsync(buf);
  const pattern = type === "docx" ? /^word\/(document|header\d+|footer\d+)\.xml$/ : /^ppt\/slides\/slide\d+\.xml$/;
  const entries = Object.values(zip.files).filter((entry) => pattern.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const texts = await Promise.all(entries.map(async (entry, index) => {
    const text = extractTextFromMarkup(await entry.async("string"));
    return type === "pptx" ? `### Slide ${index + 1}\n${text}` : text;
  }));
  return texts.filter(Boolean).join("\n\n");
}

export async function extractTextFromFile(buf: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  if (EXCEL_MIMES.includes(mime)) {
    const wb = XLSX.read(buf, { type: "buffer" });
    return wb.SheetNames.map((name) =>
      `### Aba: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`
    ).join("\n\n");
  }
  if (mime === DOCX_MIME) return extractOfficeXml(buf, "docx");
  if (mime === PPTX_MIME) return extractOfficeXml(buf, "pptx");
  if (["text/html", "application/xhtml+xml", "image/svg+xml"].includes(mime)) {
    return extractTextFromMarkup(buf.toString("utf8"));
  }
  if (mime.startsWith("text/") || ["application/json", "application/yaml", "application/x-yaml"].includes(mime)) {
    return buf.toString("utf8");
  }
  throw new Error(`Tipo de arquivo não suportado para extração: ${mime}`);
}
