import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

export const createUserWithContextStep = createStep(
  "create-user-with-context",
  async (
    input: {
      tenant_id: string
      email: string
      first_name?: string
      last_name?: string
    },
    { container }
  ) => {
    const userModule: any = container.resolve(Modules.USER)
    
    // User table is now Identity Global, no need to wrap in tenant context to bypass RLS during insert.
    const createdUsers = await userModule.createUsers([
      {
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
      }
    ])
    const user = createdUsers[0]
    
    return new StepResponse(user, { userId: user.id })
  },
  async (compData: { userId: string } | undefined, { container }) => {
    if (!compData) return
    const userModule: any = container.resolve(Modules.USER)
    
    // Delete user as compensation
    await userModule.deleteUsers([compData.userId])
  }
)
