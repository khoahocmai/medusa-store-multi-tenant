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

  // 1. Handle explicit login/logout to clear active workspace cookie
  if (cleanPath === "/admin/auth/session") {
    if (req.method === "DELETE" || req.method === "POST") {
      // Use standard generic set-cookie for deletion (expired)
      res.setHeader(
        "Set-Cookie", 
        "medusa_active_workspace=; Path=/admin; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
      )
    }
  }

  // 2. Allowlist Bootstrap/Global Routes that do not require workspace isolation
  const globalRoutes = [
    "/admin/users/me",
    "/admin/auth",
    "/admin/auth/session",
    "/admin/tenant/current",
    "/admin/tenant/available",
    "/admin/tenant/workspace"
  ]

  const isGlobalRoute = globalRoutes.some(r => cleanPath.startsWith(r))
  if (isGlobalRoute) {
    const actorId = (req as any).auth_context?.actor_id
    if (!actorId && cleanPath !== "/admin/auth/session" && !cleanPath.startsWith("/admin/auth")) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Missing authentication")
    }
    return next()
  }

  const tenantModule: any = req.scope.resolve(TENANT_MODULE)

  if (cleanPath.startsWith("/admin")) {
    // 3. Resolve Actor ID
    const actorId = (req as any).auth_context?.actor_id
    if (!actorId) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Missing authentication")
    }

    // 4. Resolve Candidate Workspace
    const headerWorkspace = req.headers["x-tenant-id"] as string
    const cookieStr = (req.headers.cookie as string) || ""
    const match = cookieStr.match(/medusa_active_workspace=([^;]+)/)
    const cookieWorkspace = match ? decodeURIComponent(match[1]) : null

    const candidateTenantId = headerWorkspace ?? cookieWorkspace

    // Guard against sentinel injection
    if (candidateTenantId === "__workspace_unselected__") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Synthetic sentinel crossed frontend boundary")
    }

    let contextData: any = { tenantId: null, accessMode: null }

    if (cleanPath.startsWith("/admin/platform")) {
      // Platform routes: Strict platform-admin verification
      const pMemberships = await tenantModule.listPlatformMemberships({ actor_id: actorId, is_active: true })
      if (pMemberships.length === 0) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not a platform admin")
      }
      contextData = { tenantId: null, accessMode: "platform" }
    } else {
      // Tenant-owned routes
      if (!candidateTenantId) {
        // No workspace selected. Check if we need to return the synthetic store shim.
        if (cleanPath === "/admin/stores" && req.method === "GET") {
          return res.json({
            stores: [{
              id: "__workspace_unselected__",
              name: "No Workspace Selected",
              supported_currencies: [],
              default_sales_channel_id: null,
            }],
            count: 1,
            offset: 0,
            limit: 1
          })
        }
        
        // Otherwise, do not allow access to tenant routes without a selected tenant
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "No workspace selected")
      }

      // Verify the candidate tenant
      let accessMode = "tenant"
      const tMemberships = await tenantModule.listTenantMemberships({ tenant_id: candidateTenantId, actor_id: actorId, is_active: true })
      
      if (tMemberships.length === 0) {
        // Fallback: Check Platform Admin impersonation
        const pMemberships = await tenantModule.listPlatformMemberships({ actor_id: actorId, is_active: true })
        if (pMemberships.length > 0) {
          accessMode = "platform_impersonation"
          // Structured audit log
          console.log(JSON.stringify({
            type: "AUDIT_LOG",
            action: "WORKSPACE_IMPERSONATION",
            actorId,
            tenantId: candidateTenantId,
            method: req.method,
            path: cleanPath,
            timestamp: new Date().toISOString()
          }))
        } else {
          console.log("FAILED TENANT AUTHORIZATION", { candidateTenantId, actorId, tMemberships, path: cleanPath })
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not a member of this workspace")
        }
      }
      
      const tenants = await tenantModule.listTenants({ id: [candidateTenantId], status: "active" })
      if (tenants.length === 0) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Workspace is not active")
      }

      contextData = { tenantId: candidateTenantId, accessMode }
    }

    return tenantContext.run(contextData, next)
  }

  // Storefront logic remains unchanged
  if (path.startsWith("/store") || path.startsWith("/tenant")) {
    const normalizedHost = req.hostname || ""
    const headerTenantId = req.headers["x-tenant-id"] as string

    if (headerTenantId === "__workspace_unselected__") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Synthetic sentinel crossed frontend boundary")
    }

    let tenantId: string | null = null
    let storeIds: string[] = []

    if (headerTenantId) {
      tenantId = headerTenantId
    } else if (normalizedHost) {
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
