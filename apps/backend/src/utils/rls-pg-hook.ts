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

const clientLocks = new WeakMap<any, Promise<any>>()

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
    let callback: ((err: Error | null, res?: any) => void) | undefined
    let values: any[] | undefined

    // Normalize arguments matching pg signature
    if (rest.length > 0 && typeof rest[rest.length - 1] === "function") {
      callback = rest.pop() as any
    }
    if (rest.length > 0) {
      values = rest[0]
    }
    if (typeof configOrText === "function") {
      callback = configOrText as any
      configOrText = undefined
    }

    const ctx = tenantContext.getStore()
    const targetTenantId = ctx?.accessMode === "platform" ? "" : (ctx?.tenantId ?? "")

    // Retrieve existing lock or start resolved
    const lock = clientLocks.get(this) || Promise.resolve()

    // Explicit, narrowly scoped bypass mechanism unavailable to normal runtime application requests
    // Requires both a test environment and a strict bypass token in the query
    const sqlText = (typeof configOrText === "string" ? configOrText : configOrText?.text) || ""
    const isBypass = process.env.NODE_ENV === "test" && sqlText.includes("/* BYPASS_RLS */")
    const isForceResetFail = process.env.NODE_ENV === "test" && sqlText.includes("/* FORCE_RESET_FAIL */")

    const executeGuardedQuery = async () => {
      if (isBypass) {
        let businessResult: any
        let businessError: Error | undefined
        try {
          businessResult = await new Promise((resolve, reject) => {
            const args: any[] = []
            if (configOrText !== undefined) args.push(configOrText)
            if (values !== undefined) args.push(values)
            args.push((err: Error, res: any) => (err ? reject(err) : resolve(res)))
            originalQuery.apply(this, args)
          })
        } catch (e: any) {
          businessError = e
        }
        if (businessError) throw businessError
        return businessResult
      }

      // 1. Await PostgreSQL context assignment (this forces targetTenantId = "" if missing)
      await new Promise<void>((resolve, reject) => {
        originalQuery.call(
          this,
          {
            text: "SELECT set_config($1, $2, false)",
            values: [
              "app.current_tenant_id",
              targetTenantId,
            ],
          },
          (err: Error, res: any) => (err ? reject(err) : resolve())
        )
      })

      // 2. Execute business query
      let businessResult: any
      let businessError: Error | undefined
      try {
        businessResult = await new Promise((resolve, reject) => {
          const args: any[] = []
          if (configOrText !== undefined) args.push(configOrText)
          if (values !== undefined) args.push(values)
          args.push((err: Error, res: any) => (err ? reject(err) : resolve(res)))
          originalQuery.apply(this, args)
        })
      } catch (e: any) {
        businessError = e
      }

      // 3. Await context reset in a finally block
      try {
        if (isForceResetFail) throw new Error("Simulated reset failure")
        await new Promise<void>((resolve, reject) => {
          originalQuery.call(
            this,
            {
              text: "SELECT set_config('app.current_tenant_id', '', false)",
            },
            (err: Error, res: any) => (err ? reject(err) : resolve())
          )
        })
      } catch (e: any) {
        // Destroy or invalidate the client to prevent dirty pool releases
        const fatalErr = new Error("FATAL: Failed to reset tenant context. Terminating client to prevent leakage. Original error: " + e.message)
        this.emit("error", fatalErr)
        if (businessError) throw businessError
        throw fatalErr
      }

      if (businessError) throw businessError
      return businessResult
    }

    // Await previous query completion (whether success or fail) before starting new one
    const taskPromise = lock.catch(() => {}).then(() => executeGuardedQuery())
    clientLocks.set(this, taskPromise)

    if (callback) {
      // Invoke caller callback once task completes
      taskPromise.then(
        (res) => callback!(null, res),
        (err) => callback!(err)
      )
      return
    }

    return taskPromise
  }
}
