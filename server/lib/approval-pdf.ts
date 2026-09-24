import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib"
import type { ApplicationDetail } from "../../shared/admin"

const COMPANY = {
  name: "Sassy Cosmetic & Beauty Products (K) Limited",
  address: "P.O. Box 12404-00100 Nairobi, Kenya.",
  phones: "Tel: +254 706 238 579/721 239 867",
}

const INK = rgb(0.12, 0.12, 0.12)
const MUTED = rgb(0.38, 0.38, 0.38)
const GREEN = rgb(0.16, 0.32, 0.16)
const LINE = rgb(0.72, 0.72, 0.72)

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN_X = 54
const TOP = 52
const BOTTOM = 54
const CONTENT_W = PAGE_W - MARGIN_X * 2

interface Fonts {
  regular: PDFFont
  bold: PDFFont
}

function safeText(font: PDFFont, value: string): string {
  let result = ""
  for (const char of value.replace(/\t/g, " ")) {
    try {
      font.encodeText(char)
      result += char
    } catch {
      result += "?"
    }
  }
  return result
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safeText(font, text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) lines.push(current)

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word
      continue
    }

    let rest = word
    while (rest.length > 1 && font.widthOfTextAtSize(rest, size) > maxWidth) {
      let cut = rest.length - 1
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    current = rest
  }

  if (current) lines.push(current)
  return lines.length ? lines : [""]
}

function field(app: ApplicationDetail, ...keys: string[]): string {
  for (const key of keys) {
    const value = app.fields?.[key]
    if (value && value.trim()) return value.trim()
  }
  return ""
}

function formatDate(value?: string): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

class PdfSheet {
  pages: PDFPage[] = []
  page: PDFPage
  y: number

  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.page = doc.addPage([PAGE_W, PAGE_H])
    this.pages.push(this.page)
    this.y = PAGE_H - TOP
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.pages.push(this.page)
    this.y = PAGE_H - TOP
  }

  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage()
  }

  text(
    value: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont,
    color = INK,
  ) {
    this.page.drawText(safeText(font, value), { x, y, size, font, color })
  }

  rule(y: number, thickness = 0.6, color = LINE) {
    this.page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: PAGE_W - MARGIN_X, y },
      thickness,
      color,
    })
  }
}

function drawHeader(sheet: PdfSheet, app: ApplicationDetail) {
  const { fonts } = sheet

  sheet.text(COMPANY.name, MARGIN_X, sheet.y, 13, fonts.bold, GREEN)
  sheet.y -= 17
  sheet.text(COMPANY.address, MARGIN_X, sheet.y, 9.5, fonts.regular, INK)
  sheet.y -= 14
  sheet.text(COMPANY.phones, MARGIN_X, sheet.y, 9.5, fonts.regular, INK)
  sheet.y -= 18
  sheet.rule(sheet.y, 0.8, GREEN)
  sheet.y -= 24

  sheet.text(`Ref: ${app.reference || "—"}`, MARGIN_X, sheet.y, 9.5, fonts.regular, INK)

  const date = formatDate(app.reviewedAt || app.submittedAt)
  const dateText = `Date: ${date || "—"}`
  const dateWidth = fonts.regular.widthOfTextAtSize(dateText, 9.5)
  sheet.text(dateText, PAGE_W - MARGIN_X - dateWidth, sheet.y, 9.5, fonts.regular, INK)

  sheet.y -= 34
}

function drawTitle(sheet: PdfSheet) {
  const { fonts } = sheet
  const title = "CUSTOMER REGISTRATION — APPROVAL NOTICE"
  const width = fonts.bold.widthOfTextAtSize(title, 14)
  sheet.text(title, (PAGE_W - width) / 2, sheet.y, 14, fonts.bold, INK)
  sheet.y -= 30
}

function drawParagraph(sheet: PdfSheet, text: string) {
  const lines = wrap(text, sheet.fonts.regular, 10.5, CONTENT_W)
  sheet.ensure(lines.length * 14 + 8)

  for (const line of lines) {
    sheet.text(line, MARGIN_X, sheet.y, 10.5, sheet.fonts.regular, INK)
    sheet.y -= 14
  }
  sheet.y -= 8
}

function drawSection(sheet: PdfSheet, title: string, rows: Array<[string, string]>) {
  sheet.ensure(36 + rows.length * 19)
  sheet.text(title, MARGIN_X, sheet.y, 10.5, sheet.fonts.bold, GREEN)
  sheet.y -= 17
  sheet.rule(sheet.y, 0.5)
  sheet.y -= 10

  for (const [label, value] of rows) {
    const displayValue = value || "—"
    const valueX = MARGIN_X + 175
    const valueLines = wrap(
      displayValue,
      sheet.fonts.regular,
      9.5,
      PAGE_W - MARGIN_X - valueX,
    )
    const rowHeight = Math.max(17, valueLines.length * 12 + 5)

    sheet.ensure(rowHeight)

    sheet.text(label, MARGIN_X, sheet.y, 9.5, sheet.fonts.bold, INK)

    valueLines.forEach((line, index) => {
      sheet.text(
        line,
        valueX,
        sheet.y - index * 12,
        9.5,
        sheet.fonts.regular,
        INK,
      )
    })

    sheet.y -= rowHeight
  }

  sheet.y -= 16
}

function drawFooter(sheet: PdfSheet) {
  const total = sheet.pages.length

  sheet.pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN_X, y: 40 },
      end: { x: PAGE_W - MARGIN_X, y: 40 },
      thickness: 0.5,
      color: LINE,
    })

    const text = "This is a system-generated document and does not require a signature."
    const width = sheet.fonts.regular.widthOfTextAtSize(text, 8)
    page.drawText(safeText(sheet.fonts.regular, text), {
      x: MARGIN_X,
      y: 25,
      size: 8,
      font: sheet.fonts.regular,
      color: MUTED,
      maxWidth: PAGE_W - MARGIN_X * 2 - 70,
    })

    const pageText = `Page ${index + 1} of ${total}`
    const pageWidth = sheet.fonts.regular.widthOfTextAtSize(pageText, 8)
    page.drawText(pageText, {
      x: PAGE_W - MARGIN_X - pageWidth,
      y: 25,
      size: 8,
      font: sheet.fonts.regular,
      color: MUTED,
    })
  })
}

export async function buildApprovalPdf(app: ApplicationDetail): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  doc.setTitle(`Customer Registration — Approval Notice — ${app.businessName}`)
  doc.setAuthor(COMPANY.name)
  doc.setSubject(app.reference)
  doc.setCreationDate(new Date())

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  }

  const sheet = new PdfSheet(doc, fonts)

  drawHeader(sheet, app)
  drawTitle(sheet)

  sheet.text(`Dear ${app.businessName || "Customer"},`, MARGIN_X, sheet.y, 10.5, fonts.regular, INK)
  sheet.y -= 24

  drawParagraph(
    sheet,
    "We confirm that your customer registration has been reviewed and approved, on the basis of the details below.",
  )

  drawSection(sheet, "CUSTOMER DETAILS", [
    ["Business Name", app.businessName],
    ["KRA PIN", app.kraPin || field(app, "kraPin")],
    ["Physical Address", field(app, "physicalAddress")],
    ["Phone", app.phone || field(app, "phone")],
    ["Email", app.email || field(app, "email")],
    ["Business Type", field(app, "bizType")],
    ["Business Permit No.", field(app, "permitNo")],
    ["Payment Terms Approved", field(app, "paymentTerms")],
  ])

  drawSection(sheet, "PRIMARY CONTACT", [
    ["Full Name", field(app, "cpName")],
    ["Position", field(app, "cpPosition")],
    ["Email", field(app, "cpEmail")],
    ["Mobile", field(app, "cpMobile")],
  ])

  drawSection(sheet, "AUTHORISED SIGNATORY", [
    ["Full Name", field(app, "sigName", "directorName", "dirName")],
    ["Designation", field(app, "sigDesignation", "directorDesignation", "dirPosition")],
  ])

  drawFooter(sheet, app)

  return doc.save()
}

export function approvalPdfFilename(app: ApplicationDetail): string {
  const clean = (value: string) =>
    value
      .replace(/[^A-Za-z0-9._ -]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  const reference = clean(app.reference) || `Row ${app.row}`
  const business = clean(app.businessName)

  return `${reference}${business ? ` - ${business}` : ""} Approval Notice.pdf`
}
