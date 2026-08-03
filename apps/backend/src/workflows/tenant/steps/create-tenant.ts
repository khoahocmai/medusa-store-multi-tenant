import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TENANT_MODULE } from "../../../modules/tenant"

type CreateTenantInput = {
  name: string
  handle: string
}

export const createTenantStep = createStep(
  "create-tenant",
  async (input: CreateTenantInput, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    const [tenant] = await tenantModule.createTenants([input])

    return new StepResponse(tenant, tenant.id)
  },
  async (id: string, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    await tenantModule.deleteTenants([id])
  }
)
