import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../modules/tenant"
import { tenantContext } from "../../../utils/tenant-context"
import { Modules } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = tenantContext.getStore()
  const userModule: any = req.scope.resolve(Modules.USER)
  const tenantModule: any = req.scope.resolve(TENANT_MODULE)
  
  const query = req.query || {}

  if (ctx?.accessMode === "platform") {
    // Platform sees all users globally
    const [users, count] = await userModule.listAndCountUsers(
      {}, // no filter
      query
    )
    res.json({ users, count, offset: query.offset || 0, limit: query.limit || 20 })
    return
  }

  if (ctx?.accessMode === "tenant" || ctx?.accessMode === "platform_impersonation") {
    const tenantId = ctx.tenantId

    if (ctx.accessMode === "tenant") {
      // Require owner or admin role for tenant context
      const actorId = req.auth_context?.actor_id
      const memberships = await tenantModule.listTenantMemberships({
        actor_id: actorId,
        tenant_id: tenantId,
      })
      if (!memberships.length || memberships[0].role === "member") {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only owners and admins can manage users")
      }
    }

    // Platform Impersonation does not need membership check, just scope to tenant_id

    const allMemberships = await tenantModule.listTenantMemberships({
      tenant_id: tenantId,
    })

    if (!allMemberships.length) {
      res.json({ users: [], count: 0, offset: query.offset || 0, limit: query.limit || 20 })
      return
    }

    const actorIds = allMemberships.map((m: any) => m.actor_id)

    const [users, count] = await userModule.listAndCountUsers(
      { id: actorIds },
      query
    )

    res.json({ users, count, offset: query.offset || 0, limit: query.limit || 20 })
    return
  }

  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid access mode")
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = tenantContext.getStore()

  if (ctx?.accessMode === "platform") {
    const userModule: any = req.scope.resolve(Modules.USER)
    const { email, first_name, last_name, avatar_url } = req.body as any
    const user = await userModule.createUsers({
      email, first_name, last_name, avatar_url
    })
    res.status(200).json({ user })
    return
  }

  if (ctx?.accessMode === "tenant" || ctx?.accessMode === "platform_impersonation") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Direct user provisioning is disabled for tenants. Please use Invites to onboard users."
    )
  }

  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid access mode")
}
