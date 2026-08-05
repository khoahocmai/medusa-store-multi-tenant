import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { tenantContext } from "../../../utils/tenant-context"
import { createDirectTenantUserWorkflow } from "../../../workflows/tenant/create-direct-tenant-user"
import { TENANT_MODULE } from "../../../modules/tenant"
import { Modules } from "@medusajs/framework/utils"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const tenantId = tenantContext.getStore()?.tenantId

  if (!tenantId) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Tenant ID is required for this action")
  }

  const { email, first_name, last_name, role, password } = req.body as any

  if (!email || !password) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Email and password are required")
  }

  const { result } = await createDirectTenantUserWorkflow(req.scope).run({
    input: {
      tenant_id: tenantId,
      email,
      first_name,
      last_name,
      password,
      role
    }
  })

  res.status(200).json({ user: result })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const tenantId = tenantContext.getStore()?.tenantId

  if (!tenantId) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Tenant ID is required for this action")
  }

  const tenantModule: any = req.scope.resolve(TENANT_MODULE)
  const userModule: any = req.scope.resolve(Modules.USER)

  // Determine if this is the platform admin by checking the tenant handle
  const tenant = await tenantModule.retrieveTenant(tenantId)
  const isPlatformAdmin = tenant.handle === "platform-default"

  // Get memberships for this tenant
  const memberships = await tenantModule.listTenantMemberships({
    tenant_id: tenantId,
    deleted_at: null
  })

  if (memberships.length === 0) {
    res.status(200).json({ users: [], is_platform_admin: isPlatformAdmin })
    return
  }

  // Extract actor IDs
  const actorIds = memberships.map((m: any) => m.actor_id)

  // Fetch users mapped to this tenant
  const users = await userModule.listUsers({
    id: actorIds
  })

  // Combine user data with role
  const usersWithRole = users.map((user: any) => {
    const membership = memberships.find((m: any) => m.actor_id === user.id)
    return {
      ...user,
      tenant_role: membership?.role || "member",
      membership_id: membership?.id
    }
  })

  res.status(200).json({ 
    users: usersWithRole,
    is_platform_admin: isPlatformAdmin 
  })
}
