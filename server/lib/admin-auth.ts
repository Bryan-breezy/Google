import "dotenv/config"
import crypto from "node:crypto"
import type { NextFunction, Request, Response } from "express"

const COOKIE_NAME = "sassy_admin"
const SESSION_HOURS = 12
const MAX_ATTEMPTS = 8
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

export interface AdminSession {
  name: string
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD)
}

function sessionSecret(): string {
  // ADMIN_SESSION_SECRET is preferred. Without it the secret is derived from the
  // password, so changing the password also signs everyone out.
  return (
    process.env.ADMIN_SESSION_SECRET ||
    crypto.createHash("sha256").update(`sassy-admin:${process.env.ADMIN_PASSWORD ?? ""}`).digest("hex")
  )
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url")
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest()
  const hb = crypto.createHash("sha256").update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

export function passwordMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  return safeEqual(candidate, expected)
}

function createToken(name: string): string {
  const payload = Buffer.from(JSON.stringify({ n: name, exp: Date.now() + SESSION_HOURS * 3600 * 1000 })).toString(
    "base64url"
  )
  return `${payload}.${sign(payload)}`
}

function readToken(token: string | undefined): AdminSession | null {
  if (!token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null
  if (!safeEqual(signature, sign(payload))) return null

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { n?: string; exp?: number }
    if (!data.n || typeof data.exp !== "number" || data.exp < Date.now()) return null
    return { name: data.n }
  } catch {
    return null
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(";")) {
    const index = part.indexOf("=")
    if (index === -1) continue
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim())
  }
  return undefined
}

export function startSession(res: Response, name: string) {
  res.cookie(COOKIE_NAME, createToken(name), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_HOURS * 3600 * 1000,
    path: "/",
  })
}

export function endSession(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" })
}

export function getSession(req: Request): AdminSession | null {
  if (!isAuthConfigured()) return null
  return readToken(readCookie(req, COOKIE_NAME))
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store")

  if (!isAuthConfigured()) {
    return res.status(503).json({ error: "ADMIN_PASSWORD is not set on the server." })
  }
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: "Sign in to continue." })

  res.locals.admin = session
  next()
}

/* Best-effort login throttle. In-memory, so on serverless hosts it limits per warm instance. */
const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"]
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
  return first || req.socket.remoteAddress || "unknown"
}

export function loginThrottle(req: Request): { blocked: boolean; record: (ok: boolean) => void } {
  const key = clientKey(req)
  const now = Date.now()
  const entry = attempts.get(key)
  const active = entry && entry.resetAt > now ? entry : undefined

  return {
    blocked: Boolean(active && active.count >= MAX_ATTEMPTS),
    record(ok: boolean) {
      if (ok) {
        attempts.delete(key)
        return
      }
      if (active) active.count += 1
      else attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS })
    },
  }
}
