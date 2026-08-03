import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260730040000 extends Migration {
  async up(): Promise<void> {
    // raw SQL for setting up roles
    this.addSql(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'migration_role') THEN
          CREATE ROLE migration_role WITH LOGIN PASSWORD 'migration_password' SUPERUSER;
        END IF;

        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'runtime_role') THEN
          CREATE ROLE runtime_role WITH LOGIN PASSWORD 'runtime_password' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

    // grant permissions to runtime_role
    this.addSql(`
      GRANT USAGE ON SCHEMA public TO runtime_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO runtime_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO runtime_role;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO runtime_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO runtime_role;
    `);

    // alter tables to add tenant_id
    const tables = ['store', 'product', 'order', 'customer'];
    for (const table of tables) {
      this.addSql(`
        ALTER TABLE "${table}" 
        ADD COLUMN IF NOT EXISTS tenant_id text 
        DEFAULT NULLIF(current_setting('app.current_tenant_id', true), '');
      `);
      this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_${table}_tenant_id" ON "${table}" (tenant_id);`);
      
      // Enable RLS
      this.addSql(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      this.addSql(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);

      // Drop policy if exists then recreate
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
  }

  async down(): Promise<void> {
    const tables = ['store', 'product', 'order', 'customer'];
    for (const table of tables) {
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
      this.addSql(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
      this.addSql(`DROP INDEX IF EXISTS "IDX_${table}_tenant_id";`);
      this.addSql(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS tenant_id;`);
    }
  }
}
