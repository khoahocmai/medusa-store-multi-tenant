import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function checkRoleScript({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  try {
    const { rows: roles } = await knex.raw(`
      SELECT current_user, session_user, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user;
    `)
    const role = roles[0]

    logger.info(`Running as: ${role.current_user}`)

    if (role.rolsuper) {
      logger.error("FATAL: runtime_role is a superuser")
      process.exit(1)
    }

    if (role.rolbypassrls) {
      logger.error("FATAL: runtime_role has BYPASSRLS")
      process.exit(1)
    }

    // Check RLS tables
    const { rows: tables } = await knex.raw(`
      SELECT relname, relrowsecurity, relforcerowsecurity, relowner::regrole::text as owner_name
      FROM pg_class
      WHERE relname IN ('store', 'product', 'order', 'customer')
      AND relkind = 'r';
    `)

    for (const table of tables) {
      if (!table.relrowsecurity) {
        logger.error(`FATAL: Table ${table.relname} does not have ENABLE ROW LEVEL SECURITY`)
        process.exit(1)
      }
      if (!table.relforcerowsecurity) {
        logger.error(`FATAL: Table ${table.relname} does not have FORCE ROW LEVEL SECURITY`)
        process.exit(1)
      }
      if (table.owner_name === role.current_user) {
        logger.error(`FATAL: Table ${table.relname} is owned by the current user (${role.current_user}). Owner can bypass RLS!`)
        process.exit(1)
      }
    }

    logger.info("✅ Database runtime role and RLS configuration verified successfully.")
  } catch (error) {
    logger.error("Error verifying roles", error)
    process.exit(1)
  }
}
