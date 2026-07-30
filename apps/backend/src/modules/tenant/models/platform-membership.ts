import { model } from "@medusajs/framework/utils"

export const PlatformMembership = model.define("platform_membership", {
  id: model.id().primaryKey(),
  actor_id: model.text().unique(),
  role: model.enum(["superadmin", "viewer"]).default("viewer"),
  is_active: model.boolean().default(true),
  created_by: model.text().nullable(),
})
