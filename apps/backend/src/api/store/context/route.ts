import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { tenantContext } from "../../../utils/tenant-context"

export const AUTHENTICATE = false


export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const ctx = tenantContext.getStore()

  // Since this is a public endpoint, malformed host resolution (handled by middleware) should yield 400 or 404.
  // The middleware might already block requests if the locator isn't found.
  // But if this route is reached, we just expose public-safe context.
  
  if (!ctx || !ctx.tenantId) {
    return res.status(404).json({ message: "Store context not found." })
  }

  return res.json({
    tenant_id: ctx.tenantId,
    store_ids: ctx.storeIds || [],
  })
}
