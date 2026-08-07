import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { tenantContext } from "../../../../utils/tenant-context"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = tenantContext.getStore()

  if (!ctx || !ctx.tenantId) {
    return res.status(404).json({ message: "No active tenant context found." })
  }

  return res.json({
    tenant_id: ctx.tenantId,
    access_mode: ctx.accessMode,
  })
}
