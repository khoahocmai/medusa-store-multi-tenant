import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../../modules/tenant"
import { createTenantUserWorkflow } from "../../../../workflows/platform/create-tenant-user"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const userModule: any = req.scope.resolve(Modules.USER)
  const tenantModule: any = req.scope.resolve(TENANT_MODULE)

  const limit = req.queryConfig?.pagination?.take ?? 20
  const offset = req.queryConfig?.pagination?.skip ?? 0
  const tenantId = req.query.tenant_id as string

  let userFilters: any = {}

  if (tenantId) {
    const memberships = await tenantModule.listTenantMemberships({ tenant_id: tenantId })
    if (memberships.length === 0) {
      return res.json({ users: [], count: 0, limit, offset })
    }
    const userIds = memberships.map((m: any) => m.actor_id)
    userFilters.id = userIds
  }

  const [users, count] = await userModule.listAndCountUsers(userFilters, { skip: offset, take: limit })

  if (users.length === 0) {
    return res.json({ users: [], count, limit, offset })
  }

  const userIds = users.map((u: any) => u.id)

  const memberships = await tenantModule.listTenantMemberships({
    actor_id: userIds
  })

  // Get unique tenant ids
  const tenantIds = [...new Set(memberships.map((m: any) => m.tenant_id))]
  
  let tenants: any[] = []
  if (tenantIds.length > 0) {
    tenants = await tenantModule.listTenants({ id: tenantIds })
  }

  const tenantMap = new Map<string, any>(tenants.map((t: any) => [t.id, t]))
  const membershipMap = new Map<string, any>(memberships.map((m: any) => [m.actor_id, m]))

  const usersWithTenant = users.map((user: any) => {
    const membership = membershipMap.get(user.id)
    const tenant = membership ? tenantMap.get(membership.tenant_id) : null
    
    return {
      ...user,
      tenant_id: tenant?.id || null,
      tenant_name: tenant?.name || null,
      tenant_role: membership?.role || null,
      is_platform: !membership
    }
  })

  res.json({
    users: usersWithTenant,
    count,
    limit,
    offset
  })
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { email, first_name, last_name, tenant_id, role } = req.body as any

  if (!email || !tenant_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "email and tenant_id are required")
  }

  const { result } = await createTenantUserWorkflow(req.scope).run({
    input: {
      email,
      first_name,
      last_name,
      tenant_id,
      role
    }
  })

  res.json({ user: result })
}
