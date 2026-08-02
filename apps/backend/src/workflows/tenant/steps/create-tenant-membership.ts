import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TENANT_MODULE } from "../../../modules/tenant"

type CreateTenantMembershipInput = {
  tenant_id: string
  actor_id: string
  role: "owner" | "admin" | "member"
}

export const createTenantMembershipStep = createStep(
  "create-tenant-membership",
  async (input: CreateTenantMembershipInput, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    const [membership] = await tenantModule.createTenantMemberships([
      {
        tenant_id: input.tenant_id,
        actor_id: input.actor_id,
        role: input.role,
        is_active: true,
      },
    ])

    return new StepResponse(membership, membership.id)
  },
  async (id: string, { container }) => {
    const tenantModule = container.resolve(TENANT_MODULE)
    await tenantModule.deleteTenantMemberships([id])
  }
)
