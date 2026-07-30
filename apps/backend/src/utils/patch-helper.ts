import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { withTenantTransaction } from "./transaction-wrapper"
import { asValue } from "@medusajs/framework/awilix"
import { tenantContext } from "./tenant-context"
import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function executeInTenantTransaction(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
  fn: Function
) {
  const manager = req.scope.resolve(ContainerRegistrationKeys.MANAGER)
  const actorId = (req as any).auth_context?.actor_id
  const path = req.path || ""
  
  // Apply Active tenant and membership checks if authenticated in Admin
  if (actorId && path.startsWith("/admin")) {
    const tenantModule: any = req.scope.resolve("tenant")
    const context = tenantContext.getStore()
    
    if (context && context.accessMode === "tenant" && context.tenantId) {
      // Check active tenant membership
      const memberships = await tenantModule.listTenantMemberships({
        actor_id: actorId,
        tenant_id: context.tenantId,
        is_active: true
      })
      
      if (memberships.length === 0) {
        // Fallback: check if platform admin
        const platformMemberships = await tenantModule.listPlatformMemberships({
          actor_id: actorId,
          is_active: true
        })
        if (platformMemberships.length === 0) {
           throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Unauthorized: Active tenant membership required")
        }
      }
    }
  }

  return await withTenantTransaction(manager as any, async (txManager) => {
    // Override the manager in the request scope for downstream services
    req.scope.register({
      manager: asValue(txManager),
      transactionManager: asValue(txManager) // Ensure both are set just in case
    })
    
    return await fn(req, res, next)
  })
}
