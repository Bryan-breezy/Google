import "dotenv/config"

export type GoogleFormFieldName =
  | "referenceNumber"
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
  | "financeName"
  | "financePosition"
  | "financeEmail"
  | "financeMobile"
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
  | "salesPersonId"

export interface GoogleFormConfig { 
  responseUrl: string,  
  entries: Partial< Record<GoogleFormFieldName, string>>,
  fbzx?: string,
  pageHistory?: string
}

const FIELD_LABELS: Record<GoogleFormFieldName, string[]> = {
  referenceNumber: [
    "Reference Number",
    "Application Reference",
    "Application reference number",
  ],

  businessName: ["Business Name", "Business name"],
  kraPin: ["KRA PIN", "KRA Pin", "KRA PIN Number"],
  physicalAddress: ["Physical Address", "Physical address"],
  phone: ["Phone / mobile", "Phone Number"],
  email: ["Email", "Email Address"],
  permitNo: ["Business permit number", "Business Permit No", "Business Permit Number"],

  bizType: ["Business type", "Biz Type", "Type of Business"],
  bizTypeOther: [ "Other Business Type", "Business Type - Other", "Business type — if other"],

  dirName: [ "Director Name", "Director's Name", "Directors Name", "Director / owner full name"],
  dirId: [ "Director ID", "Director ID Number", "Director Identification Number", "Director / owner ID or passport"],
  dirEmail: [ "Director Email", "Director's Email", "Director Email Address", "Director / owner email"],
  dirMobile: [ "Director Mobile", "Director's Mobile", "Director Phone", "Director Phone Number", "Director / owner mobile"],

  cpName: [ "Contact Person Name", "Contact Person", "CP Name", "Primary contact full name"],
  cpPosition: [ "Contact Person Position", "Contact Person's Position", "CP Position", "Primary contact position"],
  cpEmail: [ "Contact Person Email", "Contact Person's Email", "CP Email", "Primary contact email"],
  cpMobile: [ "Contact Person Mobile", "Contact Person's Mobile", "Contact Person Phone", "CP Mobile", "Primary contact mobile"],

  financeName: [ "Accounts / Finance Contact Name", "Accounts Finance Contact Name", "Accounts Contact Name", "Finance Contact Name"],
  financePosition: [ "Accounts / Finance Contact Position", "Accounts Finance Contact Position", "Finance Contact Position"],
  financeEmail: [ "Accounts / Finance Contact Email", "Accounts Finance Contact Email", "Finance Contact Email"],
  financeMobile: [ "Accounts / Finance Contact Mobile", "Accounts Finance Contact Mobile", "Finance Contact Mobile", "Accounts Contact Phone"],

  ref1Company: [ "Reference 1 Company", "Reference 1 - Company", "Reference 1 Company Name", "Reference 1 — company"],
  ref1Contact: [ "Reference 1 Contact", "Reference 1 - Contact", "Reference 1 Contact Person", "Reference 1 — contact and phone"],
  ref1Email: ["Reference 1 Email", "Reference 1 - Email"],
  ref2Company: [ "Reference 2 Company", "Reference 2 - Company", "Reference 2 Company Name", "Reference 2 — company"],
  ref2Contact: [ "Reference 2 Contact", "Reference 2 - Contact", "Reference 2 Contact Person", "Reference 2 — contact and phone"],
  ref2Email: [ "Reference 2 Email", "Reference 2 - Email"],

  bankName: [ "Bank Name", "Bank" ],
  bankBranch: ["Bank Branch", "Branch"],

  acctName: [ "Account Name", "Bank Account Name"],
  acctNo: [ "Account Number", "Account No", "Bank Account Number"],

  paymentTerms: [ "Payment Terms", "Payment Term", "Requested payment terms"],

  documents: [ "Documents", "Supporting Documents", "Required Documents", "Documents available"],

  agreeCheck: [
    "Agreement",
    "I Agree",
    "Agree",
    "Declaration",
    "I confirm that the information provided is accurate and may be verified by Sassy Cosmetic & Beauty Products (K) Limited",
    "I confirm that the information provided is accurate and may be verified by Sassy Cosmetic & Beauty Products (K) Limited.",
  ],

  sigName: [
    "Signature Name",
    "Name of Signatory",
    "Signatory Name",
    "Authorised signatory full name",
    "Authorized signatory full name",
  ],

  sigDesignation: [
    "Signature Designation",
    "Signatory Designation",
    "Designation",
    "Designation ",
  ],

  salesPersonId: [
    "Salesperson-in-charge ID",
    "Salesperson in charge ID",
    "Sales Person in Charge ID",
    "Salesperson ID",
    "Sales Rep ID",
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

interface FormQuestionMetadata {
  title: string
  entryId: string 
}

// Dig through a Google Form's hidden data, 
// finds all the questions, 
// and pulls out their titles and ID numbers.
function extractQuestionMetadata(html: string): FormQuestionMetadata[] {
  const match = html.match(/var FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/s)
  if (!match) return []

  let data: unknown
  try { data = JSON.parse(match[1]) } 
  catch { return [] }

  const questions: FormQuestionMetadata[] = []

  const walk = (value: unknown): void => {
    if (!Array.isArray(value)) return

    if (
      value.length > 4 &&
      typeof value[0] === "number" &&
      typeof value[1] === "string"
    ) {
      const itemDetails = value[4]
      const firstAnswer = Array.isArray(itemDetails) && Array.isArray(itemDetails[0])
          ? itemDetails[0]
          : undefined
      const entryNumber = firstAnswer?.[0]

      if (typeof entryNumber === "number") {
        questions.push({
          title: value[1],
          entryId: `entry.${entryNumber}`,
        })
      }
    }

    value.forEach(walk)
  }

  walk(data)
  return questions
}

function extractEntryIds(html: string): string[] {
  const matches = html.match(/entry\.\d+/g) ?? []

  return Array.from(new Set(matches))
}

const REQUIRED_FORM_FIELDS: GoogleFormFieldName[] = [
  "referenceNumber",
  "businessName",
  "phone",
  "email",
  "agreeCheck",
  "sigName",
  "sigDesignation",
  "salesPersonId",
]

function findEntryId(html: string, fieldName: GoogleFormFieldName): string | undefined {
  const labels = FIELD_LABELS[fieldName].map(normalizeText)
  const metadata = extractQuestionMetadata(html)

  for (const question of metadata) {
    const title = normalizeText(question.title)
    if (labels.some((label) => title === label)) {
      return question.entryId
    }
  }

  // Fallback for older or non-standard Forms markup.
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

  const cacheHasRequiredFields = cachedConfig
    ? REQUIRED_FORM_FIELDS.every((fieldName) => cachedConfig?.entries[fieldName])
    : false

  if (cachedConfig && cacheHasRequiredFields && now - cacheTime < CACHE_DURATION) {
    return cachedConfig
  }

  const html = await fetchGoogleForm(formUrl)

  const entries: Partial<Record<GoogleFormFieldName, string>> = {}

  for (const fieldName of Object.keys(FIELD_LABELS) as GoogleFormFieldName[]) {
    const entryId = findEntryId(html, fieldName)

    if (entryId) { entries[fieldName] = entryId }
  }

  // Find the canonical form action URL from the HTML if possible.
  const actionMatch = html.match(/<form[^>]*action="([^"]*)"/)
  const responseUrl = actionMatch ? actionMatch[1] : formUrl.replace( /\/viewform.*$/, "/formResponse" )

  // Extract fbzx value
  const fbzxMatch = html.match(/name="fbzx"\s+value="([^"]*)"/)
  const fbzx = fbzxMatch ? fbzxMatch[1] : undefined

  // Google Forms expects the initial page marker even when the form has multiple pages.
  // Sending a synthetic list of page indexes causes later-page answers to be dropped.
  const pageHistory = "0"

  cachedConfig = { responseUrl, entries, fbzx, pageHistory }

  cacheTime = now

  console.log("Google Form fields detected:", entries)

  return cachedConfig
}

export async function submitToGoogleForm(data: Partial<Record<GoogleFormFieldName, string | string[]>>) {
  const config = await getGoogleFormConfig()
  const missingRequiredFields = REQUIRED_FORM_FIELDS.filter(
    (fieldName) => !config.entries[fieldName]
  )

  if (missingRequiredFields.length > 0) {
    console.error("Google Form is missing required fields:", missingRequiredFields)
    return { success: false, status: 422, missingRequiredFields }
  }

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

  // Add required hidden parameters for Google Forms flow validation
  payload.append("fvv", "1")
  if (config.pageHistory) {
    payload.append("pageHistory", config.pageHistory)
  }
  if (config.fbzx) {
    payload.append("fbzx", config.fbzx)
  }

  const response =
    await fetch( config.responseUrl, { method: "POST", body: payload, headers: { "Content-Type": "application/x-www-form-urlencoded" }}
    )

  return { success: response.ok, status: response.status}
}