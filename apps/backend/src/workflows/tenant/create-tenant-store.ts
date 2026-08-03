import { createWorkflow, transform, WorkflowResponse, when } from "@medusajs/framework/workflows-sdk"
import { validateCreateTenantStoreInputStep } from "./steps/validate-create-tenant-store-input"
import { resolveExistingProvisioningStep } from "./steps/resolve-existing-provisioning"
import { verifyTenantStatusStep } from "./steps/verify-tenant-status"
import { verifyTenantAdminStep } from "./steps/verify-tenant-admin"
import { createStoreLocatorStep } from "./steps/create-store-locator"
import { createStoresWorkflow } from "@medusajs/core-flows"
import { createSalesChannelsWorkflow } from "@medusajs/core-flows"
import { createRemoteLinkStep } from "@medusajs/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../modules/tenant"
import { createStoreWithContextStep } from "./steps/create-store-with-context"

type CreateTenantStoreWorkflowInput = {
  tenant_id: string
  authenticated_actor_id: string
  store_name: string
  domain: string
  supported_currencies?: { currency_code: string; is_default?: boolean; is_tax_inclusive?: boolean }[]
}

export const createTenantStoreWorkflow = createWorkflow(
  "create-tenant-store",
  function (input: CreateTenantStoreWorkflowInput) {
    // 1. Validate Input
    const validatedInput = validateCreateTenantStoreInputStep({
      domain: input.domain,
      store_name: input.store_name,
      supported_currencies: input.supported_currencies,
    })

    // 2. Preflight Idempotency Check
    const existing = resolveExistingProvisioningStep({
      domain: validatedInput.domain,
      tenant_id: input.tenant_id,
    })

    // 3. Verify Tenant & Membership
    verifyTenantStatusStep(input.tenant_id)
    verifyTenantAdminStep({
      tenant_id: input.tenant_id,
      actor_id: input.authenticated_actor_id,
    })

    // 4. Create Provisioning if necessary
    const provisioningResult = when("check-provisioning-needed", existing, (e) => e.proceed).then(() => {
      // 4.a Create Default Sales Channel
      const salesChannels = createSalesChannelsWorkflow.runAsStep({
        input: {
          salesChannelsData: [
            {
              name: "Default Sales Channel",
              description: "Created by tenant provisioning",
              is_disabled: false,
            },
          ],
        },
      })
      const salesChannelId = transform({ salesChannels }, ({ salesChannels }) => salesChannels[0].id)

      // 4.b Create Store with Context and default_sales_channel_id
      const store = createStoreWithContextStep({
        tenant_id: input.tenant_id,
        name: validatedInput.store_name,
        supported_currencies: validatedInput.supported_currencies,
        default_sales_channel_id: salesChannelId
      })
      const storeId = transform({ store }, ({ store }) => store.id)

      // 4.c Link Tenant -> Store
      const storeLinkData = transform({ tenantId: input.tenant_id, storeId }, (data) => [
        {
          [TENANT_MODULE]: { tenant_id: data.tenantId },
          [Modules.STORE]: { store_id: data.storeId },
        },
      ])
      createRemoteLinkStep(storeLinkData).config({ name: "link-tenant-to-store" })

      // 4.d Link Tenant -> Sales Channel
      const scLinkData = transform({ tenantId: input.tenant_id, salesChannelId }, (data) => [
        {
          [TENANT_MODULE]: { tenant_id: data.tenantId },
          [Modules.SALES_CHANNEL]: { sales_channel_id: data.salesChannelId },
        },
      ])
      createRemoteLinkStep(scLinkData).config({ name: "link-tenant-to-sales-channel" })

      // 4.e Create Store Locator
      createStoreLocatorStep({
        tenant_id: input.tenant_id,
        store_id: storeId,
        domain: validatedInput.domain,
      })

      return storeId
    })

    // Resolve final Store ID
    const finalStoreId = transform({ existing, provisioningResult }, (data) => {
      if (!data.existing.proceed && data.existing.store_id) {
        return data.existing.store_id
      }
      return data.provisioningResult
    })

    return new WorkflowResponse({
      store_id: finalStoreId,
      tenant_id: input.tenant_id,
      domain: validatedInput.domain,
    })
  }
)
