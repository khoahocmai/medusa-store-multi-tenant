import { defineLink } from "@medusajs/framework/utils"
import TenantModule from "../modules/tenant"
import StoreModule from "@medusajs/medusa/store"

export default defineLink(
  TenantModule.linkable.tenant,
  {
    linkable: StoreModule.linkable.store,
    isList: true,
  }
)
