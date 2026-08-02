import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TENANT_MODULE } from "../../../modules/tenant"
import { MedusaError } from "@medusajs/framework/utils"

export const verifyPlatformAdminStep = createStep(
  "verify-platform-admin",
  async (actorId: string, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    const memberships = await tenantModule.listPlatformMemberships({
      actor_id: actorId,
    })

    if (!memberships.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Actor does not have platform administration privileges."
      )
    }

    return new StepResponse(true)
  }
)
