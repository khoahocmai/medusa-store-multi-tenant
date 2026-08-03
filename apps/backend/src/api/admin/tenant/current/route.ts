import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TenantContext } from "../../../../utils/tenant-context"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const tenantContext = req.scope.resolve<TenantContext>("tenantContext", { allowUnregistered: true })

  if (!tenantContext || !tenantContext.tenantId) {
    return res.status(404).json({ message: "No active tenant context found." })
  }

  return res.json({
    tenant_id: tenantContext.tenantId,
    access_mode: tenantContext.accessMode,
  })
}
