import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../modules/tenant"

type VerifyTenantAdminInput = {
  tenant_id: string
  actor_id: string
}

export const verifyTenantAdminStep = createStep(
  "verify-tenant-admin",
  async (input: VerifyTenantAdminInput, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    const memberships = await tenantModule.listTenantMemberships({
      tenant_id: input.tenant_id,
      actor_id: input.actor_id,
      is_active: true,
    })

    if (!memberships.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Actor does not have active membership in this tenant."
      )
    }

    const hasAdminPrivilege = memberships.some((m) => m.role === "admin" || m.role === "owner")
    if (!hasAdminPrivilege) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Actor does not have 'admin' or 'owner' privileges."
      )
    }

    return new StepResponse(true)
  }
)
