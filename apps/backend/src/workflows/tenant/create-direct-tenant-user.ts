import { createWorkflow, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"
import { createUserWithContextStep } from "../platform/steps/create-user-with-context"
import { createTenantMembershipStep } from "./steps/create-tenant-membership"
import { createAuthIdentityStep } from "./steps/create-auth-identity"

type CreateDirectTenantUserWorkflowInput = {
  tenant_id: string
  email: string
  first_name?: string
  last_name?: string
  password?: string
  role?: string
}

export const createDirectTenantUserWorkflow = createWorkflow(
  "create-direct-tenant-user",
  function (input: CreateDirectTenantUserWorkflowInput) {
    // 1. Create User (Identity Global)
    const user = createUserWithContextStep({
      tenant_id: input.tenant_id,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
    })

    // 2. Create Auth Identity (Email + Password)
    createAuthIdentityStep({
      email: input.email,
      password: input.password,
      actor_id: user.id
    })

    // 3. Create Tenant Membership mapping
    createTenantMembershipStep({
      tenant_id: input.tenant_id,
      actor_id: user.id,
      role: transform({ role: input.role }, (data) => (data.role || "member") as "admin" | "owner" | "member"),
    })

    return new WorkflowResponse(user)
  }
)
