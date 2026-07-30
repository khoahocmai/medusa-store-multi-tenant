import { defineMiddlewares } from "@medusajs/framework/http"
import { tenantResolutionMiddleware } from "./middlewares/tenant-resolution"

// Verify the multi-tenant framework patch is active
try {
  const { wrapHandler } = require("@medusajs/framework/dist/http/utils/wrap-handler")
  if (!wrapHandler.toString().includes("MULTI-TENANT PATCH")) {
    console.error("CRITICAL: Medusa multi-tenant transaction patch is missing or has been overwritten!")
    process.exit(1)
  }
} catch (e) {
  console.error("CRITICAL: Failed to verify multi-tenant framework patch", e)
  process.exit(1)
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/*",
      middlewares: [tenantResolutionMiddleware],
    },
    {
      matcher: "/store/*",
      middlewares: [tenantResolutionMiddleware],
    },
  ],
})
