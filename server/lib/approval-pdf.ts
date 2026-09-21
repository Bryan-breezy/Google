import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib"
import { DETAIL_SECTIONS, nonEmptyGroups, visibleFields, type ApplicationDetail } from "../../shared/admin"
import { LOGO_PNG_BASE64 } from "./logo"

const COMPANY = {
  name: "Sassy Cosmetic & Beauty Products (K) Limited",
  address: "P.O. Box 12404–00100 Nairobi, Kenya",
  phones: "+254 706 238 579  |  +254 721 239 867",
}

const GREEN = rgb(0x2f / 255, 0x5a / 255, 0x1a / 255)
const GREEN_MID = rgb(0x4c / 255, 0x8c / 255, 0x2b / 255)
const GREEN_WASH = rgb(0xf5 / 255, 0xf8 / 255, 0xf0 / 255)
const BRASS = rgb(0xc8 / 255, 0x91 / 255, 0x32 / 255)
const INK = rgb(0x27 / 255, 0x2a / 255, 0x25 / 255)
const MUTED = rgb(0x6b / 255, 0x6e / 255, 0x65 / 255)
const LINE = rgb(0xdd / 255, 0xdc / 255, 0xd2 / 255)

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN_X = 48
const MARGIN_TOP = 44
const MARGIN_BOTTOM = 62
const CONTENT_W = PAGE_W - MARGIN_X * 2
const LABEL_W = 148

interface Fonts {
  sans: PDFFont
  sansBold: PDFFont
  serifBold: PDFFont
}

/** Standard PDF fonts only cover WinAnsi. Swap anything else for "?" instead of throwing. */
function safeText(font: PDFFont, text: string): string {
  let out = ""
  for (const ch of text.replace(/\t/g, " ")) {
    try {
      font.encodeText(ch)
      out += ch
    } catch {
      out += "?"
    }
  }
  return out
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []

  for (const paragraph of safeText(font, text).split(/\r?\n/)) {
    let current = ""

    const push = (word: string) => {
      // Break a single very long token (an email, a reference) across lines.
      let rest = word
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut -= 1
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      current = rest
    }

    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
      } else {
        if (current) lines.push(current)
        push(word)
      }
    }
    lines.push(current)
  }

  return lines.length ? lines : [""]
}

class Sheet {
  pages: PDFPage[] = []
  page!: PDFPage
  y = 0

  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts
  ) {
    this.addPage()
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.pages.push(this.page)
    this.y = PAGE_H - MARGIN_TOP
  }

  ensure(height: number) {
    if (this.y - height < MARGIN_BOTTOM) this.addPage()
  }

  text(value: string, x: number, y: number, size: number, font: PDFFont, color = INK) {
    this.page.drawText(safeText(font, value), { x, y, size, font, color })
  }

  rule(y: number, color = LINE, thickness = 0.5, x1 = MARGIN_X, x2 = PAGE_W - MARGIN_X) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })
  }
}

function drawLetterhead(sheet: Sheet, logo: Awaited<ReturnType<PDFDocument["embedPng"]>>) {
  const { fonts } = sheet
  const logoH = 50
  const logoW = (logo.width / logo.height) * logoH
  const top = sheet.y

  sheet.page.drawImage(logo, { x: MARGIN_X, y: top - logoH, width: logoW, height: logoH })

  const right = PAGE_W - MARGIN_X
  const lines: [string, PDFFont, number, ReturnType<typeof rgb>][] = [
    [COMPANY.name, fonts.sansBold, 10, GREEN],
    [COMPANY.address, fonts.sans, 8.5, MUTED],
    [COMPANY.phones, fonts.sans, 8.5, MUTED],
  ]
  let ly = top - 14
  for (const [value, font, size, color] of lines) {
    const w = font.widthOfTextAtSize(safeText(font, value), size)
    sheet.text(value, right - w, ly, size, font, color)
    ly -= size + 5
  }

  sheet.y = top - logoH - 12
  sheet.rule(sheet.y, GREEN, 2)
  sheet.rule(sheet.y - 3.5, BRASS, 0.8)
  sheet.y -= 34
}

function drawTitle(sheet: Sheet) {
  sheet.text("Customer approval", MARGIN_X, sheet.y - 20, 26, sheet.fonts.serifBold, GREEN)
  sheet.text("Registration and credit application", MARGIN_X, sheet.y - 38, 10.5, sheet.fonts.sans, MUTED)
  sheet.y -= 62
}

function drawApprovalPanel(sheet: Sheet, app: ApplicationDetail) {
  const { fonts } = sheet
  const padding = 16
  const innerW = CONTENT_W - padding * 2 - 6

  const rows: { label: string; value: string }[] = [
    { label: "Reference", value: app.reference || "—" },
    { label: "Approved by", value: app.reviewedBy || "—" },
    { label: "Approved on", value: app.reviewedAt || "—" },
  ]
  const notesLines = app.notes ? wrap(app.notes, fonts.sans, 9.5, innerW) : []

  const rowsH = rows.length * 17
  const notesH = notesLines.length ? 14 + notesLines.length * 13 : 0
  const height = padding + 20 + rowsH + notesH + padding - 4

  sheet.ensure(height + 20)
  const top = sheet.y
  const bottom = top - height

  sheet.page.drawRectangle({
    x: MARGIN_X, y: bottom, width: CONTENT_W, height,
    color: GREEN_WASH, borderColor: LINE, borderWidth: 0.6,
  })
  sheet.page.drawRectangle({ x: MARGIN_X, y: bottom, width: 4, height, color: GREEN })

  let y = top - padding - 8
  sheet.text("APPROVED", MARGIN_X + padding + 6, y, 12, fonts.sansBold, GREEN)
  y -= 22

  for (const row of rows) {
    sheet.text(row.label, MARGIN_X + padding + 6, y, 8.5, fonts.sans, MUTED)
    sheet.text(row.value, MARGIN_X + padding + 6 + 82, y, 10, fonts.sansBold, INK)
    y -= 17
  }

  if (notesLines.length) {
    y -= 2
    sheet.text("Reviewer notes", MARGIN_X + padding + 6, y, 8.5, fonts.sans, MUTED)
    y -= 13
    for (const line of notesLines) {
      sheet.text(line, MARGIN_X + padding + 6, y, 9.5, fonts.sans, INK)
      y -= 13
    }
  }

  sheet.y = bottom - 26
}

function drawSectionHeading(sheet: Sheet, title: string) {
  sheet.ensure(64)
  sheet.text(title, MARGIN_X, sheet.y - 12, 14, sheet.fonts.serifBold, GREEN)
  sheet.rule(sheet.y - 20, GREEN_MID, 0.8)
  sheet.y -= 30
}

function drawGroupTitle(sheet: Sheet, title: string) {
  sheet.ensure(40)
  sheet.text(title, MARGIN_X, sheet.y - 8, 9, sheet.fonts.sansBold, MUTED)
  sheet.y -= 18
}

function drawRow(sheet: Sheet, label: string, value: string) {
  const size = 10
  const lines = wrap(value.trim() === "" ? "—" : value, sheet.fonts.sans, size, CONTENT_W - LABEL_W - 8)
  const height = lines.length * 12.5 + 6

  sheet.ensure(height)
  const top = sheet.y
  sheet.text(label, MARGIN_X, top - 9.5, 8.5, sheet.fonts.sans, MUTED)
  lines.forEach((line, i) => {
    sheet.text(line, MARGIN_X + LABEL_W, top - 9.5 - i * 12.5, size, sheet.fonts.sans, value.trim() ? INK : MUTED)
  })
  sheet.rule(top - height + 3)
  sheet.y -= height
}

function drawSignOff(sheet: Sheet, app: ApplicationDetail) {
  sheet.ensure(96)
  sheet.y -= 10
  sheet.text(`Approved on behalf of ${COMPANY.name}`, MARGIN_X, sheet.y - 10, 9, sheet.fonts.sans, MUTED)
  sheet.y -= 50

  const colW = (CONTENT_W - 30) / 2
  sheet.rule(sheet.y, INK, 0.6, MARGIN_X, MARGIN_X + colW)
  sheet.rule(sheet.y, INK, 0.6, MARGIN_X + colW + 30, PAGE_W - MARGIN_X)
  sheet.text(app.reviewedBy ? `${app.reviewedBy} — signature` : "Signature", MARGIN_X, sheet.y - 13, 8.5, sheet.fonts.sans, MUTED)
  sheet.text(app.reviewedAt ? `Date — ${app.reviewedAt}` : "Date", MARGIN_X + colW + 30, sheet.y - 13, 8.5, sheet.fonts.sans, MUTED)
  sheet.y -= 30
}

function drawFooters(sheet: Sheet, app: ApplicationDetail) {
  const total = sheet.pages.length
  sheet.pages.forEach((page, index) => {
    const label = `${COMPANY.name}  |  Customer approval  |  ${app.businessName}`
    const pageLabel = `Page ${index + 1} of ${total}`
    const width = sheet.fonts.sans.widthOfTextAtSize(pageLabel, 8)

    page.drawLine({ start: { x: MARGIN_X, y: 42 }, end: { x: PAGE_W - MARGIN_X, y: 42 }, thickness: 0.5, color: LINE })
    page.drawText(safeText(sheet.fonts.sans, label), { x: MARGIN_X, y: 28, size: 8, font: sheet.fonts.sans, color: MUTED, maxWidth: CONTENT_W - width - 12 })
    page.drawText(pageLabel, { x: PAGE_W - MARGIN_X - width, y: 28, size: 8, font: sheet.fonts.sans, color: MUTED })
  })
}

export async function buildApprovalPdf(app: ApplicationDetail): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Customer approval — ${app.businessName}`)
  doc.setAuthor(COMPANY.name)
  doc.setSubject(app.reference)
  doc.setCreationDate(new Date())

  const fonts: Fonts = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
  }
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"))

  const sheet = new Sheet(doc, fonts)
  drawLetterhead(sheet, logo)
  drawTitle(sheet)
  drawApprovalPanel(sheet, app)

  for (const section of DETAIL_SECTIONS) {
    const groups = nonEmptyGroups(section, app.fields)
    if (groups.length === 0) continue

    drawSectionHeading(sheet, section.title)
    for (const group of groups) {
      if (group.title) drawGroupTitle(sheet, group.title)
      for (const field of visibleFields(group, app.fields)) drawRow(sheet, field.label, app.fields[field.key] ?? "")
      sheet.y -= 4
    }
    sheet.y -= 4
  }

  drawSignOff(sheet, app)
  drawFooters(sheet, app)

  return doc.save()
}

/** Same naming as the Sheet's PDF automation: "<reference> - <business name> Summary.pdf". */
export function approvalPdfFilename(app: ApplicationDetail): string {
  const clean = (value: string) => value.replace(/[^A-Za-z0-9._ -]+/g, " ").replace(/\s+/g, " ").trim()
  const reference = clean(app.reference) || `Row ${app.row}`
  const business = clean(app.businessName)
  return `${reference}${business ? ` - ${business}` : ""} Summary.pdf`
}
