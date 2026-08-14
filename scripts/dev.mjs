import { spawn } from "node:child_process"

const processes = [
  spawn("pnpm", ["exec", "vite", "--host"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
  spawn("pnpm", ["exec", "tsx", "server/index.ts"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
]

const stop = () => {
  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM")
  }
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)

for (const child of processes) {
  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      console.error(`Development process exited with code ${code}`)
    }
    if (signal) {
      console.error(`Development process stopped by ${signal}`)
    }
  })
}
