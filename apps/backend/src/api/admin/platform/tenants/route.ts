import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validatePlatformAdmin, logPlatformAdminAudit } from "../../../../utils/platform-auth"
import { MedusaError } from "@medusajs/framework/utils"
import { createTenantWorkflow } from "../../../../workflows/tenant/create-tenant"
import { createTenantStoreWorkflow } from "../../../../workflows/tenant/create-tenant-store"
import { tenantContext } from "../../../../utils/tenant-context"

import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

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

  const { name, handle, admin_email, admin_password } = req.body as any

  if (!name || !handle || !admin_email || !admin_password) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "name, handle, admin_email, and admin_password are required")
  }

  // 1. Create or resolve User
  let initial_admin_actor_id = ""
  const userModule: any = req.scope.resolve(Modules.USER)
  const authModule: any = req.scope.resolve(Modules.AUTH)
  
  try {
    const existingUsers = await userModule.listUsers({ email: admin_email })
    if (existingUsers.length > 0) {
      initial_admin_actor_id = existingUsers[0].id
    } else {
      const user = await userModule.createUsers({
        email: admin_email,
        first_name: "Tenant",
        last_name: "Admin"
      })
      initial_admin_actor_id = user.id

      const registered = await authModule.register("emailpass", {
        url: "",
        headers: {},
        query: {},
        body: { email: admin_email, password: admin_password },
        protocol: "",
      } as any)
      
      const auth = (registered as any).authIdentity
      await authModule.updateAuthIdentities({
        id: auth.id,
        app_metadata: { user_id: initial_admin_actor_id }
      })
    }
  } catch (error: any) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Failed to create user: " + error.message)
  }

  const { result: tenant } = await createTenantWorkflow(req.scope).run({
    input: {
      name,
      handle,
      initial_admin_actor_id,
      authenticated_actor_id: actorId,
    },
  })

  try {
    await tenantContext.run({ tenantId: tenant.id, accessMode: "tenant" }, async () => {
      await createTenantStoreWorkflow(req.scope).run({
        input: {
          tenant_id: tenant.id,
          authenticated_actor_id: initial_admin_actor_id,
          store_name: name,
          domain: `${handle}.localhost`,
        },
      })
    })
  } catch (error: any) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error(`Failed to provision default store for tenant ${tenant.id}: ${error.message}`, error)
  }

  logPlatformAdminAudit(req.scope, "CREATE", actorId, initial_admin_actor_id, {
    tenant_id: tenant.id,
    handle: tenant.handle,
  })

  res.status(200).json({ tenant })
}

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

  const tenantModule: any = req.scope.resolve("tenant")
  
  const tenants = await tenantModule.listTenants(
    {}, 
    { relations: ["memberships", "store_locators"] }
  )

  res.status(200).json({ tenants })
}
