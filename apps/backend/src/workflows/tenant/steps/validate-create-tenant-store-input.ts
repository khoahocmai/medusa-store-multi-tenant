import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

type ValidateCreateTenantStoreInput = {
  domain: string
  store_name: string
  supported_currencies?: { currency_code: string; is_default?: boolean; is_tax_inclusive?: boolean }[]
}

export const validateCreateTenantStoreInputStep = createStep(
  "validate-create-tenant-store-input",
  async (input: ValidateCreateTenantStoreInput) => {
    // Basic domain normalization (lowercase, remove protocol, strip paths/query)
    let normalizedDomain = input.domain.trim().toLowerCase()
    try {
      if (!normalizedDomain.startsWith("http")) {
        normalizedDomain = "https://" + normalizedDomain
      }
      const url = new URL(normalizedDomain)
      normalizedDomain = url.hostname + (url.port ? ":" + url.port : "")
    } catch {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid domain format")
    }

    if (!input.store_name?.trim()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Store name is required")
    }

    const defaultCurrencies = [{ currency_code: "usd", is_default: true }]

    return new StepResponse({
      domain: normalizedDomain,
      store_name: input.store_name.trim(),
      supported_currencies: input.supported_currencies?.length ? input.supported_currencies : defaultCurrencies,
    })
  }
)
