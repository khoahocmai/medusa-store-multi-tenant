/**
 * transaction-wrapper.ts
 *
 * Kept for explicit use in utility scripts (e.g. run-test.js DB setup) that
 * need to run a Knex transaction with RLS context.
 *
 * NOTE: This wrapper is NO LONGER called from patch-helper.ts.  RLS context
 * propagation to production routes happens via rls-pg-hook.ts (pg.Client-level
 * BEGIN interceptor).
 */

import { tenantContext } from "./tenant-context"

export async function withTenantTransactionKnex<T>(
  pgConnection: any,
  work: (trx: any) => Promise<T>
): Promise<T> {
  const ctx = tenantContext.getStore()

  return await pgConnection.transaction(async (trx: any) => {
    if (ctx) {
      const tenantId = ctx.accessMode === "platform" ? "" : (ctx.tenantId ?? "")
      const isPlatform = ctx.accessMode === "platform" ? "true" : "false"

      await trx.raw(
        `SELECT set_config('app.current_tenant_id', ?, true),
                set_config('app.is_platform_admin', ?, true)`,
        [tenantId, isPlatform]
      )
    } else {
      await trx.raw(
        `SELECT set_config('app.current_tenant_id', '', true),
                set_config('app.is_platform_admin', 'false', true)`
      )
    }

    return await work(trx)
  })
}
