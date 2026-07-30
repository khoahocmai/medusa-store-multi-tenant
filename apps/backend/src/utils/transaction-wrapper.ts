import { EntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { tenantContext } from "./tenant-context"

/**
 * Wraps a database operation in a transaction and applies the current tenant context
 * to the PostgreSQL session transaction-locally.
 *
 * @param manager The base EntityManager (usually from `sharedContext.transactionManager`)
 * @param work The function to execute inside the transaction
 */
export async function withTenantTransaction<T>(
  manager: EntityManager,
  work: (txManager: EntityManager) => Promise<T>
): Promise<T> {
  const ctx = tenantContext.getStore()

  return await manager.transactional(async (txManager) => {
    // If no context exists, we let RLS fail closed naturally.
    if (ctx) {
      const tenantId = ctx.accessMode === "platform" ? "" : ctx.tenantId
      const isPlatform = ctx.accessMode === "platform" ? "true" : "false"

      // Use transaction-local config (is_local = true)
      await txManager.execute(
        `SELECT set_config('app.current_tenant_id', ?, true),
                set_config('app.is_platform_admin', ?, true)`,
        [tenantId, isPlatform]
      )
    } else {
      // Ensure we clear it just in case, though is_local=true should prevent leak
      await txManager.execute(
        `SELECT set_config('app.current_tenant_id', '', true),
                set_config('app.is_platform_admin', 'false', true)`
      )
    }

    return await work(txManager)
  })
}
