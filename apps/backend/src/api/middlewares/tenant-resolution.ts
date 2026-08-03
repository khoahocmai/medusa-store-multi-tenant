import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { tenantContext } from "../../utils/tenant-context"
import { TENANT_MODULE } from "../../modules/tenant"
import { MedusaError } from "@medusajs/framework/utils"


export const tenantResolutionMiddleware = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const path = (req as any).originalUrl || req.path || (req as any).url

  const cleanPath = path.split('?')[0].replace(/\/$/, "")

  // Allowlist Bootstrap Routes specifically
  if (cleanPath === "/admin/users/me") {
    const actorId = (req as any).auth_context?.actor_id
    if (!actorId) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Missing authentication")
    }
    return next()
  }


  const tenantModule: any = req.scope.resolve(TENANT_MODULE)

  if (cleanPath.startsWith("/admin")) {
    const tenantId = req.headers["x-tenant-id"] as string

    // 1. Resolve Actor ID from Medusa Auth Context ONLY
    const actorId = (req as any).auth_context?.actor_id
    
    if (!actorId) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Missing authentication")
    }

    let contextData: any = { tenantId: null, accessMode: null }

    if (cleanPath.startsWith("/admin/platform")) {
      // Platform routes: Strict platform-admin verification
      const pMemberships = await tenantModule.listPlatformMemberships({ is_active: true })
      const hasPlatformMembership = pMemberships.some((m: any) => m.actor_id === actorId)
      if (!hasPlatformMembership) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not a platform admin")
      }
      contextData = { tenantId: null, accessMode: "platform" }
    } else {
      // Tenant routes: Strict tenant-membership verification
      if (!tenantId) {
        const tMemberships = await tenantModule.listTenantMemberships({ actor_id: actorId, is_active: true })
        if (tMemberships.length === 0) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not a member of any tenant")
        }

        const uniqueTenantIds = [...new Set(tMemberships.map((m: any) => m.tenant_id))] as string[]
        const tenants = await tenantModule.listTenants({ id: uniqueTenantIds, status: "active" })
        
        if (tenants.length === 0) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not a member of any active tenant")
        }

        if (tenants.length > 1) {
          throw new MedusaError(MedusaError.Types.INVALID_DATA, "TENANT_SELECTION_REQUIRED")
        }

        contextData = { tenantId: tenants[0].id, accessMode: "tenant" }
      } else {
        const tMemberships = await tenantModule.listTenantMemberships({ tenant_id: tenantId, actor_id: actorId, is_active: true })
        
        let accessMode = "tenant"

        if (tMemberships.length === 0) {
          // Check if Platform Admin impersonation
          const pMemberships = await tenantModule.listPlatformMemberships({ actor_id: actorId, is_active: true })
          if (pMemberships.length > 0) {
            accessMode = "platform_impersonation"
            // Structured audit log
            console.log(JSON.stringify({
              type: "AUDIT_LOG",
              action: "PLATFORM_IMPERSONATION",
              actorId,
              tenantId,
              method: req.method,
              path: cleanPath,
              timestamp: new Date().toISOString()
            }))
          } else {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not a member of this tenant")
          }
        }
        
        const tenants = await tenantModule.listTenants({ id: [tenantId], status: "active" })
        if (tenants.length === 0) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Tenant is not active")
        }

        contextData = { tenantId, accessMode }
      }
    }

    return tenantContext.run(contextData, next)
  }

  if (path.startsWith("/store") || path.startsWith("/tenant")) {
    // req.hostname respects Express 'trust proxy' setting and strips the port automatically.
    const normalizedHost = req.hostname || ""
    const pubKey = req.headers["x-publishable-api-key"] as string

    let tenantId = null
    let storeIds: string[] = []

    if (normalizedHost) {
      const locators = await tenantModule.listStoreLocators({
        domain: normalizedHost
      })
      if (locators.length > 0) {
        tenantId = locators[0].tenant_id
        storeIds = [locators[0].store_id]
      }
    }

    return tenantContext.run(
      {
        tenantId,
        storeIds,
        accessMode: "tenant"
      },
      next
    )
  }

  return next()
}
