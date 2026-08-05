import { createWorkflow, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"
import { createUserWithContextStep } from "./steps/create-user-with-context"
import { createTenantMembershipStep } from "../tenant/steps/create-tenant-membership"

type CreateTenantUserWorkflowInput = {
  tenant_id: string
  email: string
  first_name?: string
  last_name?: string
  role?: string
}

export const createTenantUserWorkflow = createWorkflow(
  "create-tenant-user",
  function (input: CreateTenantUserWorkflowInput) {
    // 1. Create User in the correct tenant context
    const user = createUserWithContextStep({
      tenant_id: input.tenant_id,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
    })

    // 2. Create Tenant Membership mapping
    createTenantMembershipStep({
      tenant_id: input.tenant_id,
      actor_id: user.id,
      role: transform({ role: input.role }, (data) => (data.role || "member") as "admin" | "owner" | "member"),
    })

    return new WorkflowResponse(user)
  }
)
