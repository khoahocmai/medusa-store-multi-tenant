import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../../modules/tenant"
import { tenantContext } from "../../../../utils/tenant-context"
import { Modules } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const ctx = tenantContext.getStore()
  const userModule: any = req.scope.resolve(Modules.USER)

  if (ctx?.accessMode === "platform") {
    const user = await userModule.retrieveUser(id)
    res.json({ user })
    return
  }

  if (ctx?.accessMode === "tenant" || ctx?.accessMode === "platform_impersonation") {
    const tenantModule: any = req.scope.resolve(TENANT_MODULE)
    const memberships = await tenantModule.listTenantMemberships({
      actor_id: id,
      tenant_id: ctx.tenantId,
    })

    if (!memberships.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "User not found in this tenant")
    }

    const user = await userModule.retrieveUser(id)
    res.json({ user })
    return
  }

  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid access mode")
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const ctx = tenantContext.getStore()
  const userModule: any = req.scope.resolve(Modules.USER)

  if (ctx?.accessMode === "platform") {
    const user = await userModule.updateUsers({ id, ...req.body })
    res.json({ user })
    return
  }

  if (ctx?.accessMode === "tenant" || ctx?.accessMode === "platform_impersonation") {
    const tenantModule: any = req.scope.resolve(TENANT_MODULE)
    const actorId = req.auth_context?.actor_id

    if (ctx.accessMode === "tenant") {
      const requesterMemberships = await tenantModule.listTenantMemberships({
        actor_id: actorId,
        tenant_id: ctx.tenantId,
      })
      if (!requesterMemberships.length || requesterMemberships[0].role === "member") {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only owners and admins can manage users")
      }
    }

    const targetMemberships = await tenantModule.listTenantMemberships({
      actor_id: id,
      tenant_id: ctx.tenantId,
    })

    if (!targetMemberships.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "User not found in this tenant")
    }

    // Check if the request body is trying to modify global fields like email, first_name, last_name, avatar_url
    const allowedKeys = ["metadata"] // Allowing metadata if needed, but no global identity fields
    for (const key of Object.keys(req.body)) {
      if (!allowedKeys.includes(key)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Tenant Admins cannot modify global user field: ${key}`
        )
      }
    }

    // Actually update the user metadata if passed
    const user = await userModule.updateUsers({ id, ...req.body })
    res.json({ user })
    return
  }

  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid access mode")
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const ctx = tenantContext.getStore()

  if (ctx?.accessMode === "platform") {
    const userModule: any = req.scope.resolve(Modules.USER)
    await userModule.deleteUsers([id])
    res.json({
      id: id,
      object: "user",
      deleted: true,
    })
    return
  }

  if (ctx?.accessMode === "tenant" || ctx?.accessMode === "platform_impersonation") {
    const tenantModule: any = req.scope.resolve(TENANT_MODULE)
    const actorId = req.auth_context?.actor_id

    if (ctx.accessMode === "tenant") {
      const requesterMemberships = await tenantModule.listTenantMemberships({
        actor_id: actorId,
        tenant_id: ctx.tenantId,
      })
      if (!requesterMemberships.length || requesterMemberships[0].role === "member") {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only owners and admins can delete users")
      }
    }

    const targetMemberships = await tenantModule.listTenantMemberships({
      actor_id: id,
      tenant_id: ctx.tenantId,
    })

    if (targetMemberships.length > 0) {
      const membership = targetMemberships[0]
      
      if (membership.role === "owner") {
        const knex: any = req.scope.resolve("pgConnection")
        await knex.transaction(async (trx: any) => {
          const owners = await trx("tenant_membership")
            .where({ tenant_id: ctx.tenantId, role: "owner", deleted_at: null })
            .forUpdate()
            
          if (owners.length <= 1) {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Cannot remove the last owner of the tenant")
          }
          
          await tenantModule.deleteTenantMemberships([membership.id])
        })
      } else {
        await tenantModule.deleteTenantMemberships([membership.id])
      }
    }
    
    res.json({
      id: id,
      object: "user",
      deleted: true,
    })
    return
  }

  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid access mode")
}
