import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260807133000 extends Migration {
  async up(): Promise<void> {
    const table = 'publishable_api_key_sales_channel';

    this.addSql(`ALTER TABLE IF EXISTS "${table}" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`ALTER TABLE IF EXISTS "${table}" FORCE ROW LEVEL SECURITY;`);
    
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
    this.addSql(`
      CREATE POLICY "tenant_isolation_policy" ON "${table}"
      AS PERMISSIVE FOR ALL
      TO runtime_role
      USING (
        NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
        OR EXISTS (
          SELECT 1 FROM "sales_channel" sc 
          WHERE sc.id = sales_channel_id 
          AND sc.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
      )
      WITH CHECK (
        NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
        OR EXISTS (
          SELECT 1 FROM "sales_channel" sc 
          WHERE sc.id = sales_channel_id 
          AND sc.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
      );
    `);
  }

  async down(): Promise<void> {
    const table = 'publishable_api_key_sales_channel';
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
    this.addSql(`ALTER TABLE IF EXISTS "${table}" DISABLE ROW LEVEL SECURITY;`);
  }
}
