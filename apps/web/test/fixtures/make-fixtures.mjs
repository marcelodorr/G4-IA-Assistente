import { PDFDocument, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { writeFileSync } from "fs";
import * as fs from "fs";
import { fileURLToPath } from "url";

// xlsx's ESM build (xlsx.mjs) does not auto-wire Node's `fs` module the way
// the CJS build does; XLSX.writeFile needs it explicitly for Node.js targets.
XLSX.set_fs(fs);

const pdf = await PDFDocument.create();
const page = pdf.addPage();
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText("O faturamento do G4 em 2025 foi de 10 milhoes de reais.", { x: 50, y: 700, size: 14, font });
writeFileSync(new URL("./exemplo.pdf", import.meta.url), await pdf.save());

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([["Produto", "Receita"], ["Imersao", 5000000], ["Club", 3000000]]);
XLSX.utils.book_append_sheet(wb, ws, "Vendas");
XLSX.writeFile(wb, fileURLToPath(new URL("./exemplo.xlsx", import.meta.url)));
console.log("fixtures geradas");
