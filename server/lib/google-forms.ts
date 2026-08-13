import "dotenv/config"

export type GoogleFormFieldName =
  | "businessName"
  | "kraPin"
  | "physicalAddress"
  | "phone"
  | "email"
  | "permitNo"
  | "bizType"
  | "bizTypeOther"
  | "dirName"
  | "dirId"
  | "dirEmail"
  | "dirMobile"
  | "cpName"
  | "cpPosition"
  | "cpEmail"
  | "cpMobile"
  | "ref1Company"
  | "ref1Contact"
  | "ref1Email"
  | "ref2Company"
  | "ref2Contact"
  | "ref2Email"
  | "bankName"
  | "bankBranch"
  | "acctName"
  | "acctNo"
  | "paymentTerms"
  | "documents"
  | "agreeCheck"
  | "sigName"
  | "sigDesignation"

export interface GoogleFormConfig { 
  responseUrl: string,  
  entries: Partial< Record<GoogleFormFieldName, string>> 
}

const FIELD_LABELS: Record<GoogleFormFieldName,  string[]> = {
  businessName: [
    "Business Name",
    "Business name",
  ],

  kraPin: [
    "KRA PIN",
    "KRA Pin",
    "KRA PIN Number",
  ],

  physicalAddress: [
    "Physical Address",
    "Physical address",
  ],

  phone: [
    "Phone / mobile",
    "Phone Number",
  ],

  email: [
    "Email",
    "Email Address",
  ],

  permitNo: [
    "Business permit number",
    "Business Permit No",
    "Business Permit Number",
  ],

  bizType: [
    "Business type",
    "Biz Type",
    "Type of Business",
    "bizTypeOther"
  ],

  bizTypeOther: [
    "Other Business Type",
    "Business Type - Other",
    "Other",
  ],

  dirName: [
    "Director Name",
    "Director's Name",
    "Directors Name",
  ],

  dirId: [
    "Director ID",
    "Director ID Number",
    "Director Identification Number",
  ],

  dirEmail: [
    "Director Email",
    "Director's Email",
    "Director Email Address",
  ],

  dirMobile: [
    "Director Mobile",
    "Director's Mobile",
    "Director Phone",
    "Director Phone Number",
  ],

  cpName: [
    "Contact Person Name",
    "Contact Person",
    "CP Name",
  ],

  cpPosition: [
    "Contact Person Position",
    "Contact Person's Position",
    "CP Position",
  ],

  cpEmail: [
    "Contact Person Email",
    "Contact Person's Email",
    "CP Email",
  ],

  cpMobile: [
    "Contact Person Mobile",
    "Contact Person's Mobile",
    "Contact Person Phone",
    "CP Mobile",
  ],

  ref1Company: [
    "Reference 1 Company",
    "Reference 1 - Company",
    "Reference 1 Company Name",
  ],

  ref1Contact: [
    "Reference 1 Contact",
    "Reference 1 - Contact",
    "Reference 1 Contact Person",
  ],

  ref1Email: [
    "Reference 1 Email",
    "Reference 1 - Email",
  ],

  ref2Company: [
    "Reference 2 Company",
    "Reference 2 - Company",
    "Reference 2 Company Name",
  ],

  ref2Contact: [
    "Reference 2 Contact",
    "Reference 2 - Contact",
    "Reference 2 Contact Person",
  ],

  ref2Email: [
    "Reference 2 Email",
    "Reference 2 - Email",
  ],

  bankName: [
    "Bank Name",
    "Bank",
  ],

  bankBranch: [
    "Bank Branch",
    "Branch",
  ],

  acctName: [
    "Account Name",
    "Bank Account Name",
  ],

  acctNo: [
    "Account Number",
    "Account No",
    "Bank Account Number",
  ],

  paymentTerms: [
    "Payment Terms",
    "Payment Term",
  ],

  documents: [
    "Documents",
    "Supporting Documents",
    "Required Documents",
  ],

  agreeCheck: [
    "Agreement",
    "I Agree",
    "Agree",
    "Declaration",
  ],

  sigName: [
    "Signature Name",
    "Name of Signatory",
    "Signatory Name",
  ],

  sigDesignation: [
    "Signature Designation",
    "Signatory Designation",
    "Designation",
  ],
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function fetchGoogleForm( formUrl: string ): Promise<string> {
  const response = await fetch(formUrl, { cache: "no-store" })
  if (!response.ok) throw new Error(`Failed to fetch Google Form: ${response.status}`)
  return response.text()
}

function extractEntryIds(html: string): string[] {
  const matches = html.match(/entry\.\d+/g) ?? []

  return [...new Set(matches)]
}

function findEntryId( html: string, fieldName: GoogleFormFieldName): string | undefined {
  const labels = FIELD_LABELS[fieldName].map(normalizeText)
  const entryIds = extractEntryIds(html)

  for (const entryId of entryIds) {
    const index = html.indexOf(entryId)

    if (index === -1) continue

    const start = Math.max(0, index - 2000)
    const end = Math.min(html.length, index + 2000)
    const context = normalizeText(html.substring(start, end))
    if (labels.some((label) => context.includes(label))) return entryId
  }
  return undefined
}

let cachedConfig:
  | GoogleFormConfig
  | null = null

let cacheTime = 0

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getGoogleFormConfig(): Promise<GoogleFormConfig> {
  const formUrl = process.env.GOOGLE_FORMS_URL

  if (!formUrl) throw new Error("GOOGLE_FORMS_URL is missing.")
  const now = Date.now()

  if (cachedConfig && now - cacheTime < CACHE_DURATION) return cachedConfig

  const html = await fetchGoogleForm(formUrl)

  const entries: Partial<Record<GoogleFormFieldName, string>> = {}

  for (const fieldName of Object.keys(FIELD_LABELS) as GoogleFormFieldName[]) {
    const entryId = findEntryId(html, fieldName)

    if (entryId) { entries[fieldName] = entryId }
  }

  const responseUrl = formUrl.replace( /\/viewform.*$/, "/formResponse" )

  cachedConfig = { responseUrl,entries }

  cacheTime = now

  console.log("Google Form fields detected:",entries)

  return cachedConfig
}

export async function submitToGoogleForm(data: Partial< Record< GoogleFormFieldName, string | string[] >>) {
  const config = await getGoogleFormConfig()

  const payload = new URLSearchParams()
  for ( const [fieldName, value] of Object.entries(data) ) {
    const entryId = config.entries[fieldName as GoogleFormFieldName]

    if (!entryId) {
      console.warn(`Google Form field not found: ${fieldName}`)
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        payload.append(entryId, item)
      }
    } else {
      payload.append(entryId, value ?? "")
    }
  }

  const response =
    await fetch( config.responseUrl, { method: "POST", body: payload, headers: { "Content-Type": "application/x-www-form-urlencoded" }}
    )

  return { success: response.ok, status: response.status}
}