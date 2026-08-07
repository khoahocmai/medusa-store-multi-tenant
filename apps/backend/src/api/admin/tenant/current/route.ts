import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { tenantContext } from "../../../../utils/tenant-context"
import { TENANT_MODULE } from "../../../../modules/tenant"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = tenantContext.getStore()
  const actorId = req.auth_context?.actor_id

  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const tenantModule: any = req.scope.resolve(TENANT_MODULE)

  const pMemberships = await tenantModule.listPlatformMemberships({ actor_id: actorId, is_active: true })
  const tMemberships = await tenantModule.listTenantMemberships({ actor_id: actorId, is_active: true })

  const is_platform_admin = pMemberships.length > 0
  const tenant_membership_count = tMemberships.length

  return res.json({
    actor_id: actorId,
    actor_scope: is_platform_admin ? "platform" : "tenant",
    access_mode: ctx?.accessMode || null,
    tenant_id: ctx?.tenantId || null,
    is_platform_admin,
    tenant_membership_count
  })
}
