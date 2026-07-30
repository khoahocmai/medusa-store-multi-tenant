import { MedusaService } from "@medusajs/framework/utils"
import { Tenant } from "./models/tenant"
import { TenantMembership } from "./models/tenant-membership"
import { StoreLocator } from "./models/store-locator"

class TenantModuleService extends MedusaService({
  Tenant,
  TenantMembership,
  StoreLocator,
}) {}

export default TenantModuleService
