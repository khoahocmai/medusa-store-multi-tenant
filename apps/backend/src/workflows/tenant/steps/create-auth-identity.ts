import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

type CreateAuthIdentityInput = {
  email: string
  password?: string
  actor_id: string
}

export const createAuthIdentityStep = createStep(
  "create-auth-identity-step",
  async (input: CreateAuthIdentityInput, { container }) => {
    if (!input.password) return new StepResponse(null, null)

    const authModule: any = container.resolve(Modules.AUTH)
    
    const registered = await authModule.register("emailpass", {
      url: "",
      headers: {},
      query: {},
      body: { email: input.email, password: input.password },
      protocol: "",
    } as any)
    
    const auth = (registered as any).authIdentity
    await authModule.updateAuthIdentities({
      id: auth.id,
      app_metadata: { user_id: input.actor_id }
    })

    return new StepResponse(auth, auth.id)
  },
  async (id: string | null, { container }) => {
    if (!id) return
    const authModule: any = container.resolve(Modules.AUTH)
    await authModule.deleteAuthIdentities([id])
  }
)
