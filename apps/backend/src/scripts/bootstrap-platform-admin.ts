import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../modules/tenant"
import { createTenantWorkflow } from "../workflows/tenant/create-tenant"
import { createTenantStoreWorkflow } from "../workflows/tenant/create-tenant-store"
import { tenantContext } from "../utils/tenant-context"

export default async function bootstrapPlatformAdminScript({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const authModule = container.resolve(Modules.AUTH)
  const userModule = container.resolve(Modules.USER)
  const tenantModule = container.resolve(TENANT_MODULE) as any

  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL
  const tenantName = process.env.DEFAULT_TENANT_NAME || "Platform Default Tenant"
  const tenantHandle = process.env.DEFAULT_TENANT_HANDLE || "platform-default"
  const storeName = process.env.DEFAULT_STORE_NAME || "Platform Default Store"
  const storeDomain = process.env.DEFAULT_STORE_DOMAIN || "platform.local"

  if (!platformEmail) {
    logger.error("PLATFORM_ADMIN_EMAIL is required")
    process.exit(1)
  }

  logger.info(`Bootstrapping Platform Admin for ${platformEmail}...`)

  try {
    // 1. Find User by Email
    let authIdentities = await authModule.listAuthIdentities({ provider: "emailpass" })
    let auth = authIdentities.find(a => 
      (a.provider_metadata?.email as string) === platformEmail || 
      a.provider_identities.some(i => i.entity_id === platformEmail)
    )

    if (!auth || !auth.app_metadata?.user_id) {
      throw new Error(`User with email ${platformEmail} not found or has no user_id. Please register the user first.`)
    }

    const actorId = auth.app_metadata.user_id as string
    logger.info(`Found Actor ID: ${actorId}`)

    // 2. Ensure PlatformMembership
    const pMemberships = await tenantModule.listPlatformMemberships({ actor_id: actorId })
    if (pMemberships.length === 0) {
      await tenantModule.createPlatformMemberships({
        actor_id: actorId,
        is_active: true
      })
      logger.info(`Created PlatformMembership for ${actorId}`)
    } else {
      logger.info(`PlatformMembership already exists for ${actorId}`)
    }

    // 3. Ensure Default Tenant
    let tenant = (await tenantModule.listTenants({ handle: tenantHandle }))[0]
    if (!tenant) {
      await tenantContext.run({ accessMode: "platform" }, async () => {
        const { result } = await createTenantWorkflow(container).run({
          input: {
            name: tenantName,
            handle: tenantHandle,
            initial_admin_actor_id: actorId,
            authenticated_actor_id: actorId,
          }
        })
        tenant = result
      })
      logger.info(`Created Default Tenant: ${tenant.id}`)
    } else {
      logger.info(`Default Tenant already exists: ${tenant.id}`)
      // Ensure TenantMembership exists
      const tMemberships = await tenantModule.listTenantMemberships({ tenant_id: tenant.id, actor_id: actorId })
      if (tMemberships.length === 0) {
        await tenantModule.createTenantMemberships({
          tenant_id: tenant.id,
          actor_id: actorId,
          is_active: true
        })
      }
    }

    // 4. Ensure Default Store
    let stores = await tenantModule.listStoreLocators({ tenant_id: tenant.id })
    let locator = stores.find((s: any) => s.domain === storeDomain)
    let storeId = locator?.store_id

    if (!locator) {
      await tenantContext.run({ tenantId: tenant.id, accessMode: "tenant" }, async () => {
        const { result } = await createTenantStoreWorkflow(container).run({
          input: {
            tenant_id: tenant.id,
            authenticated_actor_id: actorId,
            store_name: storeName,
            domain: storeDomain
          }
        })
        // The workflow creates store and links sales channel, and creates a locator
        stores = await tenantModule.listStoreLocators({ tenant_id: tenant.id })
        locator = stores.find((s: any) => s.domain === storeDomain)
        storeId = locator?.store_id
      })
      logger.info(`Created Default Store Locator: ${locator?.id} for Store: ${storeId}`)
    } else {
      logger.info(`Default Store Locator already exists for Domain: ${storeDomain}`)
    }

    // 5. Output Summary
    logger.info("=========================================")
    logger.info("BOOTSTRAP SUCCESSFUL")
    logger.info(`Actor ID:         ${actorId}`)
    logger.info(`Tenant ID:        ${tenant.id}`)
    logger.info(`Store ID:         ${storeId || "N/A"}`)
    logger.info(`Domain / Locator: ${storeDomain} (${locator?.id || "N/A"})`)
    // Sales channel is managed natively, finding the exact ID requires querying links, skipping to keep clean
    logger.info("=========================================")

  } catch (error) {
    logger.error("Error during bootstrap:", error)
    process.exit(1)
  }
}
