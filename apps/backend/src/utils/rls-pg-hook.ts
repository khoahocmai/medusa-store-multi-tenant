/**
 * RLS pg-level hook: intercepts every PostgreSQL `BEGIN` at the pg.Client level
 * and immediately injects `SET LOCAL app.current_tenant_id / app.is_platform_admin`
 * into the new transaction, reading the current value from AsyncLocalStorage.
 *
 * This is the correct interception point because:
 * - ALL database drivers (Knex AND MikroORM) ultimately use pg.Client
 * - `SET LOCAL` applies exactly to the surrounding transaction
 * - ALS context is preserved across Node.js async boundaries
 *
 * Called once at server startup. Safe to call multiple times (idempotent guard).
 */

import { tenantContext } from "./tenant-context"

let _installed = false

export function installRlsPgHook(): void {
  if (_installed) return
  _installed = true

  // require() used to avoid ESM/CJS interop issues at import time.
  // The pg module is a CommonJS module and require() is the correct way to load it.
  // biome-ignore lint: intentional require
  const pg = require("pg") as { Client: { prototype: { query: (...args: any[]) => any } } }

  const originalQuery = pg.Client.prototype.query as (...args: any[]) => any

  pg.Client.prototype.query = function patchedQuery(
    this: any,
    configOrText: any,
    ...rest: any[]
  ) {
    // Determine the SQL text being executed
    const sqlText: string =
      typeof configOrText === "string"
        ? configOrText
        : (configOrText?.text ?? "")

    const isTxBegin = /^\s*BEGIN\b/i.test(sqlText)

    if (!isTxBegin) {
      return originalQuery.call(this, configOrText, ...rest)
    }

    // It's a BEGIN — chain a SET LOCAL immediately after
    const ctx = tenantContext.getStore()

    const beginResult = originalQuery.call(this, configOrText, ...rest)

    if (!ctx) {
      // No ALS context — clear the settings so they don't bleed from a previous
      // request that used the same connection (connection pool reuse).
      return Promise.resolve(beginResult).then((r) => {
        return originalQuery
          .call(
            this,
            "SELECT set_config('app.current_tenant_id', '', true), " +
              "set_config('app.is_platform_admin', 'false', true)"
          )
          .then(() => r)
          .catch(() => r) // Best-effort — never break the BEGIN
      })
    }

    const tenantId =
      ctx.accessMode === "platform" ? "" : (ctx.tenantId ?? "")
    const isPlatform = ctx.accessMode === "platform" ? "true" : "false"

    return Promise.resolve(beginResult).then((r) => {
      return originalQuery
        .call(
          this,
          {
            text: "SELECT set_config($1, $2, true), set_config($3, $4, true)",
            values: [
              "app.current_tenant_id",
              tenantId,
              "app.is_platform_admin",
              isPlatform,
            ],
          }
        )
        .then(() => r)
        .catch(() => r) // Best-effort — never fail the BEGIN itself
    })
  }
}
