import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../../modules/tenant"
import { tenantContext } from "../../../../utils/tenant-context"
import { Modules } from "@medusajs/framework/utils"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const ctx = tenantContext.getStore()
  const userModule: any = req.scope.resolve(Modules.USER)

  if (ctx?.accessMode === "platform") {
    await userModule.deleteInvites([id])
    res.json({ id, object: "invite", deleted: true })
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
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only owners and admins can delete invites")
      }
    }

    const tenantInvites = await tenantModule.listTenantInvites({
      tenant_id: ctx.tenantId,
      invite_id: id,
    })

    if (!tenantInvites.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Invite not found in this tenant")
    }

    await userModule.deleteInvites([id])
    await tenantModule.deleteTenantInvites([tenantInvites[0].id])
    
    res.json({ id, object: "invite", deleted: true })
    return
  }

  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid access mode")
}
