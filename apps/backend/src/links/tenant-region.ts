import { defineLink } from "@medusajs/framework/utils"
import TenantModule from "../modules/tenant"
import RegionModule from "@medusajs/medusa/region"

export default defineLink(
  TenantModule.linkable.tenant,
  {
    linkable: RegionModule.linkable.region,
    isList: true,
  }
)
