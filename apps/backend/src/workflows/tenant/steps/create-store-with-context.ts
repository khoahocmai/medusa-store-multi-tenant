import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { tenantContext } from "../../../utils/tenant-context"

export const createStoreWithContextStep = createStep(
  "create-store-with-context",
  async (
    input: {
      tenant_id: string
      name: string
      supported_currencies?: any[]
      default_sales_channel_id?: string
    },
    { container }
  ) => {
    const storeModule = container.resolve(Modules.STORE)
    
    // We manually restore ALS context before calling the store module
    // This ensures that rls-pg-hook can pick up the tenant context when Medusa ORM requests a database connection.
    const store = await tenantContext.run({ tenantId: input.tenant_id, accessMode: "tenant" }, async () => {
      const createdStores = await storeModule.createStores([
        {
          name: input.name,
          supported_currencies: input.supported_currencies,
          default_sales_channel_id: input.default_sales_channel_id
        }
      ])
      return createdStores[0]
    })
    
    return new StepResponse(store, store.id)
  },
  async (storeId: string | undefined, { container }) => {
    if (!storeId) return
    const storeModule = container.resolve(Modules.STORE)
    // Delete store for compensation
    await storeModule.deleteStores([storeId])
  }
)
