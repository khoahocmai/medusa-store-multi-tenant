import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../modules/tenant"
import { createTenantWorkflow } from "../workflows/tenant/create-tenant"
import { createTenantStoreWorkflow } from "../workflows/tenant/create-tenant-store"
import { tenantContext } from "../utils/tenant-context"
import { installRlsPgHook } from "../utils/rls-pg-hook"

export default async function seedUatScript({
  container,
}: {
  container: MedusaContainer
}) {
  installRlsPgHook()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const authModule = container.resolve(Modules.AUTH)
  const userModule = container.resolve(Modules.USER)
  const tenantModule = container.resolve(TENANT_MODULE) as any

  const platformEmail = process.env.UAT_PLATFORM_EMAIL || "platform@test.com"
  const platformPass = process.env.UAT_PLATFORM_PASS || "secret123"
  
  const adminAEmail = process.env.UAT_ADMIN_A_EMAIL || "adminA@test.com"
  const adminAPass = process.env.UAT_ADMIN_A_PASS || "secret123"

  const adminBEmail = process.env.UAT_ADMIN_B_EMAIL || "adminB@test.com"
  const adminBPass = process.env.UAT_ADMIN_B_PASS || "secret123"

  logger.info("Running UAT Seed Script...")

  const ensureUserAccount = async (email: string, pass: string) => {
    // 1. Check if user exists by email using User Module
    const users = await userModule.listUsers({ email })
    let user = users[0]

    // 2. Safely find matching auth identity (without querying non-existent provider field)
    const allAuths = await authModule.listAuthIdentities({}, { relations: ["provider_identities"] })
    let auth = allAuths.find((a: any) => 
      a.app_metadata?.user_id === user?.id || 
      a.provider_identities?.some((i: any) => i.entity_id === email) ||
      (a.provider_metadata?.email as string) === email
    )

    if (user && auth && auth.app_metadata?.user_id === user.id) {
      logger.info(`Reusing existing User and AuthIdentity for ${email}`)
      return { user, auth }
    }

    // 3. Create missing resources
    if (!user) {
      logger.info(`Creating new User for ${email}`)
      user = await userModule.createUsers({
        email,
        first_name: email.split("@")[0],
        last_name: "UAT",
      })
    } else {
      logger.info(`Reusing existing User for ${email}`)
    }

    if (!auth) {
      logger.info(`Creating new AuthIdentity for ${email}`)
      const registered = await authModule.register("emailpass", {
        url: "",
        headers: {},
        query: {},
        body: { email, password: pass },
        protocol: "",
      } as any)
      auth = (registered as any).authIdentity
    } else {
      logger.info(`Reusing existing AuthIdentity for ${email}`)
    }

    // 4. Ensure linked
    if (auth.app_metadata?.user_id !== user.id) {
      logger.info(`Linking AuthIdentity ${auth.id} to User ${user.id}`)
      await authModule.updateAuthIdentities({
        id: auth.id,
        app_metadata: { user_id: user.id }
      })
      auth.app_metadata = { ...auth.app_metadata, user_id: user.id }
    }

    return { user, auth }
  }

  try {
    // 1. Platform Admin
    logger.info("Setting up Platform Admin...")
    const { user: platformUser } = await ensureUserAccount(platformEmail, platformPass)
    
    const pMemberships = await tenantModule.listPlatformMemberships({ actor_id: platformUser.id })
    if (pMemberships.length === 0) {
      await tenantModule.createPlatformMemberships({
        actor_id: platformUser.id,
        is_active: true
      })
    }

    // 2. Tenant A
    logger.info("Setting up Tenant A...")
    const { user: adminAUser } = await ensureUserAccount(adminAEmail, adminAPass)

    let tenantA = (await tenantModule.listTenants({ handle: "tenant-a" }))[0]
    if (!tenantA) {
      await tenantContext.run({ accessMode: "platform" }, async () => {
        const { result } = await createTenantWorkflow(container).run({
          input: {
            name: "Tenant A",
            handle: "tenant-a",
            initial_admin_actor_id: adminAUser.id,
            authenticated_actor_id: platformUser.id,
          }
        })
        tenantA = result
      })
    }

    let storesA = await tenantModule.listStoreLocators({ tenant_id: tenantA.id })
    if (!storesA.find((s: any) => s.domain === "store-a1.local")) {
      await tenantContext.run({ tenantId: tenantA.id, accessMode: "tenant" }, async () => {
        await createTenantStoreWorkflow(container).run({
          input: {
            tenant_id: tenantA.id,
            authenticated_actor_id: adminAUser.id,
            store_name: "Store A1",
            domain: "store-a1.local"
          }
        })
      })
    }
    if (!storesA.find((s: any) => s.domain === "store-a2.local")) {
      await tenantContext.run({ tenantId: tenantA.id, accessMode: "tenant" }, async () => {
        await createTenantStoreWorkflow(container).run({
          input: {
            tenant_id: tenantA.id,
            authenticated_actor_id: adminAUser.id,
            store_name: "Store A2",
            domain: "store-a2.local"
          }
        })
      })
    }

    // 3. Tenant B
    logger.info("Setting up Tenant B...")
    const { user: adminBUser } = await ensureUserAccount(adminBEmail, adminBPass)

    let tenantB = (await tenantModule.listTenants({ handle: "tenant-b" }))[0]
    if (!tenantB) {
      await tenantContext.run({ accessMode: "platform" }, async () => {
        const { result } = await createTenantWorkflow(container).run({
          input: {
            name: "Tenant B",
            handle: "tenant-b",
            initial_admin_actor_id: adminBUser.id,
            authenticated_actor_id: platformUser.id,
          }
        })
        tenantB = result
      })
    }

    let storesB = await tenantModule.listStoreLocators({ tenant_id: tenantB.id })
    if (!storesB.find((s: any) => s.domain === "store-b1.local")) {
      await tenantContext.run({ tenantId: tenantB.id, accessMode: "tenant" }, async () => {
        await createTenantStoreWorkflow(container).run({
          input: {
            tenant_id: tenantB.id,
            authenticated_actor_id: adminBUser.id,
            store_name: "Store B1",
            domain: "store-b1.local"
          }
        })
      })
    }

    logger.info("✅ UAT Seed Script completed successfully.")
  } catch (error) {
    logger.error("Error running UAT Seed Script", error)
    process.exit(1)
  }
}
