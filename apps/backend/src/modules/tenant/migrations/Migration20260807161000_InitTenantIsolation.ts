import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Final tenant isolation baseline.
 *
 * Squashed from the successive RLS/trigger migrations:
 * - Migration20260730040000
 * - Migration20260802000000
 * - Migration20260803000000
 * - Migration20260804000000
 * - Migration20260807141703
 *
 * IMPORTANT:
 * - Strict tables are tenant-owned and fail closed.
 * - invite/api_key/publishable_api_key intentionally keep the final
 *   shared-table behavior from the original migrations.
 * - user is intentionally excluded and handled by the special-policy migration.
 */
export class Migration20260807161000_InitTenantIsolation extends Migration {
  override async up(): Promise<void> {
    const result = await this.execute(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);
    const existingTables = result.map((row: any) => row.tablename);

    // Final strict-isolation set after Migration20260807141703 moved the
    // taxonomy/config tables out of the original shared group.
    const strictTenantTables = [
      // Product
      "product",
      "product_variant",
      "product_option",
      "product_option_value",
      "image",

      // Product taxonomy (strict in the final state)
      "product_type",
      "product_collection",
      "product_category",
      "product_tag",

      // Customer
      "customer",
      "customer_address",
      "customer_group",

      // Order / Cart / Return
      "order",
      "order_item",
      "cart",
      "line_item",
      "order_change",
      "order_claim",
      "order_edit",
      "return",
      "return_item",
      "return_reason",

      // Payment
      "payment_collection",
      "payment",
      "refund",

      // Fulfillment
      "fulfillment",
      "fulfillment_item",
      "fulfillment_set",

      // Inventory
      "inventory_item",
      "inventory_level",
      "reservation_item",

      // Store / Sales
      "store",
      "sales_channel",
      "stock_location",

      // Pricing
      "price",
      "price_set",
      "money_amount",
      "price_list",

      // Promotion
      "promotion",
      "campaign",
      "discount",

      // Region / Tax / Currency (strict in the final state)
      "region",
      "currency",
      "tax_rate",
      "tax_provider",

      // Shipping (strict in the final state)
      "shipping_option",
      "shipping_profile",
      "shipping_method",

      // System
      "notification",
      "workflow_execution",
    ];

    // These remain shared in the final state of the original migration chain.
    // A NULL tenant_id means globally shared; otherwise access is limited to
    // the current tenant. No enforcement trigger is attached to this group.
    const sharedTables = ["invite", "api_key", "publishable_api_key"];

    // Final trigger implementation from Migration20260803000000:
    // - runtime_role must always have tenant context;
    // - INSERT gets tenant_id from context;
    // - UPDATE cannot move a row across tenants or rewrite tenant_id.
    this.addSql(`
      CREATE OR REPLACE FUNCTION enforce_tenant_id_trigger_fn()
      RETURNS trigger AS $$
      DECLARE
        ctx_tenant_id text;
      BEGIN
        ctx_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '');

        IF ctx_tenant_id IS NULL AND current_user = 'runtime_role' THEN
          RAISE EXCEPTION 'Missing tenant context for operation on %', TG_TABLE_NAME;
        END IF;

        IF TG_OP = 'INSERT' THEN
          IF ctx_tenant_id IS NOT NULL THEN
            NEW.tenant_id := ctx_tenant_id;
          END IF;
        ELSIF TG_OP = 'UPDATE' THEN
          IF current_user = 'runtime_role' THEN
            IF OLD.tenant_id IS NULL THEN
              RAISE EXCEPTION 'Cannot update legacy record with NULL tenant_id on %', TG_TABLE_NAME;
            END IF;

            IF ctx_tenant_id IS NOT NULL AND ctx_tenant_id != OLD.tenant_id THEN
              RAISE EXCEPTION 'Cannot cross-update record from tenant % to % on %', OLD.tenant_id, ctx_tenant_id, TG_TABLE_NAME;
            END IF;
          END IF;

          NEW.tenant_id := OLD.tenant_id;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    for (const table of strictTenantTables) {
      if (!existingTables.includes(table)) {
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

      // Preserve the original final shared-table behavior: no enforcement trigger.
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

  override async down(): Promise<void> {
    const result = await this.execute(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);
    const existingTables = result.map((row: any) => row.tablename);

    const strictTenantTables = [
      "product", "product_variant", "product_option", "product_option_value", "image",
      "product_type", "product_collection", "product_category", "product_tag",
      "customer", "customer_address", "customer_group",
      "order", "order_item", "cart", "line_item", "order_change",
      "order_claim", "order_edit", "return", "return_item", "return_reason",
      "payment_collection", "payment", "refund",
      "fulfillment", "fulfillment_item", "fulfillment_set",
      "inventory_item", "inventory_level", "reservation_item",
      "store", "sales_channel", "stock_location",
      "price", "price_set", "money_amount", "price_list",
      "promotion", "campaign", "discount",
      "region", "currency", "tax_rate", "tax_provider",
      "shipping_option", "shipping_profile", "shipping_method",
      "notification", "workflow_execution",
    ];

    const sharedTables = ["invite", "api_key", "publishable_api_key"];

    for (const table of [...strictTenantTables, ...sharedTables]) {
      if (!existingTables.includes(table)) {
        continue;
      }

      this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "${table}";`);
      this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";`);
      this.addSql(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
      this.addSql(`DROP INDEX IF EXISTS "IDX_${table}_tenant_id";`);
      this.addSql(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS tenant_id;`);
    }

    this.addSql(`DROP FUNCTION IF EXISTS enforce_tenant_id_trigger_fn();`);
  }
}
