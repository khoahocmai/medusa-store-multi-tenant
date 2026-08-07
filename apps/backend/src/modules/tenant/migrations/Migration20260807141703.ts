import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260807141703 extends Migration {
  async up(): Promise<void> {
    const result = await this.execute(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    const existingTables = result.map((r: any) => r.tablename);

    const tablesToIsolate = [
      // Taxonomy
      'product_category', 'product_collection', 'product_tag', 'product_type',
      // Sales Config
      'region', 'tax_rate', 'tax_provider', 'currency', 'price_list',
      // Shipping & Customers
      'shipping_option', 'shipping_profile', 'shipping_method', 'customer_group'
    ];

    for (const table of tablesToIsolate) {
      if (!existingTables.includes(table)) {
        continue;
      }

      // a) Ensure tenant_id column exists
      this.addSql(`
        ALTER TABLE "${table}" 
        ADD COLUMN IF NOT EXISTS tenant_id text 
        DEFAULT NULLIF(current_setting('app.current_tenant_id', true), '');
      `);
      this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_${table}_tenant_id" ON "${table}" (tenant_id);`);

      // b) Enable and Force RLS
      this.addSql(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      this.addSql(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);

      // Re-add the trigger to enforce tenant_id population on insert/update
      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      this.addSql(`
        CREATE TRIGGER enforce_tenant_id_trigger
        BEFORE INSERT OR UPDATE ON "${table}"
        FOR EACH ROW
        EXECUTE FUNCTION enforce_tenant_id_trigger_fn();
      `);

      // c) Create strictly isolated permissive policy
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
    const result = await this.execute(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    const existingTables = result.map((r: any) => r.tablename);

    const tablesToRevert = [
      'product_category', 'product_collection', 'product_tag', 'product_type',
      'region', 'tax_rate', 'tax_provider', 'currency', 'price_list',
      'shipping_option', 'shipping_profile', 'shipping_method', 'customer_group'
    ];

    // Revert tables back to the "Shared" data model policy
    for (const table of tablesToRevert) {
      if (!existingTables.includes(table)) {
        continue;
      }

      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
      this.addSql(`
        CREATE POLICY "tenant_isolation_policy" ON "${table}"
        AS PERMISSIVE FOR ALL
        TO runtime_role
        USING (
          tenant_id IS NULL 
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          tenant_id IS NULL 
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
      `);
    }
  }
}
