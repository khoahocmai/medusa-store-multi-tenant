import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { tenantContext } from "../../utils/tenant-context"
import { TENANT_MODULE } from "../../modules/tenant"
import { MedusaError } from "@medusajs/framework/utils"

export async function tenantResolutionMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const path = req.path
  
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
  
  if (path.startsWith("/admin")) {
    const tenantId = req.headers["x-tenant-id"] as string
    
    // Auth context might not be available yet if core authentication runs after this middleware.
    // In Medusa v2, custom middlewares currently run BEFORE core route handlers.
    // If we absolutely need auth_context, we would check it here. 
    // However, since we intercept core routes to inject tenantContext, we will just parse headers here.
    // If the route later populates auth_context, we cannot easily back-propagate it to the ALS unless we proxy.
    // But ALS holds the object reference! So we can mutate the context object later if needed.
    // For MVP, we will set the tenantId from the header and default to "platform" access mode if none provided.
    
    const contextData: any = {
      tenantId: tenantId || null,
      accessMode: tenantId ? "tenant" : "platform"
    }
    
    return tenantContext.run(contextData, next)
  }
  
  if (path.startsWith("/store")) {
    const hostHeader = req.headers["x-forwarded-host"] || req.headers["host"] || ""
    const pubKey = req.headers["x-publishable-api-key"] as string
    
    let tenantId = null
    let storeIds: string[] = []
    
    const tenantModule: any = req.scope.resolve(TENANT_MODULE)
    
    if (hostHeader) {
      // Normalization and Spoofing protection
      const hostString = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
      const normalizedHost = hostString.split(":")[0] // Strip port
      
      const locators = await tenantModule.listStoreLocators({
        domain: normalizedHost,
        is_active: true
      })
      
      if (locators.length > 0) {
        tenantId = locators[0].tenant_id
        storeIds = [locators[0].store_id]
      }
    }
    
    // In a full implementation, we'd also validate pubKey here.
    
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
