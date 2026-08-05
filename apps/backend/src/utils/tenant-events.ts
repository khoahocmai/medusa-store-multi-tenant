import { emitEventStep } from "@medusajs/medusa/core-flows"
import { SubscriberArgs } from "@medusajs/framework"
import { tenantContext } from "./tenant-context"

/**
 * Wrapper for emitEventStep to inject the current tenantId into the event data.
 * Use this in workflows instead of the default emitEventStep.
 */
export const emitTenantEventStep = (input: { eventName: string, data: any, options?: Record<string, any> }) => {
  const ctx = tenantContext.getStore()
  
  // Inject tenantId if available
  if (ctx && ctx.tenantId) {
    input.data = {
      ...input.data,
      _tenant_id: ctx.tenantId,
    }
  }
  
  return emitEventStep(input)
}

/**
 * Higher-Order Function to wrap subscriber handlers.
 * Extracts the `_tenant_id` from the event data and restores the AsyncLocalStorage context.
 * This ensures the Database RLS hooks continue to work inside background jobs.
 */
export function withTenantContext<T extends { _tenant_id?: string }>(
  handler: (args: SubscriberArgs<T>) => Promise<void>
) {
  return async (args: SubscriberArgs<T>) => {
    const tenantId = args.event.data._tenant_id

    if (tenantId) {
      // Restore the context for the subscriber execution
      return tenantContext.run({ tenantId, accessMode: "tenant" }, async () => {
        return await handler(args)
      })
    }
    
    // Fallback if no tenant context was passed (e.g., platform-level events)
    return await handler(args)
  }
}
