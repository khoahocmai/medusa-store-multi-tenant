import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { tenantContext } from "../../utils/tenant-context"
import { TENANT_MODULE } from "../../modules/tenant"
import { MedusaError } from "@medusajs/framework/utils"
import jwt from "jsonwebtoken"

export const tenantResolutionMiddleware = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const path = (req as any).originalUrl || req.path || (req as any).url
  
  // Explicit route allow/block matrix enforcement
  const blockedPrefixes = [
    "/admin/users",
    "/admin/sales-channels",
    "/admin/regions",
    "/admin/pricing",
    "/admin/price-lists",
    "/admin/inventory-items",
    "/admin/promotions",
    "/admin/campaigns",
    "/admin/api-keys",
    "/store/carts",
    "/store/payment"
  ]
  
  if (blockedPrefixes.some(prefix => path.startsWith(prefix))) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED, 
      "Route temporarily blocked pending tenant isolation (Multi-Tenant MVP)"
    )
  }
  
  const tenantModule: any = req.scope.resolve(TENANT_MODULE)

  if (path.startsWith("/admin")) {
    const tenantId = req.headers["x-tenant-id"] as string
    
    // 1. Resolve Actor ID from Auth Header securely
    let actorId: string | undefined
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "supersecret")
        actorId = decoded.actor_id
      } catch (e) {
        // Invalid token
      }
    }

    let contextData: any = { tenantId: null, accessMode: null }

    if (path.startsWith("/admin/platform")) {
      // Platform routes: Strict platform-admin verification
      if (!actorId) {
        throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Missing authentication")
      }
      const pMemberships = await tenantModule.listPlatformMemberships({ is_active: true })
      const hasPlatformMembership = pMemberships.some((m: any) => m.actor_id === actorId)
      if (!hasPlatformMembership) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not a platform admin")
      }
      contextData = { tenantId: null, accessMode: "platform" }
    } else {
      // Tenant routes: Strict tenant-membership verification
      if (!tenantId) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing x-tenant-id header")
      }
      if (!actorId) {
        throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Missing authentication")
      }
      const tMemberships = await tenantModule.listTenantMemberships({ tenant_id: tenantId, is_active: true })
      const hasMembership = tMemberships.some((m: any) => m.actor_id === actorId)
      if (!hasMembership) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not a member of this tenant")
      }
      contextData = { tenantId, accessMode: "tenant" }
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
      console.log("MIDDLEWARE LOCATORS:", normalizedHost, locators.length)
      
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
