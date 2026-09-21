// Serverless entry for Vercel.
// The Express app is bundled to dist/index.js by the esbuild step in `pnpm build`.
// That file has no declaration file, so we intentionally import it as any.

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment
// @ts-expect-error -- dist/index.js is produced by esbuild without type declarations
import app from "../dist/index.js"

export default app
