import { model } from "@medusajs/framework/utils"
import { Tenant } from "./tenant"

export const StoreLocator = model.define("store_locator", {
  id: model.id().primaryKey(),
  tenant: model.belongsTo(() => Tenant, {
    mappedBy: "store_locators",
  }),
  store_id: model.text(),
  domain: model.text().unique(),
})
