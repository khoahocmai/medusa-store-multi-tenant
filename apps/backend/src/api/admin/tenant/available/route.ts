import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TENANT_MODULE } from "../../../../modules/tenant"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const actorId = req.auth_context?.actor_id

  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const tenantModule: any = req.scope.resolve(TENANT_MODULE)

  const pMemberships = await tenantModule.listPlatformMemberships({ actor_id: actorId, is_active: true })
  const isPlatformAdmin = pMemberships.length > 0

  let tenants = []

  if (isPlatformAdmin) {
    // Platform Admins can see all active tenants
    tenants = await tenantModule.listTenants({ status: "active" })
  } else {
    // Tenant Admins can only see tenants they are members of
    const tMemberships = await tenantModule.listTenantMemberships({ actor_id: actorId, is_active: true })
    if (tMemberships.length > 0) {
      const uniqueTenantIds = [...new Set(tMemberships.map((m: any) => m.tenant_id))] as string[]
      tenants = await tenantModule.listTenants({ id: uniqueTenantIds, status: "active" })
    }
  }

  return res.json({
    actor_id: actorId,
    actor_scope: isPlatformAdmin ? "platform" : "tenant",
    tenants: tenants.map((t: any) => ({
      id: t.id,
      name: t.name
    }))
  })
}
