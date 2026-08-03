import { defineLink } from "@medusajs/framework/utils"
import TenantModule from "../modules/tenant"
import SalesChannelModule from "@medusajs/medusa/sales-channel"

export default defineLink(
  TenantModule.linkable.tenant,
  {
    linkable: SalesChannelModule.linkable.salesChannel,
    isList: true,
  }
)
