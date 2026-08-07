import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Special RLS cases that cannot use the generic tenant_id policy.
 *
 * Squashed from:
 * - Migration20260804000002 (global user identity via tenant_membership)
 * - Migration20260807133000 (publishable API key <-> sales channel relation)
 */
export class Migration20260807162000_InitTenantSpecialPolicies extends Migration {
  override async up(): Promise<void> {
    const result = await this.execute(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);
    const existingTables = result.map((row: any) => row.tablename);

    // -------------------------------------------------------------------------
    // user: global identity, tenant visibility derived from tenant_membership.
    // -------------------------------------------------------------------------
    if (existingTables.includes("user")) {
      // Defensive cleanup allows this baseline to converge even if an older
      // generic tenant policy was applied before it.
      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "user";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_select" ON "user";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_update" ON "user";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_delete" ON "user";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_insert" ON "user";`);
      this.addSql(`DROP INDEX IF EXISTS "IDX_user_tenant_id";`);
      this.addSql(`ALTER TABLE "user" DROP COLUMN IF EXISTS tenant_id;`);

      this.addSql(`ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;`);
      this.addSql(`ALTER TABLE "user" FORCE ROW LEVEL SECURITY;`);

      this.addSql(`
        CREATE POLICY "tenant_isolation_policy_select" ON "user"
        AS PERMISSIVE FOR SELECT
        TO runtime_role
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          OR EXISTS (
            SELECT 1
            FROM "tenant_membership" tm
            WHERE tm.actor_id = "user".id
              AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
              AND tm.deleted_at IS NULL
          )
        );
      `);

      this.addSql(`
        CREATE POLICY "tenant_isolation_policy_update" ON "user"
        AS PERMISSIVE FOR UPDATE
        TO runtime_role
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          OR EXISTS (
            SELECT 1
            FROM "tenant_membership" tm
            WHERE tm.actor_id = "user".id
              AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
              AND tm.deleted_at IS NULL
          )
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          OR EXISTS (
            SELECT 1
            FROM "tenant_membership" tm
            WHERE tm.actor_id = "user".id
              AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
              AND tm.deleted_at IS NULL
          )
        );
      `);

      this.addSql(`
        CREATE POLICY "tenant_isolation_policy_delete" ON "user"
        AS PERMISSIVE FOR DELETE
        TO runtime_role
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          OR EXISTS (
            SELECT 1
            FROM "tenant_membership" tm
            WHERE tm.actor_id = "user".id
              AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
              AND tm.deleted_at IS NULL
          )
        );
      `);

      // Preserve the original intent: user identities are global and may be
      // inserted independently of a tenant membership.
      this.addSql(`
        CREATE POLICY "tenant_isolation_policy_insert" ON "user"
        AS PERMISSIVE FOR INSERT
        TO runtime_role
        WITH CHECK (true);
      `);
    }

    // -------------------------------------------------------------------------
    // publishable_api_key_sales_channel:
    // derive tenant visibility from the linked sales_channel.tenant_id.
    // -------------------------------------------------------------------------
    const relationTable = "publishable_api_key_sales_channel";
    if (existingTables.includes(relationTable)) {
      this.addSql(`ALTER TABLE "${relationTable}" ENABLE ROW LEVEL SECURITY;`);
      this.addSql(`ALTER TABLE "${relationTable}" FORCE ROW LEVEL SECURITY;`);

      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${relationTable}";`);
      this.addSql(`
        CREATE POLICY "tenant_isolation_policy" ON "${relationTable}"
        AS PERMISSIVE FOR ALL
        TO runtime_role
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          OR EXISTS (
            SELECT 1
            FROM "sales_channel" sc
            WHERE sc.id = sales_channel_id
              AND sc.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
          )
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          OR EXISTS (
            SELECT 1
            FROM "sales_channel" sc
            WHERE sc.id = sales_channel_id
              AND sc.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
          )
        );
      `);
    }
  }

  override async down(): Promise<void> {
    const result = await this.execute(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);
    const existingTables = result.map((row: any) => row.tablename);

    if (existingTables.includes("publishable_api_key_sales_channel")) {
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "publishable_api_key_sales_channel";`);
      this.addSql(`ALTER TABLE "publishable_api_key_sales_channel" DISABLE ROW LEVEL SECURITY;`);
    }

    if (existingTables.includes("user")) {
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_select" ON "user";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_update" ON "user";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_delete" ON "user";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_insert" ON "user";`);
      this.addSql(`ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;`);
    }
  }
}
