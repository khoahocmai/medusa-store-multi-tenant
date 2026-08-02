import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TENANT_MODULE } from "../../../modules/tenant"

type CreateStoreLocatorInput = {
  tenant_id: string
  store_id: string
  domain: string
}

export const createStoreLocatorStep = createStep(
  "create-store-locator",
  async (input: CreateStoreLocatorInput, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    const locators = await tenantModule.createStoreLocators([input])

    return new StepResponse(locators[0], locators[0].id)
  },
  async (id: string, { container }) => {
    if (id) {
      const tenantModule = container.resolve(TENANT_MODULE)
      await tenantModule.deleteStoreLocators([id])
    }
  }
)
