import { model } from "@medusajs/framework/utils"
import { Tenant } from "./tenant"

export const TenantInvite = model.define("tenant_invite", {
  id: model.id().primaryKey(),
  invite_id: model.text(),
  tenant: model.belongsTo(() => Tenant, {
    mappedBy: "invites",
  }),
})
