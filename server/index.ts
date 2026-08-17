import dotenv from "dotenv"
import express, { Request, Response } from "express"
import cors from "cors"
import path from "node:path"

dotenv.config()
dotenv.config({ path: path.resolve(process.cwd(), "server/.env") })

import { getGoogleFormConfig, submitToGoogleForm } from "./lib/google-forms"

const app = express()

app.use(cors())
app.use(express.json())

interface SubmitRegistrationBody {
  values?: Record<string, string>
  selectedDocs?: string[]
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const KRA_PIN_PATTERN = /^[A-Z]\d{9}[A-Z]$/i
const optionalEmailFields = ["dirEmail", "cpEmail", "financeEmail", "ref1Email", "ref2Email"] as const

const documentLabels: Record<string, string> = {
  id: "Director / owner ID",
  permit: "Business permit",
  kra: "KRA PIN certificate",
  cert: "Business registration certificate",
}

async function isConfigured(): Promise<boolean> {
  try {
    const config = await getGoogleFormConfig()

    return Boolean(config.responseUrl) &&  Object.keys(config.entries).length > 0
  } catch (error) {
    console.error( "Unable to read Google Form configuration:", error)
    return false
  }
}

app.get("/api/config",
  async (_req: Request, res: Response) => {
    const configured = await isConfigured()
    res.json({
      configured,
    })
  }
)

/**
 * Submit wholesale/business registration.
 */
app.post(
  "/api/submit-registration",
  async (
    req: Request<{}, {}, SubmitRegistrationBody>,
    res: Response
  ) => {
    try {
      const configured = await isConfigured()

      if (!configured) {
        return res.status(503).json({
          error: "Google Forms is not connected on the server.",
        })
      }

      const { values = {},selectedDocs = [] } = req.body || {}

      const requiredOk = Boolean(
        values.businessName?.trim() &&
          values.phone?.trim() &&
          values.email?.trim() &&
          EMAIL_PATTERN.test(values.email.trim()) &&
          values.agreeCheck === "yes" &&
          values.sigName?.trim() &&
          values.salesPersonId?.trim()
      )

      if (!requiredOk) {
        return res.status(400).json({
          error: "Missing or invalid required fields.",
        })
      }

      // KRA PIN format validation
      if (values.kraPin?.trim() && !KRA_PIN_PATTERN.test(values.kraPin.trim())) {
        return res.status(400).json({
          error: "Invalid KRA PIN format. It must start with a letter, followed by 9 digits, and end with a letter.",
        })
      }

      for (const fieldName of optionalEmailFields) {
        const email = values[fieldName]?.trim()
        if (email && !EMAIL_PATTERN.test(email)) {
          return res.status(400).json({
            error: `Invalid email address in ${fieldName}.`,
          })
        }
      }

      // Document match validation
      if (values.kraPin?.trim() && !selectedDocs.includes("kra")) {
        return res.status(400).json({
          error: "Document match error: You provided a KRA PIN but did not select the KRA PIN Certificate checklist item.",
        })
      }
      if (values.permitNo?.trim() && !selectedDocs.includes("permit")) {
        return res.status(400).json({
          error: "Document match error: You provided a Business Permit Number but did not select the Business Permit checklist item.",
        })
      }
      if (values.dirId?.trim() && !selectedDocs.includes("id")) {
        return res.status(400).json({
          error: "Document match error: You provided a Director ID/Passport number but did not select the Copy of ID/Passport checklist item.",
        })
      }

      const formData: Record< string, string | string[]> = {
        businessName: values.businessName || "",
        kraPin: values.kraPin || "",
        physicalAddress: values.physicalAddress || "",
        phone: values.phone || "",
        email: values.email || "",
        permitNo: values.permitNo || "",
        bizType:
          values.bizType === "Other"
            ? values.bizTypeOther || "Other"
            : values.bizType || "",
        bizTypeOther: values.bizTypeOther || "",
        dirName: values.dirName || "",
        dirId: values.dirId || "",
        dirEmail: values.dirEmail || "",
        dirMobile: values.dirMobile || "",
        cpName: values.cpName || "",
        cpPosition: values.cpPosition || "",
        cpEmail: values.cpEmail || "",
        cpMobile: values.cpMobile || "",
        financeName: values.financeName || "",
        financePosition: values.financePosition || "",
        financeEmail: values.financeEmail || "",
        financeMobile: values.financeMobile || "",
        ref1Company: values.ref1Company || "",
        ref1Contact: values.ref1Contact || "",
        ref1Email: values.ref1Email || "",
        ref2Company: values.ref2Company || "",
        ref2Contact: values.ref2Contact || "",
        ref2Email: values.ref2Email || "",
        bankName: values.bankName || "",
        bankBranch: values.bankBranch || "",
        acctName: values.acctName || "",
        acctNo: values.acctNo || "",
        paymentTerms: values.paymentTerms || "",
        documents: selectedDocs.map(
          (documentId) =>
            documentLabels[documentId] ??
            documentId
        ),
        agreeCheck:
          values.agreeCheck === "yes"
            ? "Yes, I confirm"
            : "",
        sigName: values.sigName || "",
        sigDesignation: values.sigDesignation || "",
        salesPersonId: values.salesPersonId || "",
      }

      /**
       * Submit to the live Google Form.
       *
       * submitToGoogleForm() takes care of:
       *
       * logical field name
       *        ↓
       * live Google entry ID
       *        ↓
       * Google Forms
       */
      const result = await submitToGoogleForm(formData)

      if (!result.success) {
        return res.status(502).json({
          error: "Google Forms rejected the submission.",
        })
      }

      /**
       * Generate application reference.
       */
      const cleanBusinessName = (values.businessName || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
          
    const cleanKraPin = (values.kraPin || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()

    const cleanMobile = (values.phone || "").replace(/\D/g, "")

    const reference = `SASSY-${new Date().getFullYear()}-${cleanKraPin}-${cleanBusinessName}-${cleanMobile}`

      return res.json({ success: true, reference,})
    } catch (error) {
      console.error(
        "Google Forms submission failed:",
        error
      )

      return res.status(502).json({error: "Could not reach Google Forms.",})
    }
  }
)

// In production, serve the Vite build from the same process as the API.
// In development, Vite serves the client and proxies /api to this server.
const publicDir = path.resolve(process.cwd(), "dist/public")
app.use(express.static(publicDir))
app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"))
})

const PORT = process.env.PORT || 8787

app.listen(PORT, () => {
  console.log(`Registration API server running on http://localhost:${PORT}`)
})