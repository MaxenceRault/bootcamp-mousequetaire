import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { TripItemColor, TripPdfTemplate } from "@/schemas/trip.schema";

export type TripPdfItem = {
  time: string;
  title: string;
  category: string;
  // Couleur de la case (choisie, ou celle de la catégorie).
  color: TripItemColor;
  description: string | null;
  source: string | null;
};

// Textes déjà traduits et formatés par le service : ce fichier ne fait que la mise en page.
export type TripPdfContent = {
  title: string;
  subtitle: string;
  header: { brand: string; documentTitle: string; exportedOn: string };
  note: { title: string; text: string } | null;
  budget: { title: string; rows: [string, string][]; total: [string, string] };
  days: {
    title: string;
    list: {
      heading: string;
      // Tableau : « Jour 3 » et « Mer. 5 nov. » ; livret : « Mercredi 5 novembre ».
      label: string;
      date: string;
      fullDate: string;
      empty: string | null;
      items: TripPdfItem[];
    }[];
  };
  tasks: { title: string; list: { label: string; detail: string | null; done: boolean }[] } | null;
  notesTitle: string;
  footer: string;
  pageLabel: (page: number, total: number) => string;
};

type PageSize = { width: number; height: number; margin: number };

// En points.
const A4_PORTRAIT: PageSize = { width: 595.28, height: 841.89, margin: 50 };
const A4_LANDSCAPE: PageSize = { width: 841.89, height: 595.28, margin: 36 };
const A5_PORTRAIT: PageSize = { width: 419.53, height: 595.28, margin: 36 };
const FOOTER_SPACE = 30;
const hex = (value: string) => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
// Tokens de src/app/globals.css (ink, ink-soft, accent, line, surface-muted, cell-*).
const COLORS = {
  ink: hex("#1a202c"),
  inkSoft: hex("#37474f"),
  accent: hex("#ff5a5f"),
  line: rgb(0.88, 0.89, 0.9),
  muted: hex("#f3f4f5"),
  white: rgb(1, 1, 1),
};
const CELL: Record<TripItemColor, { fill: RGB; strong: RGB }> = {
  coral: { fill: hex("#ffe1dc"), strong: hex("#e5484d") },
  sky: { fill: hex("#dcecfb"), strong: hex("#3b82c4") },
  mint: { fill: hex("#dcf3e6"), strong: hex("#2f9e66") },
  sun: { fill: hex("#fff1c7"), strong: hex("#c98f00") },
  lavender: { fill: hex("#ebe3fb"), strong: hex("#8a63d2") },
  sand: { fill: hex("#f1e9dc"), strong: hex("#a07a4a") },
  rose: { fill: hex("#fbe0ec"), strong: hex("#d6487e") },
  slate: { fill: hex("#e3e8ec"), strong: hex("#5f7380") },
};
const TIME_COLUMN = 48;

export async function renderTripPdf(content: TripPdfContent, template: TripPdfTemplate): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(content.title);
  pdf.setCreator(content.header.brand);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  const writer =
    template === "table"
      ? renderTable(new PageWriter(pdf, fonts, A4_LANDSCAPE), content)
      : template === "booklet"
        ? renderBooklet(new PageWriter(pdf, fonts, A5_PORTRAIT), content)
        : renderClassic(new PageWriter(pdf, fonts, A4_PORTRAIT), content);
  writer.footers(content.footer, content.pageLabel);
  return pdf.save();
}

// Modèle « classique » : budget puis planning complet, à la suite.
function renderClassic(writer: PageWriter, content: TripPdfContent) {
  writer.header(content.header);
  writer.text(content.title, { size: 22, font: "bold", gapAfter: 6 });
  writer.text(content.subtitle, { size: 10.5, color: COLORS.inkSoft, gapAfter: 14 });
  writeNote(writer, content);
  writeBudget(writer, content);

  writer.sectionTitle(content.days.title);
  for (const day of content.days.list) {
    // Un titre de jour n'est jamais seul en bas de page.
    writer.ensure(48);
    writer.text(day.heading, { size: 11.5, font: "bold", color: COLORS.accent, gapAfter: 4 });
    if (day.empty) writer.text(day.empty, { size: 9.5, color: COLORS.inkSoft, gapAfter: 8 });
    for (const item of day.items) writer.item(item);
    writer.space(8);
  }
  writeTasks(writer, content);
  return writer;
}

// Modèle « livret » (A5) : couverture, puis une page par jour avec un espace de notes, puis la checklist.
function renderBooklet(writer: PageWriter, content: TripPdfContent) {
  writer.header(content.header);
  writer.space(40);
  writer.text(content.title, { size: 24, font: "bold", gapAfter: 8 });
  writer.text(content.subtitle, { size: 10, color: COLORS.inkSoft, gapAfter: 18 });
  writeNote(writer, content);
  writeBudget(writer, content);

  for (const day of content.days.list) {
    writer.newPage();
    writer.text(day.label.toUpperCase(), { size: 10, font: "bold", color: COLORS.accent, gapAfter: 2 });
    writer.text(day.fullDate, { size: 20, font: "bold", gapAfter: 14 });
    if (day.empty) writer.text(day.empty, { size: 9.5, color: COLORS.inkSoft, gapAfter: 8 });
    for (const item of day.items) writer.item(item, { colored: true });
    writer.notes(content.notesTitle);
  }

  if (content.tasks) {
    writer.newPage();
    writeTasks(writer, content);
  }
  return writer;
}

// Modèle « tableau » (A4 paysage) : jours en colonnes (7 par page), heures en lignes, cases colorées.
function renderTable(writer: PageWriter, content: TripPdfContent) {
  const DAYS_PER_PAGE = 7;
  const HOUR_COLUMN = 40;
  const hourOf = (item: TripPdfItem) => Number(item.time.slice(0, 2));
  const allItems = content.days.list.flatMap((day) => day.items);
  const first = Math.min(7, ...allItems.map(hourOf));
  const last = Math.max(21, ...allItems.map(hourOf));
  const hours = Array.from({ length: last - first + 1 }, (_, index) => first + index);

  for (let start = 0; start < content.days.list.length; start += DAYS_PER_PAGE) {
    const days = content.days.list.slice(start, start + DAYS_PER_PAGE);
    if (start > 0) writer.newPage();
    const columnWidth = (writer.contentWidth - HOUR_COLUMN) / DAYS_PER_PAGE;
    const columnX = (index: number) => writer.left + HOUR_COLUMN + index * columnWidth;

    const drawHeader = () => {
      writer.text(content.title, { size: 15, font: "bold", gapAfter: 2 });
      writer.text(content.subtitle, { size: 8.5, color: COLORS.inkSoft, gapAfter: 8 });
      const height = 26;
      writer.rect(writer.left, writer.y - height, writer.contentWidth, height, COLORS.muted);
      days.forEach((day, index) => {
        writer.drawAt(day.label, columnX(index) + 5, writer.y - 11, { size: 8.5, font: "bold" });
        writer.drawAt(day.date, columnX(index) + 5, writer.y - 21, { size: 7.5, color: COLORS.inkSoft });
      });
      writer.space(height);
    };
    drawHeader();

    for (const hour of hours) {
      const cells = days.map((day) => day.items.filter((item) => hourOf(item) === hour));
      const boxes = cells.map((items) => items.map((item) => writer.wrap(item.title, 7.5, "bold", columnWidth - 14)));
      const boxHeight = (lines: string[]) => 10 + lines.length * 9 + 4;
      const rowHeight = Math.max(20, ...boxes.map((cell) => cell.reduce((sum, lines) => sum + boxHeight(lines) + 2, 2)));
      if (!writer.fits(rowHeight)) {
        writer.newPage();
        drawHeader();
      }

      const top = writer.y;
      writer.hline(writer.left, writer.left + writer.contentWidth, top);
      writer.drawAt(`${String(hour).padStart(2, "0")}:00`, writer.left + 4, top - 10, { size: 7.5, color: COLORS.inkSoft });
      cells.forEach((items, index) => {
        let y = top - 2;
        items.forEach((item, itemIndex) => {
          const lines = boxes[index][itemIndex];
          const height = boxHeight(lines);
          const x = columnX(index) + 2;
          writer.rect(x, y - height, columnWidth - 4, height, CELL[item.color].fill);
          writer.rect(x, y - height, 2.5, height, CELL[item.color].strong);
          writer.drawAt(item.time, x + 6, y - 9, { size: 6.5, color: COLORS.inkSoft });
          lines.forEach((line, lineIndex) => writer.drawAt(line, x + 6, y - 18 - lineIndex * 9, { size: 7.5, font: "bold" }));
          y -= height + 2;
        });
      });
      for (let index = 0; index <= days.length; index++) {
        writer.vline(columnX(index), top, top - rowHeight);
      }
      writer.space(rowHeight);
    }
    writer.hline(writer.left, writer.left + writer.contentWidth, writer.y);
  }
  return writer;
}

function writeNote(writer: PageWriter, content: TripPdfContent) {
  if (!content.note) return;
  writer.box(`${content.note.title} : ${content.note.text}`, { size: 9.5 });
  writer.space(14);
}

function writeBudget(writer: PageWriter, content: TripPdfContent) {
  writer.sectionTitle(content.budget.title);
  for (const [label, amount] of content.budget.rows) writer.row(label, amount);
  writer.row(content.budget.total[0], content.budget.total[1], { bold: true, line: false });
  writer.space(16);
}

function writeTasks(writer: PageWriter, content: TripPdfContent) {
  if (!content.tasks) return;
  writer.space(6);
  writer.sectionTitle(content.tasks.title);
  for (const task of content.tasks.list) {
    const detail = task.detail ? ` — ${task.detail}` : "";
    writer.text(`${task.done ? "[x]" : "[ ]"}  ${task.label}${detail}`, { size: 9.5, gapAfter: 3 });
  }
}

type Fonts = { regular: PDFFont; bold: PDFFont };
type TextOptions = { size: number; font?: keyof Fonts; color?: RGB; gapAfter?: number; indent?: number };

class PageWriter {
  private page: PDFPage;
  y: number;
  private readonly pdf: PDFDocument;
  private readonly fonts: Fonts;
  private readonly size: PageSize;
  private readonly charsets: Record<keyof Fonts, Set<number>>;

  constructor(pdf: PDFDocument, fonts: Fonts, size: PageSize) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.size = size;
    this.page = pdf.addPage([size.width, size.height]);
    this.y = size.height - size.margin;
    this.charsets = { regular: new Set(fonts.regular.getCharacterSet()), bold: new Set(fonts.bold.getCharacterSet()) };
  }

  get left() {
    return this.size.margin;
  }

  get contentWidth() {
    return this.size.width - this.size.margin * 2;
  }

  header({ brand, documentTitle, exportedOn }: TripPdfContent["header"]) {
    const top = this.y - 14;
    this.drawAt(brand, this.left, top, { size: 18, font: "bold" });
    const right = (text: string, y: number, options: TextOptions) => {
      const width = this.fonts[options.font ?? "regular"].widthOfTextAtSize(this.clean(text, options.font), options.size);
      this.drawAt(text, this.size.width - this.size.margin - width, y, options);
    };
    right(documentTitle.toUpperCase(), top + 4, { size: 9.5, font: "bold" });
    right(exportedOn, top - 9, { size: 8.5, color: COLORS.inkSoft });
    this.y = top - 18;
    this.page.drawLine({
      start: { x: this.left, y: this.y },
      end: { x: this.left + this.contentWidth, y: this.y },
      thickness: 1.5,
      color: COLORS.accent,
    });
    this.y -= 26;
  }

  sectionTitle(title: string) {
    this.ensure(40);
    this.text(title, { size: 14, font: "bold", gapAfter: 8 });
  }

  text(text: string, options: TextOptions) {
    const indent = options.indent ?? 0;
    for (const line of this.wrap(text, options.size, options.font, this.contentWidth - indent)) {
      this.ensure(options.size * 1.4);
      this.y -= options.size;
      this.drawAt(line, this.left + indent, this.y, options);
      this.y -= options.size * 0.4;
    }
    this.y -= options.gapAfter ?? 0;
  }

  box(text: string, { size }: { size: number }) {
    const lines = this.wrap(text, size, "regular", this.contentWidth - 20);
    const height = lines.length * size * 1.4 + 16;
    this.ensure(height);
    this.rect(this.left, this.y - height, this.contentWidth, height, COLORS.muted);
    let y = this.y - 8;
    for (const line of lines) {
      y -= size;
      this.drawAt(line, this.left + 10, y, { size, color: COLORS.inkSoft });
      y -= size * 0.4;
    }
    this.y -= height;
  }

  row(label: string, value: string, { bold = false, line = true } = {}) {
    const font = bold ? "bold" : "regular";
    this.ensure(18);
    this.y -= 12;
    this.drawAt(label, this.left, this.y, { size: 10, font });
    const width = this.fonts[font].widthOfTextAtSize(this.clean(value, font), 10);
    this.drawAt(value, this.left + this.contentWidth - width, this.y, { size: 10, font });
    this.y -= 5;
    if (line) this.hline(this.left, this.left + this.contentWidth, this.y);
    this.y -= 3;
  }

  // colored : pastille de la couleur de la case devant l'heure (livret).
  item(item: TripPdfItem, { colored = false } = {}) {
    const textWidth = this.contentWidth - TIME_COLUMN;
    const title = this.wrap(item.title, 10.5, "bold", textWidth);
    const meta = this.wrap(item.category, 8.5, "regular", textWidth);
    const description = item.description ? this.wrap(item.description, 9.5, "regular", textWidth) : [];
    const source = item.source ? this.wrap(item.source, 8.5, "regular", textWidth) : [];
    // Une activité n'est jamais coupée entre deux pages.
    this.ensure((title.length + meta.length + description.length + source.length) * 14 + 8);

    this.y -= 10.5;
    if (colored) this.page.drawCircle({ x: this.left + 3, y: this.y + 3.5, size: 3, color: CELL[item.color].strong });
    this.drawAt(item.time, this.left + (colored ? 10 : 0), this.y, { size: 10.5, font: "bold" });
    this.lines(title, 10.5, "bold", COLORS.ink, true);
    this.lines(meta, 8.5, "regular", colored ? CELL[item.color].strong : COLORS.accent);
    this.lines(description, 9.5, "regular", COLORS.inkSoft);
    this.lines(source, 8.5, "regular", COLORS.inkSoft);
    this.y -= 4;
    this.hline(this.left, this.left + this.contentWidth, this.y);
    this.y -= 6;
  }

  // Lignes pour écrire à la main jusqu'en bas de la page (au moins 3, sinon page suivante).
  notes(title: string) {
    const LINE = 20;
    this.ensure(30 + LINE * 3);
    this.space(10);
    this.text(title, { size: 9, font: "bold", color: COLORS.inkSoft, gapAfter: 4 });
    while (this.fits(LINE)) {
      this.y -= LINE;
      this.hline(this.left, this.left + this.contentWidth, this.y);
    }
  }

  space(points: number) {
    this.y -= points;
  }

  fits(height: number) {
    return this.y - height >= this.size.margin + FOOTER_SPACE;
  }

  // Nouvelle page si la place restante est insuffisante.
  ensure(height: number) {
    if (!this.fits(height)) this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage([this.size.width, this.size.height]);
    this.y = this.size.height - this.size.margin;
  }

  rect(x: number, y: number, width: number, height: number, color: RGB) {
    this.page.drawRectangle({ x, y, width, height, color });
  }

  hline(fromX: number, toX: number, y: number) {
    this.page.drawLine({ start: { x: fromX, y }, end: { x: toX, y }, thickness: 0.5, color: COLORS.line });
  }

  vline(x: number, fromY: number, toY: number) {
    this.page.drawLine({ start: { x, y: fromY }, end: { x, y: toY }, thickness: 0.5, color: COLORS.line });
  }

  footers(footer: string, pageLabel: TripPdfContent["pageLabel"]) {
    const pages = this.pdf.getPages();
    pages.forEach((page, index) => {
      this.page = page;
      const y = this.size.margin - 18;
      this.hline(this.left, this.left + this.contentWidth, y + 12);
      this.drawAt(footer, this.left, y, { size: 8, color: COLORS.inkSoft });
      const label = pageLabel(index + 1, pages.length);
      const width = this.fonts.regular.widthOfTextAtSize(this.clean(label), 8);
      this.drawAt(label, this.left + this.contentWidth - width, y, { size: 8, color: COLORS.inkSoft });
    });
  }

  drawAt(text: string, x: number, y: number, { size, font = "regular", color = COLORS.ink }: TextOptions) {
    this.page.drawText(this.clean(text, font), { x, y, size, font: this.fonts[font], color });
  }

  wrap(text: string, size: number, font: keyof Fonts = "regular", maxWidth: number) {
    const measure = (value: string) => this.fonts[font].widthOfTextAtSize(value, size);
    const lines: string[] = [];
    let current = "";
    for (const word of this.clean(text, font).split(" ").filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // Mot plus long que la ligne (URL…) : coupé.
      current = word;
      while (measure(current) > maxWidth) {
        let cut = current.length - 1;
        while (cut > 1 && measure(current.slice(0, cut)) > maxWidth) cut--;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  }

  // Suite de lignes dans la colonne de texte (à droite de l'heure) ; la première peut partager la ligne de l'heure.
  private lines(lines: string[], size: number, font: keyof Fonts, color: RGB, firstOnCurrentLine = false) {
    lines.forEach((line, index) => {
      if (!(firstOnCurrentLine && index === 0)) this.y -= size;
      this.drawAt(line, this.left + TIME_COLUMN, this.y, { size, font, color });
      this.y -= size * 0.4;
    });
  }

  // Polices standard (WinAnsi) : un caractère hors de leur jeu ferait échouer tout le PDF.
  // Lettre accentuée rare → sans accent (ō → o) ; emoji, idéogrammes… retirés.
  private clean(text: string, font: keyof Fonts = "regular") {
    const supported = this.charsets[font];
    const isSupported = (value: string) => Array.from(value).every((char) => supported.has(char.codePointAt(0) ?? 0));
    return Array.from(text.replace(/\s+/g, " "))
      .map((char) => {
        if (isSupported(char)) return char;
        const plain = char.normalize("NFD").replace(/\p{Diacritic}/gu, "");
        return plain && isSupported(plain) ? plain : "";
      })
      .join("")
      .replace(/ {2,}/g, " ")
      .trim();
  }
}
