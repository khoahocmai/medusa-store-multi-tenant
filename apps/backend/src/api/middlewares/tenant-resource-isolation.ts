import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { tenantContext } from "../../utils/tenant-context"

export const blockTenantMutations = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const ctx = tenantContext.getStore()
  
  // Platform admins bypass these restrictions
  if (ctx?.accessMode === "platform") {
    return next()
  }

  // Only allow GET requests. Mutations (POST/PUT/DELETE) are blocked.
  if (req.method !== "GET" && req.method !== "OPTIONS") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Mutations (POST/PUT/DELETE) on shared or unisolated resources are blocked for tenants."
    )
  }

  return next()
}

export const validateProductCreatePayload = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const ctx = tenantContext.getStore()
  
  // Platform admins bypass these restrictions
  if (ctx?.accessMode === "platform") {
    return next()
  }

  const tenantId = ctx?.tenantId
  if (!tenantId) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Missing tenant context.")
  }

  const body = req.body as any
  
  // Defense in depth: Verify sales_channels IDs
  if (body?.sales_channels && Array.isArray(body.sales_channels)) {
    const scIds = body.sales_channels.map((sc: any) => sc.id).filter(Boolean)
    
    if (scIds.length > 0) {
      const query = req.scope.resolve("query")
      
      // Thanks to PostgreSQL RLS, this query will automatically only return 
      // sales channels belonging to the current tenant.
      const { data: allowedChannels } = await query.graph({
        entity: "sales_channel",
        fields: ["id"],
        filters: {
          id: scIds
        }
      })

      if (allowedChannels.length !== scIds.length) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Invalid payload: One or more sales channels do not belong to the current tenant."
        )
      }
    }
  }

  return next()
}
