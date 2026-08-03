import { MedusaContainer } from "@medusajs/framework/types"
import { TENANT_MODULE } from "../modules/tenant"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function validatePlatformAdmin(
  container: MedusaContainer,
  actorId: string
): Promise<boolean> {
  const tenantModuleService: any = container.resolve(TENANT_MODULE)
  
  if (!tenantModuleService) {
    return false
  }

  const memberships = await tenantModuleService.listPlatformMemberships({
    actor_id: actorId,
    is_active: true
  })

  return memberships.length > 0
}

export function logPlatformAdminAudit(
  container: MedusaContainer,
  action: "CREATE" | "UPDATE" | "ACTIVATE" | "REVOKE",
  actorId: string,
  targetActorId: string,
  details?: Record<string, any>
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info(
    `[PLATFORM_ADMIN_AUDIT] Action: ${action} | Actor: ${actorId} | Target: ${targetActorId} | Details: ${JSON.stringify(
      details || {}
    )}`
  )
}
