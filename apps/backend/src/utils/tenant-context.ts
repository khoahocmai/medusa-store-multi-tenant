import { AsyncLocalStorage } from "async_hooks"

export type TenantContext = {
  tenantId?: string | null
  actorId?: string
  storeIds?: string[]
  accessMode: "tenant" | "platform" | "platform_impersonation"
}

export const tenantContext = new AsyncLocalStorage<TenantContext>()
