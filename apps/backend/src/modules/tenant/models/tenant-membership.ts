import { model } from "@medusajs/framework/utils"
import { Tenant } from "./tenant"

export const TenantMembership = model.define("tenant_membership", {
  id: model.id().primaryKey(),
  actor_id: model.text(),
  tenant: model.belongsTo(() => Tenant, {
    mappedBy: "memberships",
  }),
  role: model.enum(["owner", "admin", "member"]).default("member"),
  is_active: model.boolean().default(true),
})
