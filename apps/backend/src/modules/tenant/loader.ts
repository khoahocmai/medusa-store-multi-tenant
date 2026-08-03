import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function verifyRuntimeRoleLoader({
  container,
}: {
  container: MedusaContainer
}) {
  const isServerProcess = process.argv.includes("dev") || process.argv.includes("develop") || process.argv.includes("start")
  if (!isServerProcess) {
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  try {
    const { rows: roles } = await knex.raw(`
      SELECT current_user, session_user, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user;
    `)
    const role = roles[0]

    logger.info(`[Startup Assertion] Running backend as: ${role.current_user}`)

    if (role.rolsuper) {
      throw new Error("FATAL: Backend process is running as a SUPERUSER. Row Level Security will be bypassed!")
    }

    if (role.rolbypassrls) {
      throw new Error("FATAL: Backend process has BYPASSRLS. Row Level Security will be bypassed!")
    }

    const { rows: tables } = await knex.raw(`
      SELECT relname, relowner::regrole::text as owner_name
      FROM pg_class
      WHERE relname IN ('store', 'product', 'order', 'customer')
      AND relkind = 'r';
    `)

    for (const table of tables) {
      if (table.owner_name === role.current_user) {
        throw new Error(`FATAL: Table ${table.relname} is owned by the current backend user (${role.current_user}). Owner bypasses RLS!`)
      }
    }

    logger.info("✅ [Startup Assertion] Database runtime role and strict RLS enforcement verified.")
  } catch (error: any) {
    logger.error("Error verifying backend role at startup:")
    throw error
  }
}
