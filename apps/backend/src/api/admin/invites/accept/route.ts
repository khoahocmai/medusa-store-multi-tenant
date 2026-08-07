import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../../../../modules/tenant"
import { Modules } from "@medusajs/framework/utils"
import { acceptTenantInviteWorkflow } from "../../../../workflows/tenant/accept-tenant-invite"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { invite_token, user } = req.body as any
  
  if (!invite_token || !user) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "invite_token and user are required")
  }

  const userModule: any = req.scope.resolve(Modules.USER)
  const tenantModule: any = req.scope.resolve(TENANT_MODULE)
  const authModule: any = req.scope.resolve(Modules.AUTH)

  // 1. Verify invite natively (this doesn't accept it, but we can decode or validate the token)
  // Medusa's native accept endpoint doesn't just validate, it creates the user.
  // Wait, if we use the native acceptInvite, it will create the User and AuthIdentity, 
  // and delete the Invite. We can do that, and then look up the tenant.
  // But how do we know the invite_id BEFORE it gets deleted?
  
  // We can validate the token ourselves natively using authModule or JWT if we know the secret.
  // Alternatively, we query the Invite by token.
  // In Medusa 2.0, userModule.validateInviteToken(token) returns the Invite.
  let invite: any
  try {
    invite = await userModule.validateInviteToken(invite_token)
  } catch (err: any) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid or expired invite token")
  }

  if (!invite) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid invite token")
  }

  const tenantInvites = await tenantModule.listTenantInvites({
    invite_id: invite.id
  })

  // 2. Accept invite natively (this deletes the invite and creates User)
  // But wait, the native POST /admin/invites/accept expects { invite_token, user: { ... } }
  // We can let the workflow handle creation safely to allow compensation.
  
  const { result } = await acceptTenantInviteWorkflow(req.scope).run({
    input: {
      invite_id: invite.id,
      invite_token,
      email: invite.email,
      first_name: user.first_name,
      last_name: user.last_name,
      password: user.password,
      tenant_id: tenantInvites.length > 0 ? tenantInvites[0].tenant_id : null,
      role: invite.metadata?.role || "member"
    }
  })

  res.json({ user: result.user })
}
