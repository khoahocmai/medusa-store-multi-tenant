import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { tenantContext } from "../../../../utils/tenant-context"
import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTenantStoreWorkflow } from "../../../../workflows/tenant/create-tenant-store"
import { TENANT_MODULE } from "../../../../modules/tenant"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = tenantContext.getStore()
  console.log("TENANT CONTEXT IN STORE ROUTE:", ctx, "Headers:", req.headers["x-tenant-id"])
  const actorId = req.auth_context?.actor_id || req.headers["x-actor-id"] as string

  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  if (!ctx || !ctx.tenantId) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "No active tenant context.")
  }

  // Reject if body contains tenant_id override
  if (req.body && typeof req.body === "object" && "tenant_id" in req.body) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "tenant_id cannot be supplied in the request body.")
  }

  const { store_name, domain, supported_currencies } = req.body as any

  const { result } = await createTenantStoreWorkflow(req.scope).run({
    input: {
      tenant_id: ctx.tenantId,
      authenticated_actor_id: actorId,
      store_name,
      domain,
      supported_currencies,
    },
  })

  res.status(200).json(result)
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = tenantContext.getStore()

  if (!ctx || !ctx.tenantId) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "No active tenant context.")
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  // Starting strictly from the tenant-store link of the current tenant to prevent cross-tenant reading
  const { data: stores } = await query.graph({
    entity: "tenant",
    fields: ["stores.*"],
    filters: {
      id: ctx.tenantId,
    },
  })

  if (!stores.length) {
    return res.json({ stores: [] })
  }

  res.json({ stores: stores[0].stores })
}
