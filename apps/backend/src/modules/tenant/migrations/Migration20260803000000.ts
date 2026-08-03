import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260803000000 extends Migration {
  async up(): Promise<void> {
    const tables = ['store', 'product', 'order', 'customer'];

    // 1. Create a universal trigger function to enforce tenant_id strictly
    this.addSql(`
      CREATE OR REPLACE FUNCTION enforce_tenant_id_trigger_fn()
      RETURNS trigger AS $$
      DECLARE
        ctx_tenant_id text;
      BEGIN
        ctx_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '');
        
        -- If context is missing, reject (fail-closed) unless we are the migration_role bypassing RLS
        IF ctx_tenant_id IS NULL AND current_user = 'runtime_role' THEN
          RAISE EXCEPTION 'Missing tenant context for operation on %', TG_TABLE_NAME;
        END IF;

        IF TG_OP = 'INSERT' THEN
          -- On INSERT, context must exist for runtime_role, and we set it.
          IF ctx_tenant_id IS NOT NULL THEN
            NEW.tenant_id := ctx_tenant_id;
          END IF;
        ELSIF TG_OP = 'UPDATE' THEN
          -- On UPDATE, if context is provided, it MUST match the old tenant_id (unless OLD is null, which shouldn't happen anymore but just in case)
          IF current_user = 'runtime_role' THEN
            IF OLD.tenant_id IS NULL THEN
              RAISE EXCEPTION 'Cannot update legacy record with NULL tenant_id on %', TG_TABLE_NAME;
            END IF;
            IF ctx_tenant_id IS NOT NULL AND ctx_tenant_id != OLD.tenant_id THEN
              RAISE EXCEPTION 'Cannot cross-update record from tenant % to % on %', OLD.tenant_id, ctx_tenant_id, TG_TABLE_NAME;
            END IF;
          END IF;
          
          -- Unconditionally prevent client from altering tenant_id
          NEW.tenant_id := OLD.tenant_id;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    for (const table of tables) {
      // 2. Apply trigger to table for BOTH INSERT AND UPDATE
      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      this.addSql(`
        CREATE TRIGGER enforce_tenant_id_trigger
        BEFORE INSERT OR UPDATE ON "${table}"
        FOR EACH ROW
        EXECUTE FUNCTION enforce_tenant_id_trigger_fn();
      `);

      // 3. Update RLS policy to be strictly IS NOT NULL
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
      this.addSql(`
        CREATE POLICY "tenant_isolation_policy" ON "${table}"
        AS PERMISSIVE FOR ALL
        TO runtime_role
        USING (
          tenant_id IS NOT NULL
          AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          tenant_id IS NOT NULL
          AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
      `);
    }
  }

  async down(): Promise<void> {
    const tables = ['store', 'product', 'order', 'customer'];

    for (const table of tables) {
      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      
      this.addSql(`
        CREATE TRIGGER enforce_tenant_id_trigger
        BEFORE INSERT ON "${table}"
        FOR EACH ROW
        EXECUTE FUNCTION enforce_tenant_id_trigger_fn();
      `);

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

    // Revert function to insert-only logic
    this.addSql(`
      CREATE OR REPLACE FUNCTION enforce_tenant_id_trigger_fn()
      RETURNS trigger AS $$
      DECLARE
        ctx_tenant_id text;
      BEGIN
        ctx_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '');
        
        IF ctx_tenant_id IS NULL AND current_user = 'runtime_role' THEN
          RAISE EXCEPTION 'Missing tenant context for insertion into %', TG_TABLE_NAME;
        END IF;

        IF ctx_tenant_id IS NOT NULL THEN
          NEW.tenant_id := ctx_tenant_id;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }
}
