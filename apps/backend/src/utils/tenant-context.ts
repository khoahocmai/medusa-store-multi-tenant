import { AsyncLocalStorage } from "async_hooks"

export type TenantContext = {
  tenantId: string
  actorId?: string
  storeIds?: string[]
  accessMode: "tenant" | "platform"
}

export const tenantContext = new AsyncLocalStorage<TenantContext>()
