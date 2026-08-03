import { defineMiddlewares } from "@medusajs/framework/http"
import { tenantResolutionMiddleware } from "./middlewares/tenant-resolution"
import { blockTenantMutations, validateProductCreatePayload } from "./middlewares/tenant-resource-isolation"

// Verify the multi-tenant framework patch is active
try {
  const fs = require("fs")
  const path = require("path")
  const file = fs.readFileSync(path.resolve(__dirname, "../../../../node_modules/@medusajs/framework/dist/http/utils/wrap-handler.js"), "utf8")
  if (!file.includes("executeInTenantTransaction")) {
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
    {
      matcher: "/admin/products",
      method: "POST",
      middlewares: [validateProductCreatePayload],
    },
    {
      matcher: "/admin/sales-channels*",
      middlewares: [blockTenantMutations],
    },
    {
      matcher: "/admin/regions*",
      middlewares: [blockTenantMutations],
    },
    {
      matcher: "/admin/shipping-profiles*",
      middlewares: [blockTenantMutations],
    },
    {
      matcher: "/admin/product-types*",
      middlewares: [blockTenantMutations],
    },
    {
      matcher: "/admin/product-categories*",
      middlewares: [blockTenantMutations],
    },
    {
      matcher: "/admin/product-tags*",
      middlewares: [blockTenantMutations],
    },
    {
      matcher: "/admin/product-collections*",
      middlewares: [blockTenantMutations],
    },
    {
      matcher: "/admin/tax-regions*",
      middlewares: [blockTenantMutations],
    }
  ],
})
