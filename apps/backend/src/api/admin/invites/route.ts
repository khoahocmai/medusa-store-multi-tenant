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
  
  if (ctx?.accessMode === "platform") {
    const invites = await userModule.listInvites(req.query || {})
    res.json({ invites })
    return
  }

  if (ctx?.accessMode === "tenant" || ctx?.accessMode === "platform_impersonation") {
    const tenantModule: any = req.scope.resolve(TENANT_MODULE)
    
    if (ctx.accessMode === "tenant") {
      const actorId = req.auth_context?.actor_id
      const memberships = await tenantModule.listTenantMemberships({
        actor_id: actorId,
        tenant_id: ctx.tenantId,
      })
      if (!memberships.length || memberships[0].role === "member") {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only owners and admins can manage invites")
      }
    }

    const tenantInvites = await tenantModule.listTenantInvites({
      tenant_id: ctx.tenantId,
    })

    if (!tenantInvites.length) {
      res.json({ invites: [], count: 0 })
      return
    }

    const inviteIds = tenantInvites.map((ti: any) => ti.invite_id)
    const invites = await userModule.listInvites({ id: inviteIds }, req.query || {})
    
    res.json({ invites })
    return
  }

  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid access mode")
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = tenantContext.getStore()
  const userModule: any = req.scope.resolve(Modules.USER)

  if (ctx?.accessMode === "platform") {
    const invite = await userModule.createInvites(req.body)
    res.json({ invite })
    return
  }

  if (ctx?.accessMode === "tenant" || ctx?.accessMode === "platform_impersonation") {
    const tenantModule: any = req.scope.resolve(TENANT_MODULE)
    
    if (ctx.accessMode === "tenant") {
      const actorId = req.auth_context?.actor_id
      const memberships = await tenantModule.listTenantMemberships({
        actor_id: actorId,
        tenant_id: ctx.tenantId,
      })
      if (!memberships.length || memberships[0].role === "member") {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only owners and admins can invite users")
      }
    }

    // Role safeguard: admin cannot invite owners
    if (ctx.accessMode === "tenant" && req.body.metadata?.role === "owner") {
      const actorId = req.auth_context?.actor_id
      const memberships = await tenantModule.listTenantMemberships({
        actor_id: actorId,
        tenant_id: ctx.tenantId,
      })
      if (memberships[0].role !== "owner") {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Admins cannot invite owners")
      }
    }

    const invite = await userModule.createInvites(req.body)
    
    await tenantModule.createTenantInvites([{
      tenant_id: ctx.tenantId,
      invite_id: invite.id
    }])

    res.json({ invite })
    return
  }

  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid access mode")
}
