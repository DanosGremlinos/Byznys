// Renders a contract (Markdown subset: #, ##, paragraphs, "- " lists, **bold**) to PDF with Noto Sans,
// which covers Czech diacritics. Fonts live in /assets/fonts (SIL OFL).
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = 56;
const CONTENT_WIDTH = PAGE.width - 2 * MARGIN;

let fontCache: Promise<[Uint8Array, Uint8Array]> | null = null;
function loadFonts() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  fontCache ??= Promise.all([
    readFile(path.join(dir, "NotoSans-Regular.ttf")),
    readFile(path.join(dir, "NotoSans-Bold.ttf")),
  ]);
  return fontCache;
}

type Run = { text: string; bold: boolean };

/** Splits "a **b** c" into styled runs. */
export function parseInline(line: string): Run[] {
  const runs: Run[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const p of parts)
    runs.push(
      p.startsWith("**") && p.endsWith("**")
        ? { text: p.slice(2, -2), bold: true }
        : { text: p, bold: false },
    );
  return runs;
}

export type Block = { type: "h1" | "h2" | "p" | "li" | "gap"; runs: Run[] };

/** Each source line keeps its own line in the PDF (contracts rely on line breaks); blank lines add space. */
export function parseContract(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (blocks.length && blocks[blocks.length - 1].type !== "gap") blocks.push({ type: "gap", runs: [] });
    } else if (line.startsWith("# ")) blocks.push({ type: "h1", runs: parseInline(line.slice(2)) });
    else if (line.startsWith("## ")) blocks.push({ type: "h2", runs: parseInline(line.slice(3)) });
    else if (/^\s*[-*] /.test(line))
      blocks.push({ type: "li", runs: parseInline(line.replace(/^\s*[-*] /, "")) });
    else blocks.push({ type: "p", runs: parseInline(line) });
  }
  return blocks;
}

export async function renderContractPdf(markdown: string, title = "Smlouva"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setLanguage("cs-CZ");
  const [regBytes, boldBytes] = await loadFonts();
  const regular = await doc.embedFont(regBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const newPageIfNeeded = (lineHeight: number) => {
    if (y - lineHeight < MARGIN) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };

  const drawRuns = (runs: Run[], size: number, indent = 0, forceBold = false) => {
    const lineHeight = size * 1.45;
    // Word-wrap across styled runs.
    type Word = { text: string; font: PDFFont };
    const words: Word[] = [];
    for (const r of runs) {
      const font = forceBold || r.bold ? bold : regular;
      for (const w of r.text.split(/(\s+)/).filter((x) => x.length)) words.push({ text: w, font });
    }
    let line: Word[] = [];
    let width = 0;
    const flushLine = () => {
      newPageIfNeeded(lineHeight);
      let x = MARGIN + indent;
      for (const w of line) {
        page.drawText(w.text, { x, y: y - size, size, font: w.font, color: rgb(0.07, 0.07, 0.07) });
        x += w.font.widthOfTextAtSize(w.text, size);
      }
      y -= lineHeight;
      line = [];
      width = 0;
    };
    for (const w of words) {
      const ww = w.font.widthOfTextAtSize(w.text, size);
      if (/^\s+$/.test(w.text) && line.length === 0) continue;
      if (width + ww > CONTENT_WIDTH - indent && line.length) {
        while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
        flushLine();
        if (/^\s+$/.test(w.text)) continue;
      }
      line.push(w);
      width += ww;
    }
    if (line.length) flushLine();
  };

  for (const block of parseContract(markdown)) {
    if (block.type === "h1") {
      drawRuns(block.runs, 17, 0, true);
      y -= 4;
    } else if (block.type === "h2") {
      y -= 6;
      drawRuns(block.runs, 12.5, 0, true);
      y -= 2;
    } else if (block.type === "li") {
      newPageIfNeeded(15);
      page.drawText("•", { x: MARGIN + 4, y: y - 10.5, size: 10.5, font: regular });
      drawRuns(block.runs, 10.5, 16);
    } else if (block.type === "gap") {
      y -= 7;
    } else {
      drawRuns(block.runs, 10.5);
    }
  }
  return doc.save();
}
