import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260804000000 extends Migration {
  async up(): Promise<void> {
    const result = await this.execute(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    const existingTables = result.map((r: any) => r.tablename);

    // =========================================================================
    // NHÓM 1: TENANT-OWNED TABLES (Dữ liệu sở hữu riêng biệt)
    // =========================================================================
    const tenantOwnedTables = [
      'product', 'product_variant', 'product_option', 'product_option_value', 'image',
      'customer', 'customer_address',
      'order', 'order_item', 'cart', 'line_item', 'order_change',
      'order_claim', 'order_edit', 'return', 'return_item', 'return_reason',
      'payment_collection', 'payment', 'refund',
      'fulfillment', 'fulfillment_item', 'fulfillment_set',
      'inventory_item', 'inventory_level', 'reservation_item',
      'store', 'sales_channel', 'stock_location',
      'price', 'price_set', 'money_amount',
      'promotion', 'campaign', 'discount',
      'notification', 'workflow_execution'
    ];

    // =========================================================================
    // NHÓM 2: SHARED TABLES (Dữ liệu dùng chung by Design)
    // =========================================================================
    const sharedTables = [
      'product_type', 'product_collection', 'product_category', 'product_tag',
      'customer_group', 'user', 'invite',
      'shipping_option', 'shipping_profile', 'shipping_method',
      'region', 'currency',
      'price_list', 'tax_rate', 'tax_provider',
      'api_key', 'publishable_api_key'
    ];

    for (const table of tenantOwnedTables) {
      if (!existingTables.includes(table)) {
        console.warn(`Table ${table} does not exist. Skipping RLS setup.`);
        continue;
      }

      this.addSql(`
        ALTER TABLE "${table}" 
        ADD COLUMN IF NOT EXISTS tenant_id text 
        DEFAULT NULLIF(current_setting('app.current_tenant_id', true), '');
      `);
      this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_${table}_tenant_id" ON "${table}" (tenant_id);`);
      this.addSql(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      this.addSql(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      this.addSql(`
        CREATE TRIGGER enforce_tenant_id_trigger
        BEFORE INSERT OR UPDATE ON "${table}"
        FOR EACH ROW
        EXECUTE FUNCTION enforce_tenant_id_trigger_fn();
      `);
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

    for (const table of sharedTables) {
      if (!existingTables.includes(table)) {
        console.warn(`Table ${table} does not exist. Skipping RLS setup.`);
        continue;
      }

      this.addSql(`
        ALTER TABLE "${table}" 
        ADD COLUMN IF NOT EXISTS tenant_id text 
        DEFAULT NULLIF(current_setting('app.current_tenant_id', true), '');
      `);
      this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_${table}_tenant_id" ON "${table}" (tenant_id);`);
      this.addSql(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      this.addSql(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
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

  async down(): Promise<void> {
    const result = await this.execute(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    const existingTables = result.map((r: any) => r.tablename);

    const allTables = [
      'product', 'product_variant', 'product_option', 'product_option_value', 'image',
      'customer', 'customer_address', 'order', 'order_item', 'cart', 'line_item', 'order_change',
      'order_claim', 'order_edit', 'return', 'return_item', 'return_reason', 'payment_collection', 'payment', 'refund',
      'fulfillment', 'fulfillment_item', 'fulfillment_set', 'inventory_item', 'inventory_level', 'reservation_item',
      'store', 'sales_channel', 'stock_location', 'price', 'price_set', 'money_amount', 'promotion', 'campaign', 'discount',
      'notification', 'workflow_execution',
      'product_type', 'product_collection', 'product_category', 'product_tag',
      'customer_group', 'user', 'invite', 'shipping_option', 'shipping_profile', 'shipping_method',
      'region', 'currency', 'price_list', 'tax_rate', 'tax_provider',
      'api_key', 'publishable_api_key'
    ];

    for (const table of allTables) {
      if (!existingTables.includes(table)) continue;
      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
      this.addSql(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
      this.addSql(`DROP INDEX IF EXISTS "IDX_${table}_tenant_id";`);
      this.addSql(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS tenant_id;`);
    }
  }
}
