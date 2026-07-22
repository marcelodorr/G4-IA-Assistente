import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

const EXCEL_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

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
  if (mime.startsWith("text/") || ["application/json", "application/yaml", "application/x-yaml"].includes(mime)) {
    return buf.toString("utf8");
  }
  throw new Error(`Tipo de arquivo não suportado para extração: ${mime}`);
}
