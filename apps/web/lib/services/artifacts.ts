import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { artifacts } from "@/lib/db/schema";
import { getOpenAIKey } from "@/lib/services/settings";
import { saveArtifact } from "@/lib/files/storage";
import type { Db } from "@/lib/db";
import { recordGenerationUsage } from "@/lib/services/usage";

type ArtifactOwner = { userId: string; conversationId: string; assistantId?: string | null };
type Section = { heading: string; content: string };
type Slide = { title: string; bullets: string[] };

function safeBaseName(value: string, fallback: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;
}

async function persistArtifact(db: Db, owner: ArtifactOwner, input: {
  buffer: Buffer;
  filename: string;
  mime: string;
  kind: "image" | "spreadsheet" | "document" | "presentation" | "pdf";
}) {
  const { storedName } = await saveArtifact(input.buffer, input.filename);
  const [row] = await db.insert(artifacts).values({
    ...owner,
    kind: input.kind,
    filename: input.filename,
    mime: input.mime,
    size: input.buffer.byteLength,
    storagePath: storedName,
  }).returning();
  return { id: row.id, filename: row.filename, url: `/api/artifacts/${row.id}` };
}

function wrap(text: string, max = 92) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) { lines.push(line); line = word; }
    else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

async function makePdf(title: string, sections: Section[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const addLine = (text: string, size: number, isBold = false) => {
    if (y < 55) { page = pdf.addPage([595, 842]); y = 790; }
    page.drawText(text.replace(/[^\x20-\xFF]/g, "-"), { x: 48, y, size, font: isBold ? bold : font, color: rgb(0.08, 0.12, 0.16) });
    y -= size + 6;
  };
  addLine(title, 20, true);
  y -= 10;
  for (const section of sections) {
    addLine(section.heading, 13, true);
    for (const paragraph of section.content.split("\n").filter(Boolean)) {
      for (const line of wrap(paragraph)) addLine(line, 10);
      y -= 4;
    }
    y -= 8;
  }
  return Buffer.from(await pdf.save());
}

async function makePresentationPdf(title: string, slides: Slide[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const allSlides = [{ title, bullets: [] as string[] }, ...slides];
  for (const item of allSlides) {
    const page = pdf.addPage([842, 595]);
    page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(0.97, 0.98, 0.99) });
    page.drawText(item.title.replace(/[^\x20-\xFF]/g, "-"), { x: 55, y: 500, size: 26, font: bold, color: rgb(0.03, 0.1, 0.18), maxWidth: 730 });
    let y = 430;
    for (const bullet of item.bullets) {
      for (const [index, line] of wrap(bullet, 82).entries()) {
        page.drawText(`${index === 0 ? "- " : "  "}${line}`.replace(/[^\x20-\xFF]/g, "-"), { x: 75, y, size: 17, font, color: rgb(0.14, 0.22, 0.3), maxWidth: 700 });
        y -= 28;
      }
      y -= 8;
    }
  }
  return Buffer.from(await pdf.save());
}

export async function generateSpreadsheet(db: Db, owner: ArtifactOwner, input: { title: string; headers: string[]; rows: Array<Array<string | number>>; notes?: string }) {
  const sheet = XLSX.utils.aoa_to_sheet([input.headers, ...input.rows]);
  sheet["!cols"] = input.headers.map((header, index) => ({ wch: Math.max(header.length + 2, ...input.rows.map((row) => String(row[index] ?? "").length + 2), 12) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Orçamento");
  if (input.notes) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Observações"], [input.notes]]), "Observações");
  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  return persistArtifact(db, owner, { buffer, filename: `${safeBaseName(input.title, "orcamento")}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "spreadsheet" });
}

export async function generateDocument(db: Db, owner: ArtifactOwner, input: { title: string; sections: Section[]; format: "docx" | "pdf" }) {
  const basename = safeBaseName(input.title, "documento");
  if (input.format === "pdf") {
    return persistArtifact(db, owner, { buffer: await makePdf(input.title, input.sections), filename: `${basename}.pdf`, mime: "application/pdf", kind: "pdf" });
  }
  const document = new Document({ sections: [{ children: [
    new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }),
    ...input.sections.flatMap((section) => [
      new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }),
      ...section.content.split("\n").filter(Boolean).map((text) => new Paragraph({ children: [new TextRun(text)] })),
    ]),
  ] }] });
  return persistArtifact(db, owner, { buffer: await Packer.toBuffer(document), filename: `${basename}.docx`, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document" });
}

export async function generateBudgetDocument(db: Db, owner: ArtifactOwner, input: { title: string; headers: string[]; rows: Array<Array<string | number>>; notes?: string; format: "docx" | "pdf" }) {
  const lines = input.rows.map((row) => row.map(String).join(" | ")).join("\n");
  if (input.format === "pdf") return generateDocument(db, owner, { title: input.title, format: "pdf", sections: [{ heading: input.headers.join(" | "), content: lines }, ...(input.notes ? [{ heading: "Observações", content: input.notes }] : [])] });
  const table = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: input.headers.map((value) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold: true })] })] })) }),
    ...input.rows.map((row) => new TableRow({ children: row.map((value) => new TableCell({ children: [new Paragraph(String(value))] })) })),
  ] });
  const document = new Document({ sections: [{ children: [new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }), table, ...(input.notes ? [new Paragraph({ text: "Observações", heading: HeadingLevel.HEADING_1 }), new Paragraph(input.notes)] : [])] }] });
  return persistArtifact(db, owner, { buffer: await Packer.toBuffer(document), filename: `${safeBaseName(input.title, "orcamento")}.docx`, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document" });
}

export async function generatePresentation(db: Db, owner: ArtifactOwner, input: { title: string; slides: Slide[]; format: "pptx" | "pdf" }) {
  const basename = safeBaseName(input.title, "apresentacao");
  if (input.format === "pdf") {
    return persistArtifact(db, owner, { buffer: await makePresentationPdf(input.title, input.slides), filename: `${basename}.pdf`, mime: "application/pdf", kind: "pdf" });
  }
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "Sequor IA Assistente";
  const cover = presentation.addSlide();
  cover.background = { color: "071A2D" };
  cover.addText(input.title, { x: 0.8, y: 2.6, w: 11.7, h: 1.2, fontFace: "Aptos Display", fontSize: 28, bold: true, color: "FFFFFF", align: "center" });
  for (const item of input.slides) {
    const slide = presentation.addSlide();
    slide.addText(item.title, { x: 0.6, y: 0.4, w: 12, h: 0.6, fontFace: "Aptos Display", fontSize: 24, bold: true, color: "071A2D" });
    slide.addText(item.bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), { x: 0.8, y: 1.3, w: 11.5, h: 5.5, fontFace: "Aptos", fontSize: 18, color: "23384D", breakLine: true, valign: "top", margin: 0.08 });
  }
  const output = await presentation.write({ outputType: "nodebuffer" });
  return persistArtifact(db, owner, { buffer: Buffer.from(output as Uint8Array), filename: `${basename}.pptx`, mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "presentation" });
}

export async function generateImage(db: Db, owner: ArtifactOwner, input: { prompt: string; size: "1024x1024" | "1024x1536" | "1536x1024"; quality: "low" | "medium" | "high" }) {
  const startedAt = Date.now();
  try {
    const key = await getOpenAIKey(db);
    const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/v1$/, "");
    const response = await fetch(`${base}/v1/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2", prompt: input.prompt, size: input.size, quality: input.quality, output_format: "png" }),
      signal: AbortSignal.timeout(110_000),
    });
    const body = await response.json() as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
    if (!response.ok || !body.data?.[0]?.b64_json) throw new Error(body.error?.message ?? "Falha ao gerar imagem");
    const artifact = await persistArtifact(db, owner, { buffer: Buffer.from(body.data[0].b64_json, "base64"), filename: `imagem-${Date.now()}.png`, mime: "image/png", kind: "image" });
    await recordGenerationUsage(db, { userId: owner.userId, conversationId: owner.conversationId, kind: "image", model: "gpt-image-2", durationMs: Date.now() - startedAt, success: true })
      .catch((error) => console.error("[artefato] não foi possível registrar o uso da imagem", error));
    return artifact;
  } catch (error) {
    await recordGenerationUsage(db, { userId: owner.userId, conversationId: owner.conversationId, kind: "image", model: "gpt-image-2", durationMs: Date.now() - startedAt, success: false, error: error instanceof Error ? error.message : String(error) })
      .catch((usageError) => console.error("[artefato] não foi possível registrar a falha da imagem", usageError));
    throw error;
  }
}

export async function getArtifact(db: Db, id: string) {
  return (await db.select().from(artifacts).where(eq(artifacts.id, id)))[0] ?? null;
}
