import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260802000000 extends Migration {
  async up(): Promise<void> {
    const tables = ['store', 'product', 'order', 'customer'];

    // 1. Create a universal trigger function to enforce tenant_id
    this.addSql(`
      CREATE OR REPLACE FUNCTION enforce_tenant_id_trigger_fn()
      RETURNS trigger AS $$
      DECLARE
        ctx_tenant_id text;
      BEGIN
        ctx_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '');
        
        -- If context is missing, reject (fail-closed) unless we are the migration_role bypassing RLS
        IF ctx_tenant_id IS NULL AND current_user = 'runtime_role' THEN
          RAISE EXCEPTION 'Missing tenant context for insertion into %', TG_TABLE_NAME;
        END IF;

        -- If context exists, unconditionally overwrite whatever the ORM supplied
        IF ctx_tenant_id IS NOT NULL THEN
          NEW.tenant_id := ctx_tenant_id;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    for (const table of tables) {
      // 2. Apply trigger to table
      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      this.addSql(`
        CREATE TRIGGER enforce_tenant_id_trigger
        BEFORE INSERT ON "${table}"
        FOR EACH ROW
        EXECUTE FUNCTION enforce_tenant_id_trigger_fn();
      `);

      // 3. Update RLS policy to remove the unsafe platform_admin GUC bypass
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
      
      this.addSql(`
        CREATE POLICY "tenant_isolation_policy" ON "${table}"
        AS PERMISSIVE FOR ALL
        TO runtime_role
        USING (
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
      `);
    }
  }

  async down(): Promise<void> {
    const tables = ['store', 'product', 'order', 'customer'];

    for (const table of tables) {
      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      
      // Revert RLS policy to include platform admin GUC
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
      
      this.addSql(`
        CREATE POLICY "tenant_isolation_policy" ON "${table}"
        AS PERMISSIVE FOR ALL
        TO runtime_role
        USING (
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
          OR current_setting('app.is_platform_admin', true) = 'true'
        )
        WITH CHECK (
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
          OR current_setting('app.is_platform_admin', true) = 'true'
        );
      `);
    }

    this.addSql(`DROP FUNCTION IF EXISTS enforce_tenant_id_trigger_fn();`);
  }
}
