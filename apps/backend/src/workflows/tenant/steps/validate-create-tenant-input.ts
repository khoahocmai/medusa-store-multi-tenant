import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../modules/tenant"

type ValidateCreateTenantInput = {
  name: string
  handle: string
  initial_admin_actor_id: string
}

export const validateCreateTenantInputStep = createStep(
  "validate-create-tenant-input",
  async (input: ValidateCreateTenantInput, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    
    const normalizedHandle = input.handle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
    const normalizedName = input.name.trim()

    if (!normalizedHandle) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Handle is required")
    }

    if (!normalizedName) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Name is required")
    }

    if (!input.initial_admin_actor_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Initial admin actor ID is required")
    }

    const existingTenants = await tenantModule.listTenants({
      handle: normalizedHandle,
    })

    if (existingTenants.length > 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Tenant with handle ${normalizedHandle} already exists`
      )
    }

    return new StepResponse({
      name: normalizedName,
      handle: normalizedHandle,
      initial_admin_actor_id: input.initial_admin_actor_id,
    })
  }
)
