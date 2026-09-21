import { Router, type NextFunction, type Request, type Response } from "express"
import { APPLICATION_STATUSES, type ApplicationStatus } from "../../shared/admin"
import {
  endSession,
  getSession,
  isAuthConfigured,
  loginThrottle,
  passwordMatches,
  requireAdmin,
  startSession,
} from "../lib/admin-auth"
import { approvalPdfFilename, buildApprovalPdf } from "../lib/approval-pdf"
import {
  AdminApiError,
  getApplication,
  isDemoMode,
  isSheetsConfigured,
  listApplications,
  setApplicationStatus,
} from "../lib/sheets"

const router = Router()

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown

/** Turns thrown AdminApiErrors into JSON responses and keeps unexpected errors from leaking details. */
const handle =
  (fn: Handler) =>
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res)
    } catch (error) {
      if (error instanceof AdminApiError) {
        return res.status(error.status).json({ error: error.message })
      }
      console.error("Admin request failed:", error)
      return res.status(500).json({ error: "Something went wrong on the server." })
    }
  }

function parseRow(req: Request): number {
  const row = Number(req.params.row)
  if (!Number.isInteger(row) || row < 2) throw new AdminApiError(400, "Invalid application.")
  return row
}

/* ------------------------------ session ------------------------------ */

// Non-secret setup state, so the sign-in screen can say what is missing.
router.get("/config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store")
  res.json({ authConfigured: isAuthConfigured(), sheetsConfigured: isSheetsConfigured(), demo: isDemoMode() })
})

router.get("/me", (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: "Not signed in." })
  res.json({ name: session.name })
})

router.post(
  "/login",
  handle((req, res) => {
    res.setHeader("Cache-Control", "no-store")

    if (!isAuthConfigured()) {
      return res.status(503).json({ error: "ADMIN_PASSWORD is not set on the server." })
    }

    const throttle = loginThrottle(req)
    if (throttle.blocked) {
      return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." })
    }

    const body = (req.body ?? {}) as { name?: unknown; password?: unknown }
    const name = typeof body.name === "string" ? body.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60) : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!name) return res.status(400).json({ error: "Enter your name so approvals can be attributed to you." })

    if (!passwordMatches(password)) {
      throttle.record(false)
      return res.status(401).json({ error: "That password is not right." })
    }

    throttle.record(true)
    startSession(res, name)
    return res.json({ name })
  })
)

router.post("/logout", (_req, res) => {
  endSession(res)
  res.json({ ok: true })
})

/* ---------------------------- applications ---------------------------- */

router.use(requireAdmin)

router.get(
  "/applications",
  handle(async (_req, res) => {
    res.json({ applications: await listApplications() })
  })
)

router.get(
  "/applications/:row",
  handle(async (req, res) => {
    res.json({ application: await getApplication(parseRow(req)) })
  })
)

router.post(
  "/applications/:row/status",
  handle(async (req, res) => {
    const row = parseRow(req)
    const body = (req.body ?? {}) as { status?: unknown; notes?: unknown; reference?: unknown }

    if (typeof body.status !== "string" || !APPLICATION_STATUSES.includes(body.status as ApplicationStatus)) {
      throw new AdminApiError(400, "Choose Approved, Rejected or Pending.")
    }
    const status = body.status as ApplicationStatus
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : ""
    const reference = typeof body.reference === "string" ? body.reference : ""

    if (status === "Rejected" && !notes) {
      throw new AdminApiError(400, "Add a short reason before rejecting an application.")
    }

    const application = await setApplicationStatus({
      row,
      reference,
      status,
      notes,
      reviewer: (res.locals.admin as { name: string }).name,
    })
    res.json({ application })
  })
)

router.get(
  "/applications/:row/pdf",
  handle(async (req, res) => {
    const application = await getApplication(parseRow(req))

    if (application.status !== "Approved") {
      throw new AdminApiError(409, "Approve this application before downloading its PDF.")
    }

    const pdf = await buildApprovalPdf(application)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${approvalPdfFilename(application)}"`)
    res.setHeader("Cache-Control", "no-store")
    res.end(Buffer.from(pdf))
  })
)

export default router
