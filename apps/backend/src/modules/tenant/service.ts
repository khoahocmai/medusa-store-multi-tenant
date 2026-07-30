import { MedusaService } from "@medusajs/framework/utils"
import { Tenant } from "./models/tenant"
import { TenantMembership } from "./models/tenant-membership"
import { StoreLocator } from "./models/store-locator"

import { PlatformMembership } from "./models/platform-membership"

class TenantModuleService extends MedusaService({
  Tenant,
  TenantMembership,
  StoreLocator,
  PlatformMembership,
}) {}

export default TenantModuleService
