import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { verifyPlatformAdminStep } from "./steps/verify-platform-admin"
import { validateCreateTenantInputStep } from "./steps/validate-create-tenant-input"
import { createTenantStep } from "./steps/create-tenant"
import { createTenantMembershipStep } from "./steps/create-tenant-membership"

type CreateTenantWorkflowInput = {
  name: string
  handle: string
  initial_admin_actor_id: string
  authenticated_actor_id: string
}

export const createTenantWorkflow = createWorkflow(
  "create-tenant",
  function (input: CreateTenantWorkflowInput) {
    // 1. Verify platform admin privileges of the actor creating the tenant
    verifyPlatformAdminStep(input.authenticated_actor_id)

    // 2. Validate inputs
    const validated = validateCreateTenantInputStep({
      name: input.name,
      handle: input.handle,
      initial_admin_actor_id: input.initial_admin_actor_id,
    })

    // 3. Create the tenant
    const tenant = createTenantStep({
      name: validated.name,
      handle: validated.handle,
    })

    // 4. Create initial membership (admin role)
    createTenantMembershipStep({
      tenant_id: tenant.id,
      actor_id: validated.initial_admin_actor_id,
      role: "admin", // Using 'admin' as it is part of the approved enum ['owner', 'admin', 'member']
    })

    return new WorkflowResponse(tenant)
  }
)
