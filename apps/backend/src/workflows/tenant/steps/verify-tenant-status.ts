import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../modules/tenant"

export const verifyTenantStatusStep = createStep(
  "verify-tenant-status",
  async (tenantId: string, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    const tenant = await tenantModule.retrieveTenant(tenantId)

    if (tenant.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Tenant is not active. Current status: ${tenant.status}`
      )
    }

    return new StepResponse(true)
  }
)
