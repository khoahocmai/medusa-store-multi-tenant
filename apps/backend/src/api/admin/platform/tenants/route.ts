import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validatePlatformAdmin, logPlatformAdminAudit } from "../../../../utils/platform-auth"
import { MedusaError } from "@medusajs/framework/utils"
import { createTenantWorkflow } from "../../../../workflows/tenant/create-tenant"

export const POST = async (
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

  const { name, handle, initial_admin_actor_id } = req.body as any

  if (!initial_admin_actor_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "initial_admin_actor_id is required")
  }

  const { result: tenant } = await createTenantWorkflow(req.scope).run({
    input: {
      name,
      handle,
      initial_admin_actor_id,
      authenticated_actor_id: actorId,
    },
  })

  logPlatformAdminAudit(req.scope, "CREATE", actorId, initial_admin_actor_id, {
    tenant_id: tenant.id,
    handle: tenant.handle,
  })

  res.status(200).json({ tenant })
}
