/**
 * Flatten the TanStack Start client build into `dist/` while preserving
 * the server build under `.vite-out/server/` for Railway deployment.
 *
 * TanStack Start's `vite build` (configured with `build.outDir: '.vite-out'`)
 * emits:
 *   .vite-out/client/   <- prerendered HTML + client assets
 *   .vite-out/server/   <- TanStack Start server entry
 *
 * The client output is copied into `dist/` for static assets and prerendered
 * HTML. The server output remains in `.vite-out/server/` so Railway can run
 * the application server and provide server-side access to PostgreSQL.
 *
 * Why build into `.vite-out` instead of `dist/` directly: older sandboxes may
 * contain a read-only `_redirects` file. Start's client build tries to empty
 * its output directory first, which can cause EACCES errors. Building into a
 * clean temporary directory avoids that problem.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const SRC = '.vite-out/client'
const DEST = 'dist'

if (!existsSync(SRC)) {
  console.error(`[finalize] build output missing: ${SRC} — did "vite build" run?`)
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })

for (const entry of readdirSync(SRC)) {
  try {
    cpSync(join(SRC, entry), join(DEST, entry), { recursive: true, force: true })
  } catch (e) {
    // ONLY `_redirects` may be skipped, and only because sandboxes created before the platform
    // stopped injecting it still carry a read-only copy owned by another user that cannot be
    // overwritten. The file is inert either way — nothing executes it. ANY other failed entry
    // (assets/, index.html, route html) would leave dist/index.html pointing at missing or stale
    // hashed assets — a silently broken deployment. Fail the build instead.
    // Remove this branch once no live sandbox predates the injector's removal.
    if (entry === '_redirects') {
      console.warn(`[finalize] skip ${entry}: ${e.code || e.message} (legacy read-only copy; the file is not executed)`)
    } else {
      console.error(`[finalize] FAILED copying ${entry} into dist/: ${e.code || e.message} — aborting (a partial dist/ deploys broken)`)
      process.exit(1)
    }
  }
}

if (!existsSync(join(DEST, 'index.html'))) {
  console.error('[finalize] dist/index.html missing after flatten — build is not publishable')
  process.exit(1)
}

console.log('[finalize] ✓ static build flattened to dist/ (dist/index.html ready)')
