import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../../modules/tenant"
import { tenantContext } from "../../../../utils/tenant-context"

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const tenantId = tenantContext.getStore()?.tenantId

  if (tenantId) {
    const tenantModule: any = req.scope.resolve(TENANT_MODULE)
    
    // We fetch the membership to ensure it exists for this tenant
    const memberships = await tenantModule.listTenantMemberships({
      actor_id: id,
      tenant_id: tenantId
    })

    if (memberships.length > 0) {
      // Soft-delete the membership instead of deleting the Identity Global User
      await tenantModule.deleteTenantMemberships([memberships[0].id])
    }
    
    // Return standard Medusa JSON format for deleted items
    // This allows the Admin UI to correctly identify the row and remove it from the table
    res.json({
      id: id,
      object: "user",
      deleted: true,
    })
    return
  }

  // If there's no tenantId in context, it implies a Platform Admin is making the call
  throw new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "Platform Admins cannot delete Identity Global users from this endpoint. Please manage users through the Platform Users interface."
  )
}
