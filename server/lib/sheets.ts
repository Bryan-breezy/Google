import "dotenv/config"
import { JWT } from "google-auth-library"
import type {
  ApplicationDetail,
  ApplicationStatus,
  ApplicationSummary,
} from "../../shared/admin"
import { FIELD_LABELS, normalizeText } from "./google-forms"

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

export class AdminApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

/* -------------------------------------------------------------------------- */
/*  Storage backends                                                          */
/*                                                                            */
/*  All admin logic works on a plain table (header row + data rows). The real */
/*  backend reads and writes the linked Google Sheet; the demo backend keeps  */
/*  the same shape in memory so the admin screens can be tried without any    */
/*  Google credentials (ADMIN_DEMO=true).                                     */
/* -------------------------------------------------------------------------- */

interface Table {
  headers: string[]
  /** rows[0] is sheet row 2 */
  rows: string[][]
}

interface CellUpdate {
  /** 1-based sheet row (row 1 = header) */
  row: number
  /** 0-based column index */
  col: number
  value: string
}

interface TableBackend {
  read(): Promise<Table>
  write(updates: CellUpdate[]): Promise<void>
}

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"

function colToA1(index: number): string {
  let n = index + 1
  let out = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`
}

let jwtClient: JWT | undefined

function getJwt(): JWT {
  if (jwtClient) return jwtClient

  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let key = process.env.GOOGLE_PRIVATE_KEY

  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (json) {
    try {
      const parsed = JSON.parse(json) as { client_email?: string; private_key?: string }
      email = parsed.client_email ?? email
      key = parsed.private_key ?? key
    } catch {
      throw new AdminApiError(503, "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.")
    }
  }

  if (!email || !key) {
    throw new AdminApiError(503, "Google Sheets is not connected on the server.")
  }

  jwtClient = new JWT({
    email,
    // Hosting dashboards usually store the key with literal "\n" sequences.
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  return jwtClient
}

function explainGoogleError(error: unknown): AdminApiError {
  if (error instanceof AdminApiError) return error

  const err = error as {
    response?: { status?: number; data?: { error?: { message?: string } } }
    message?: string
  }
  const status = err.response?.status
  const detail = err.response?.data?.error?.message ?? err.message ?? "Unknown error"

  if (status === 403) {
    return new AdminApiError(
      502,
      "Google denied access to the sheet. Share it with the service account email as an Editor."
    )
  }
  if (status === 404) {
    return new AdminApiError(502, "Google could not find the sheet. Check GOOGLE_SHEET_ID and GOOGLE_SHEET_TAB.")
  }
  console.error("Google Sheets request failed:", detail)
  return new AdminApiError(502, "Could not reach Google Sheets.")
}

function createGoogleBackend(): TableBackend {
  const sheetId = process.env.GOOGLE_SHEET_ID?.trim()
  let tabCache: string | undefined

  async function resolveTab(client: JWT): Promise<string> {
    const configured = process.env.GOOGLE_SHEET_TAB?.trim()
    if (configured) return configured
    if (tabCache) return tabCache

    const res = await client.request<{ sheets?: { properties?: { title?: string } }[] }>({
      url: `${SHEETS_API}/${sheetId}`,
      params: { fields: "sheets.properties.title" },
    })
    const title = res.data.sheets?.[0]?.properties?.title
    if (!title) throw new AdminApiError(502, "The spreadsheet has no tabs.")
    tabCache = title
    return title
  }

  return {
    async read() {
      try {
        const client = getJwt()
        const tab = await resolveTab(client)
        const res = await client.request<{ values?: string[][] }>({
          url: `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(quoteTab(tab))}`,
          params: { majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" },
        })
        const values = res.data.values ?? []
        return { headers: (values[0] ?? []).map(String), rows: values.slice(1).map((r) => r.map(String)) }
      } catch (error) {
        throw explainGoogleError(error)
      }
    },

    async write(updates) {
      if (updates.length === 0) return
      try {
        const client = getJwt()
        const tab = await resolveTab(client)
        await client.request({
          url: `${SHEETS_API}/${sheetId}/values:batchUpdate`,
          method: "POST",
          data: {
            // RAW so reviewer notes starting with "=" are stored as text, not evaluated as formulas.
            valueInputOption: "RAW",
            data: updates.map((u) => ({
              range: `${quoteTab(tab)}!${colToA1(u.col)}${u.row}`,
              values: [[u.value]],
            })),
          },
        })
      } catch (error) {
        throw explainGoogleError(error)
      }
    },
  }
}

function createDemoBackend(): TableBackend {
  const fieldKeys = Object.keys(FIELD_LABELS)
  const headers = ["Timestamp", ...fieldKeys.map((key) => FIELD_LABELS[key as keyof typeof FIELD_LABELS][0])]

  const samples: Record<string, string>[] = [
    {
      businessName: "Demo Glow Beauty Ltd",
      kraPin: "P051234567A",
      physicalAddress: "Moi Avenue, Nairobi",
      phone: "0712 000 111",
      email: "accounts@demoglow.example",
      permitNo: "NBI-2026-0142",
      bizType: "Wholesale distributor",
      dirName: "Amina Wekesa",
      dirId: "23456789",
      dirEmail: "amina@demoglow.example",
      dirMobile: "0712 000 111",
      cpName: "Peter Otieno",
      cpPosition: "Operations manager",
      cpEmail: "peter@demoglow.example",
      cpMobile: "0722 000 222",
      financeName: "Ruth Njeri",
      financePosition: "Accountant",
      financeEmail: "ruth@demoglow.example",
      financeMobile: "0733 000 333",
      ref1Company: "Fresh Face Supplies",
      ref1Contact: "Joseph, 0700 111 222",
      ref1Email: "joseph@freshface.example",
      ref2Company: "Kiambu Beauty Hub",
      ref2Contact: "Lucy, 0700 333 444",
      bankName: "Equity Bank",
      bankBranch: "Kenyatta Avenue",
      acctName: "Demo Glow Beauty Ltd",
      acctNo: "0123456789012",
      paymentTerms: "30 days",
      documents: "Copy of ID / Passport; Business Permit / Trade License; KRA PIN Certificate",
      agreeCheck: "Yes, I confirm",
      sigName: "Amina Wekesa",
      sigDesignation: "Director",
      salesPersonId: "SP-014",
    },
    {
      businessName: "Mama Zawadi Salon & Spa",
      kraPin: "A009876543Z",
      physicalAddress: "Kiambu Road, Kiambu",
      phone: "0701 555 666",
      email: "zawadi@mamazawadi.example",
      permitNo: "KBU-8831",
      bizType: "Beauty salon / spa",
      dirName: "Zawadi Mutua",
      dirId: "12345678",
      dirMobile: "0701 555 666",
      cpName: "Zawadi Mutua",
      cpPosition: "Owner",
      cpMobile: "0701 555 666",
      ref1Company: "Glamour Point",
      ref1Contact: "Sarah, 0711 222 333",
      bankName: "KCB",
      bankBranch: "Thika",
      acctName: "Mama Zawadi Salon",
      acctNo: "1100223344",
      paymentTerms: "COD",
      documents: "Copy of ID / Passport; KRA PIN Certificate",
      agreeCheck: "Yes, I confirm",
      sigName: "Zawadi Mutua",
      sigDesignation: "Owner",
      salesPersonId: "SP-009",
    },
    {
      businessName: "Riverside Mini Mart",
      kraPin: "P055550001K",
      physicalAddress: "Ruiru Town",
      phone: "0799 888 777",
      email: "hello@riverside.example",
      bizType: "Supermarket",
      dirName: "Brian Kamau",
      dirId: "34567890",
      cpName: "Brian Kamau",
      cpPosition: "Director",
      bankName: "Co-operative Bank",
      acctName: "Riverside Mini Mart",
      acctNo: "01100998877",
      paymentTerms: "14 days",
      documents: "Copy of ID / Passport; Business Permit / Trade License",
      agreeCheck: "Yes, I confirm",
      sigName: "Brian Kamau",
      sigDesignation: "Director",
      salesPersonId: "SP-014",
    },
  ]

  const rows = samples.map((sample, i) => {
    const day = 12 + i
    const reference = `SASSY-2026-${sample.kraPin}-${sample.businessName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-${sample.phone.replace(/\D/g, "")}`
    const values: Record<string, string> = { ...sample, referenceNumber: reference }
    return [`9/${day}/2026 1${i}:32:11`, ...fieldKeys.map((key) => values[key] ?? "")]
  })

  const table: Table = { headers, rows }

  return {
    async read() {
      return { headers: [...table.headers], rows: table.rows.map((r) => [...r]) }
    },
    async write(updates) {
      for (const u of updates) {
        if (u.row === 1) {
          table.headers[u.col] = u.value
          continue
        }
        const row = table.rows[u.row - 2]
        if (!row) continue
        while (row.length <= u.col) row.push("")
        row[u.col] = u.value
      }
    },
  }
}

let backend: TableBackend | undefined

function getBackend(): TableBackend {
  if (backend) return backend

  if (process.env.ADMIN_DEMO === "true") {
    backend = createDemoBackend()
  } else {
    if (!process.env.GOOGLE_SHEET_ID?.trim()) {
      throw new AdminApiError(503, "GOOGLE_SHEET_ID is missing on the server.")
    }
    backend = createGoogleBackend()
  }
  return backend
}

export function isDemoMode(): boolean {
  return process.env.ADMIN_DEMO === "true"
}

export function isSheetsConfigured(): boolean {
  if (isDemoMode()) return true
  const hasId = Boolean(process.env.GOOGLE_SHEET_ID?.trim())
  const hasCreds =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) ||
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
  return hasId && hasCreds
}

/* -------------------------------------------------------------------------- */
/*  Header mapping                                                            */
/* -------------------------------------------------------------------------- */

type AdminColumn = "status" | "reviewedBy" | "reviewedAt" | "notes"

// Read at call time so values from .env are always picked up.
function adminHeaders(): Record<AdminColumn, string> {
  return {
    status: process.env.SHEET_STATUS_HEADER?.trim() || "Status",
    reviewedBy: "Reviewed By",
    reviewedAt: "Reviewed At",
    notes: "Review Notes",
  }
}

const labelToField = new Map<string, string>()
for (const [field, labels] of Object.entries(FIELD_LABELS)) {
  for (const label of labels) {
    const key = normalizeText(label)
    if (!labelToField.has(key)) labelToField.set(key, field)
  }
}

interface ColumnMap {
  fields: Map<string, number>
  timestamp?: number
  admin: Partial<Record<AdminColumn, number>>
}

/**
 * Columns are found by header text, not position, so the sheet can be reordered
 * or grow new columns without breaking the admin side.
 */
function buildColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = { fields: new Map(), admin: {} }
  const headerNames = adminHeaders()
  const adminByHeader = new Map<string, AdminColumn>(
    (Object.keys(headerNames) as AdminColumn[]).map((key) => [normalizeText(headerNames[key]), key])
  )

  headers.forEach((header, index) => {
    const normalized = normalizeText(header)
    if (!normalized) return

    const adminKey = adminByHeader.get(normalized)
    if (adminKey !== undefined) {
      if (map.admin[adminKey] === undefined) map.admin[adminKey] = index
      return
    }
    if (normalized === "timestamp") {
      if (map.timestamp === undefined) map.timestamp = index
      return
    }
    const field = labelToField.get(normalized)
    if (field && !map.fields.has(field)) map.fields.set(field, index)
  })

  return map
}

function parseStatus(raw: string): ApplicationStatus {
  const value = raw.trim().toLowerCase()
  if (["approved", "approve", "true", "yes"].includes(value)) return "Approved"
  if (["rejected", "reject", "declined"].includes(value)) return "Rejected"
  return "Pending"
}

function cell(row: string[], index: number | undefined): string {
  return index === undefined ? "" : (row[index] ?? "").trim()
}

function toDetail(rowNumber: number, row: string[], map: ColumnMap): ApplicationDetail {
  const fields: Record<string, string> = {}
  for (const [field, index] of map.fields) fields[field] = cell(row, index)

  return {
    row: rowNumber,
    reference: fields.referenceNumber ?? "",
    businessName: fields.businessName ?? "",
    kraPin: fields.kraPin ?? "",
    phone: fields.phone ?? "",
    email: fields.email ?? "",
    submittedAt: cell(row, map.timestamp),
    status: parseStatus(cell(row, map.admin.status)),
    reviewedBy: cell(row, map.admin.reviewedBy),
    reviewedAt: cell(row, map.admin.reviewedAt),
    notes: cell(row, map.admin.notes),
    fields,
  }
}

function isBlankRow(row: string[]): boolean {
  return row.every((value) => (value ?? "").trim() === "")
}

/* -------------------------------------------------------------------------- */
/*  Public operations                                                         */
/* -------------------------------------------------------------------------- */

export async function listApplications(): Promise<ApplicationSummary[]> {
  const table = await getBackend().read()
  const map = buildColumnMap(table.headers)

  const summaries: ApplicationSummary[] = []
  table.rows.forEach((row, index) => {
    if (isBlankRow(row)) return
    const { fields: _fields, notes: _notes, ...summary } = toDetail(index + 2, row, map)
    summaries.push(summary)
  })

  // Newest submissions first.
  return summaries.reverse()
}

export async function getApplication(rowNumber: number): Promise<ApplicationDetail> {
  const table = await getBackend().read()
  const row = table.rows[rowNumber - 2]

  if (!Number.isInteger(rowNumber) || rowNumber < 2 || !row || isBlankRow(row)) {
    throw new AdminApiError(404, "Application not found.")
  }
  return toDetail(rowNumber, row, buildColumnMap(table.headers))
}

function nowStamp(): string {
  const timeZone = process.env.ADMIN_TIMEZONE?.trim() || "Africa/Nairobi"
  // sv-SE renders as "2026-09-21 11:31", which sorts and reads cleanly in a sheet.
  return new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date())
}

export async function setApplicationStatus(input: {
  row: number
  reference: string
  status: ApplicationStatus
  notes: string
  reviewer: string
}): Promise<ApplicationDetail> {
  const store = getBackend()
  const table = await store.read()
  const row = table.rows[input.row - 2]

  if (!Number.isInteger(input.row) || input.row < 2 || !row || isBlankRow(row)) {
    throw new AdminApiError(404, "Application not found.")
  }

  const map = buildColumnMap(table.headers)
  const current = toDetail(input.row, row, map)

  // Rows can move if someone sorts or deletes in the sheet. If the reference in
  // this row is no longer the one the admin was looking at, do not write.
  if (input.reference && current.reference && current.reference !== input.reference) {
    throw new AdminApiError(409, "The sheet changed since this application was opened. Refresh and try again.")
  }

  const updates: CellUpdate[] = []
  let nextCol = table.headers.length

  // Create the review columns the first time they are needed.
  const columnFor = (key: AdminColumn): number => {
    const existing = map.admin[key]
    if (existing !== undefined) return existing
    const col = nextCol++
    updates.push({ row: 1, col, value: adminHeaders()[key] })
    return col
  }

  updates.push({ row: input.row, col: columnFor("status"), value: input.status })
  updates.push({ row: input.row, col: columnFor("reviewedBy"), value: input.reviewer })
  updates.push({ row: input.row, col: columnFor("reviewedAt"), value: nowStamp() })
  updates.push({ row: input.row, col: columnFor("notes"), value: input.notes })

  await store.write(updates)
  return getApplication(input.row)
}
