import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, Download, Loader2, LogOut, RefreshCw, RotateCcw, Search, X } from "lucide-react"
import { toast } from "sonner"
import {
  APPLICATION_STATUSES,
  DETAIL_SECTIONS,
  nonEmptyGroups,
  statusSlug,
  visibleFields,
  type ApplicationDetail,
  type ApplicationStatus,
  type ApplicationSummary,
} from "@shared/admin"
import logo from "../assets/logo.webp"
import "../admin.css"

/* -------------------------------------------------------------------------- */
/*  API                                                                       */
/* -------------------------------------------------------------------------- */

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Something went wrong.")
  return data as T
}

interface ServerConfig {
  authConfigured: boolean
  sheetsConfigured: boolean
  demo: boolean
}

function toSummary(app: ApplicationDetail): ApplicationSummary {
  const { fields: _fields, notes: _notes, ...summary } = app
  return summary
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                              */
/* -------------------------------------------------------------------------- */

function StatusChip({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`adm-chip adm-chip-${statusSlug(status)}`}>
      <i aria-hidden="true" />
      {status}
    </span>
  )
}

function ConfirmDialog(props: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  tone: "approve" | "reject"
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (props.open && !dialog.open) dialog.showModal()
    if (!props.open && dialog.open) dialog.close()
  }, [props.open])

  return (
    <dialog
      ref={ref}
      className="adm-dialog"
      aria-labelledby="adm-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!props.busy) props.onCancel()
      }}
      onClick={(event) => {
        if (event.target === ref.current && !props.busy) props.onCancel()
      }}
    >
      <h2 id="adm-dialog-title">{props.title}</h2>
      <div className="adm-dialog-body">{props.children}</div>
      <div className="adm-dialog-actions">
        <button type="button" className="adm-btn adm-btn-quiet" onClick={props.onCancel} disabled={props.busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`adm-btn ${props.tone === "approve" ? "adm-btn-primary" : "adm-btn-danger-solid"}`}
          onClick={props.onConfirm}
          disabled={props.busy}
        >
          {props.busy && <Loader2 className="adm-spin" size={15} aria-hidden="true" />}
          {props.confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sign in                                                                   */
/* -------------------------------------------------------------------------- */

function SignIn({ onSignedIn }: { onSignedIn: (name: string) => void }) {
  const [name, setName] = useState(() => window.localStorage.getItem("sassy-admin-name") ?? "")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [config, setConfig] = useState<ServerConfig | null>(null)

  useEffect(() => {
    api<ServerConfig>("/config").then(setConfig).catch(() => setConfig(null))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const result = await api<{ name: string }>("/login", {
        method: "POST",
        body: JSON.stringify({ name, password }),
      })
      window.localStorage.setItem("sassy-admin-name", result.name)
      onSignedIn(result.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.")
      setBusy(false)
    }
  }

  return (
    <main className="adm-signin">
      <form className="adm-signin-card" onSubmit={submit}>
        <img src={logo} alt="Sassy Cosmetics" className="adm-signin-logo" />
        <h1>Admin desk</h1>
        <p className="adm-muted">Review customer registrations and download approval PDFs.</p>

        {config && !config.authConfigured && (
          <p className="adm-callout" role="status">
            Sign-in is switched off because <code>ADMIN_PASSWORD</code> is not set on the server.
          </p>
        )}
        {config?.demo && (
          <p className="adm-callout" role="status">
            Demo mode: you are looking at sample applications, not your Google Sheet.
          </p>
        )}

        <label className="adm-field">
          <span>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Shown as the approver"
            required
          />
        </label>
        <label className="adm-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}

        <button className="adm-btn adm-btn-primary adm-btn-block" disabled={busy || !name.trim() || !password}>
          {busy && <Loader2 className="adm-spin" size={15} aria-hidden="true" />}
          Sign in
        </button>
      </form>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  Application panel                                                         */
/* -------------------------------------------------------------------------- */

function ApplicationPanel(props: {
  row: number
  onClose: () => void
  onUpdated: (summary: ApplicationSummary) => void
  onExpired: () => void
}) {
  const { row, onClose, onUpdated, onExpired } = props
  const [app, setApp] = useState<ApplicationDetail | null>(null)
  const [loadError, setLoadError] = useState("")
  const [notes, setNotes] = useState("")
  const [notesError, setNotesError] = useState("")
  const [confirm, setConfirm] = useState<"Approved" | "Declined" | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [fresh, setFresh] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const fail = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) return onExpired()
      toast.error(err instanceof Error ? err.message : fallback)
    },
    [onExpired]
  )

  useEffect(() => {
    let cancelled = false
    setApp(null)
    setLoadError("")
    setNotesError("")
    api<{ application: ApplicationDetail }>(`/applications/${row}`)
      .then(({ application }) => {
        if (cancelled) return
        setApp(application)
        setNotes(application.notes)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) return onExpired()
        setLoadError(err instanceof Error ? err.message : "Could not load this application.")
      })
    return () => {
      cancelled = true
    }
  }, [row, onExpired])

  async function changeStatus(status: ApplicationStatus, successMessage: string) {
    if (!app) return
    setBusy(true)
    try {
      const { application, driveCopy, warning } = await api<{
        application: ApplicationDetail
        driveCopy?: { url: string; name: string }
        warning?: string
      }>(`/applications/${row}/status`, {
        method: "POST",
        body: JSON.stringify({ status, notes, reference: app.reference }),
      })
      const becameApproved = status === "Approved" && app.status !== "Approved"
      setApp(application)
      setNotes(application.notes)
      onUpdated(toSummary(application))
      if (driveCopy) {
        toast.success("Approved. A copy was saved to Drive.", {
          action: { label: "Open", onClick: () => window.open(driveCopy.url, "_blank", "noopener") },
        })
      } else if (warning) {
        toast.warning(warning, { duration: 9000 })
      } else {
        toast.success(successMessage)
      }
      if (becameApproved) {
        setFresh(true)
        window.setTimeout(() => setFresh(false), 1200)
      }
    } catch (err) {
      fail(err, "Could not update the application.")
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  function askDecline() {
    if (!notes.trim()) {
      setNotesError("Add a short reason before declining.")
      notesRef.current?.focus()
      return
    }
    setNotesError("")
    setConfirm("Declined")
  }

  async function downloadPdf() {
    if (!app) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/admin/applications/${row}/pdf`, { credentials: "same-origin" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new ApiError(res.status, (data as { error?: string }).error ?? "Could not create the PDF.")
      }
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "approval.pdf"
      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (err) {
      fail(err, "Could not create the PDF.")
    } finally {
      setDownloading(false)
    }
  }

  if (loadError) {
    return (
      <div className="adm-panel-state">
        <button className="adm-back" onClick={onClose}>
          <ArrowLeft size={16} aria-hidden="true" /> All applications
        </button>
        <p className="adm-error" role="alert">
          {loadError}
        </p>
      </div>
    )
  }

  if (!app) {
    return (
      <div className="adm-panel-state" aria-busy="true">
        <button className="adm-back" onClick={onClose}>
          <ArrowLeft size={16} aria-hidden="true" /> All applications
        </button>
        <p className="adm-muted">
          <Loader2 className="adm-spin" size={15} aria-hidden="true" /> Loading application…
        </p>
      </div>
    )
  }

  const dirty = notes.trim() !== app.notes
  const approved = app.status === "Approved"

  return (
    <div className="adm-panel">
      <button className="adm-back" onClick={onClose}>
        <ArrowLeft size={16} aria-hidden="true" /> All applications
      </button>

      <header className="adm-panel-head">
        <div className="adm-panel-title">
          <h2>{app.businessName || "Unnamed business"}</h2>
          <p className="adm-ref">{app.reference || `Sheet row ${app.row}`}</p>
          <p className="adm-muted adm-small">Submitted {app.submittedAt || "at an unknown time"}</p>
          {app.reviewedBy && (
            <p className="adm-muted adm-small">
              {app.status} by {app.reviewedBy}
              {app.reviewedAt && ` on ${app.reviewedAt}`}
            </p>
          )}
        </div>
        <span className={`adm-stamp adm-stamp-${statusSlug(app.status)} ${fresh ? "adm-stamp-fresh" : ""}`}>
          {app.status}
        </span>
      </header>

      {approved && (
        <div className="adm-pdf-bar">
          <div>
            <strong>Approval PDF is ready</strong>
            <span className="adm-muted adm-small">Includes the customer details and your review notes.</span>
          </div>
          <button className="adm-btn adm-btn-brass" onClick={downloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="adm-spin" size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
            Download PDF
          </button>
        </div>
      )}

      <section className="adm-review" aria-label="Review">
        <label className={`adm-field ${notesError ? "adm-field-error" : ""}`}>
          <span>Review notes</span>
          <textarea
            ref={notesRef}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              if (notesError) setNotesError("")
            }}
            rows={3}
            maxLength={2000}
            placeholder="What you checked, credit limit, conditions. Saved to the sheet and printed on the PDF."
          />
          {notesError && (
            <span className="adm-error" role="alert">
              {notesError}
            </span>
          )}
        </label>

        <div className="adm-actions">
          {app.status !== "Approved" && (
            <button className="adm-btn adm-btn-primary" onClick={() => setConfirm("Approved")} disabled={busy}>
              <Check size={16} aria-hidden="true" /> Approve
            </button>
          )}
          {app.status !== "Declined" && (
            <button className="adm-btn adm-btn-danger" onClick={askDecline} disabled={busy}>
              <X size={16} aria-hidden="true" /> Decline
            </button>
          )}
          <label className="adm-move">
            <span className="adm-sr">Move to another status</span>
            <select
              value=""
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value as ApplicationStatus
                if (next) changeStatus(next, `Moved to ${next}`)
              }}
            >
              <option value="">Set status…</option>
              {OTHER_STATUSES.filter((status) => status !== app.status).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          {dirty && (
            <button
              className="adm-btn adm-btn-outline"
              onClick={() => changeStatus(app.status, "Notes saved")}
              disabled={busy}
            >
              {busy && !confirm ? <Loader2 className="adm-spin" size={15} aria-hidden="true" /> : null}
              Save notes
            </button>
          )}
        </div>
      </section>

      <div className="adm-sections">
        {DETAIL_SECTIONS.map((section) => {
          const groups = nonEmptyGroups(section, app.fields)
          if (groups.length === 0) return null
          return (
            <section key={section.id} className="adm-section">
              <h3>{section.title}</h3>
              {groups.map((group, index) => (
                <div key={group.title ?? index} className="adm-group">
                  {group.title && <h4>{group.title}</h4>}
                  <dl>
                    {visibleFields(group, app.fields).map((field) => {
                      const value = app.fields[field.key] ?? ""
                      return (
                        <div key={field.key} className="adm-row">
                          <dt>{field.label}</dt>
                          <dd className={value ? "" : "adm-empty"}>{value || "Not provided"}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
              ))}
            </section>
          )
        })}
      </div>

      <ConfirmDialog
        open={confirm === "Approved"}
        title={`Approve ${app.businessName || "this application"}?`}
        confirmLabel="Approve"
        tone="approve"
        busy={busy}
        onConfirm={() => changeStatus("Approved", "Approved. The PDF is ready to download.")}
        onCancel={() => setConfirm(null)}
      >
        <p>
          This marks the application as approved in the Google Sheet under <strong>your name</strong> and makes
          the approval PDF available.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === "Declined"}
        title={`Decline ${app.businessName || "this application"}?`}
        confirmLabel="Decline"
        tone="reject"
        busy={busy}
        onConfirm={() => changeStatus("Declined", "Application declined")}
        onCancel={() => setConfirm(null)}
      >
        <p>The reason below is saved to the sheet. You can change the status again later.</p>
        <blockquote>{notes.trim()}</blockquote>
      </ConfirmDialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Desk (list + panel)                                                       */
/* -------------------------------------------------------------------------- */

type Filter = ApplicationStatus | "All"
const FILTERS: Filter[] = [...APPLICATION_STATUSES, "All"]
/** Statuses reachable from the "Set status" menu; Approve and Decline have their own buttons. */
const OTHER_STATUSES: ApplicationStatus[] = ["New", "In review", "Follow-up"]

function Desk({ name, onSignedOut }: { name: string; onSignedOut: (message?: string) => void }) {
  const [applications, setApplications] = useState<ApplicationSummary[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)
  const [filter, setFilter] = useState<Filter>("New")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<number | null>(null)

  const expired = useCallback(() => onSignedOut("Your session ended. Sign in again."), [onSignedOut])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const { applications } = await api<{ applications: ApplicationSummary[] }>("/applications")
      setApplications(applications)
      setLoadError("")
      setSyncedAt(new Date())
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return expired()
      setLoadError(err instanceof Error ? err.message : "Could not load applications.")
    } finally {
      setRefreshing(false)
    }
  }, [expired])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const result = Object.fromEntries([...FILTERS].map((item) => [item, 0])) as Record<Filter, number>
    for (const app of applications ?? []) {
      result[app.status] += 1
      result.All += 1
    }
    return result
  }, [applications])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (applications ?? []).filter((app) => {
      if (filter !== "All" && app.status !== filter) return false
      if (!needle) return true
      return [app.businessName, app.kraPin, app.phone, app.email, app.reference].some((value) =>
        value.toLowerCase().includes(needle)
      )
    })
  }, [applications, filter, query])

  const handleUpdated = useCallback((summary: ApplicationSummary) => {
    setApplications((current) => current?.map((app) => (app.row === summary.row ? summary : app)) ?? current)
  }, [])

  async function signOut() {
    await api("/logout", { method: "POST" }).catch(() => undefined)
    onSignedOut()
  }

  return (
    <div className="adm-shell">
      <header className="adm-header">
        <div className="adm-brand">
          <img src={logo} alt="Sassy Cosmetics" />
          <span>Admin desk</span>
        </div>
        <div className="adm-user">
          <span>{name}</span>
          <button className="adm-btn adm-btn-quiet" onClick={signOut}>
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      </header>

      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-tabs" role="group" aria-label="Filter by status">
            {FILTERS.map((item) => (
              <button
                key={item}
                className="adm-tab"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
                <b>{counts[item]}</b>
              </button>
            ))}
          </div>

          <div className="adm-toolbar-right">
            <label className="adm-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Business, KRA PIN, phone, reference"
                aria-label="Search applications"
              />
            </label>
            <button className="adm-btn adm-btn-outline" onClick={load} disabled={refreshing} title="Reload from the sheet">
              <RefreshCw size={15} className={refreshing ? "adm-spin" : ""} aria-hidden="true" />
              {syncedAt ? `Synced ${syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Refresh"}
            </button>
          </div>
        </div>

        <div className="adm-body" data-open={selected !== null}>
          <section className="adm-list" aria-label="Applications">
            {loadError ? (
              <div className="adm-list-state">
                <p className="adm-error" role="alert">
                  {loadError}
                </p>
                <button className="adm-btn adm-btn-outline" onClick={load}>
                  Try again
                </button>
              </div>
            ) : applications === null ? (
              <div className="adm-list-state adm-muted" aria-busy="true">
                <Loader2 className="adm-spin" size={16} aria-hidden="true" /> Loading applications…
              </div>
            ) : visible.length === 0 ? (
              <div className="adm-list-state">
                <strong>
                  {query
                    ? "No applications match that search."
                    : filter === "New"
                      ? "No new applications."
                      : filter === "All"
                        ? "No applications yet."
                        : `Nothing is marked ${filter} right now.`}
                </strong>
                <span className="adm-muted adm-small">
                  {query ? "Try a KRA PIN, phone number or part of the business name." : "New form submissions appear here as soon as they reach the sheet."}
                </span>
              </div>
            ) : (
              <ul>
                {visible.map((app) => (
                  <li key={app.row}>
                    <button
                      className="adm-item"
                      aria-current={selected === app.row}
                      onClick={() => setSelected(app.row)}
                    >
                      <span className="adm-item-main">
                        <strong>{app.businessName || "Unnamed business"}</strong>
                        <span className="adm-item-meta">
                          <span>{app.kraPin || "No KRA PIN"}</span>
                          <span>{app.phone}</span>
                        </span>
                      </span>
                      <span className="adm-item-side">
                        <StatusChip status={app.status} />
                        <small>{app.submittedAt.split(" ")[0]}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="adm-detail" aria-label="Application details">
            {selected === null ? (
              <div className="adm-detail-empty">
                <strong>Select an application</strong>
                <span className="adm-muted">
                  Read the customer's answers, approve or reject, and download the approval PDF once it is approved.
                </span>
              </div>
            ) : (
              <ApplicationPanel
                key={selected}
                row={selected}
                onClose={() => setSelected(null)}
                onUpdated={handleUpdated}
                onExpired={expired}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function Admin() {
  const [session, setSession] = useState<{ name: string } | null | undefined>(undefined)

  // Keep the admin desk out of search results.
  useEffect(() => {
    const previousTitle = document.title
    const meta = document.createElement("meta")
    meta.name = "robots"
    meta.content = "noindex, nofollow"
    document.head.appendChild(meta)
    document.title = "Sassy admin desk"
    return () => {
      document.title = previousTitle
      meta.remove()
    }
  }, [])

  useEffect(() => {
    api<{ name: string }>("/me")
      .then(setSession)
      .catch(() => setSession(null))
  }, [])

  const signedOut = useCallback((message?: string) => {
    setSession(null)
    if (message) toast.error(message)
  }, [])

  if (session === undefined) {
    return (
      <main className="adm-signin">
        <p className="adm-muted" aria-busy="true">
          <Loader2 className="adm-spin" size={16} aria-hidden="true" /> Loading…
        </p>
      </main>
    )
  }

  return session ? <Desk name={session.name} onSignedOut={signedOut} /> : <SignIn onSignedIn={(name) => setSession({ name })} />
}
