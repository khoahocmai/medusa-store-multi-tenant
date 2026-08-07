import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TENANT_MODULE } from "../../../../modules/tenant"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

const SelectWorkspaceSchema = z.object({
  workspace_id: z.string()
})

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const actorId = req.auth_context?.actor_id

  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const { workspace_id } = SelectWorkspaceSchema.parse(req.body)

  const tenantModule: any = req.scope.resolve(TENANT_MODULE)
  const tenants = await tenantModule.listTenants({ id: [workspace_id], status: "active" })

  if (tenants.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Workspace is not active or does not exist")
  }

  const pMemberships = await tenantModule.listPlatformMemberships({ actor_id: actorId, is_active: true })
  const isPlatformAdmin = pMemberships.length > 0

  if (!isPlatformAdmin) {
    const tMemberships = await tenantModule.listTenantMemberships({ tenant_id: workspace_id, actor_id: actorId, is_active: true })
    if (tMemberships.length === 0) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not authorized for this workspace")
    }
  }

  // Set secure cookie only after authorization succeeds
  res.setHeader(
    "Set-Cookie", 
    `medusa_active_workspace=${encodeURIComponent(workspace_id)}; Path=/admin; HttpOnly; SameSite=Lax`
  )

  return res.json({ success: true, workspace_id })
}
