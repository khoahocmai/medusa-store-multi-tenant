import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../modules/tenant"

type ResolveExistingProvisioningInput = {
  domain: string
  tenant_id: string
}

export const resolveExistingProvisioningStep = createStep(
  "resolve-existing-provisioning",
  async (input: ResolveExistingProvisioningInput, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    const locators = await tenantModule.listStoreLocators({
      domain: input.domain,
    })

    if (locators.length > 0) {
      const locator = locators[0]
      if (locator.tenant_id !== input.tenant_id) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Conflict: Domain ${input.domain} is already registered to another tenant.`
        )
      }
      if (locator.store_id) {
        // Complete provisioning
        return new StepResponse({
          proceed: false,
          store_id: locator.store_id,
        })
      }
      // Partial provisioning
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Conflict: Domain ${input.domain} is in a partial provisioning state.`
      )
    }

    return new StepResponse({ proceed: true, store_id: undefined as string | undefined })
  }
)
