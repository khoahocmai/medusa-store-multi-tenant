import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validatePlatformAdmin } from "../../../../../utils/platform-auth"
import { MedusaError } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const actorId = req.auth_context?.actor_id || req.headers["x-actor-id"] as string

  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  const isPlatformAdmin = await validatePlatformAdmin(req.scope, actorId)
  if (!isPlatformAdmin) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Platform administration privileges required")
  }

  const { id } = req.params

  const tenantModule: any = req.scope.resolve("tenant")
  
  const tenants = await tenantModule.listTenants(
    { id }, 
    { relations: ["memberships", "store_locators"] }
  )

  if (tenants.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tenant not found")
  }

  res.status(200).json({ tenant: tenants[0] })
}
