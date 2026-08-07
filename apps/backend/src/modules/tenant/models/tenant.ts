import { model } from "@medusajs/framework/utils"
import { TenantMembership } from "./tenant-membership"
import { StoreLocator } from "./store-locator"
import { TenantInvite } from "./tenant-invite"

export const Tenant = model.define("tenant", {
  id: model.id().primaryKey(),
  name: model.text(),
  handle: model.text().unique(),
  status: model.enum(["active", "inactive", "pending"]).default("active"),
  metadata: model.json().nullable(),
  memberships: model.hasMany(() => TenantMembership, {
    mappedBy: "tenant",
  }),
  store_locators: model.hasMany(() => StoreLocator, {
    mappedBy: "tenant",
  }),
  invites: model.hasMany(() => TenantInvite, {
    mappedBy: "tenant",
  }),
})
