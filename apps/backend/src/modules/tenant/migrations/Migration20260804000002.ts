import { Migration } from '@mikro-orm/migrations';

export class Migration20260804000002 extends Migration {

  async up(): Promise<void> {
    // 1. Xoá bỏ Trigger và Policy cũ
    this.addSql(`DROP TRIGGER IF EXISTS enforce_tenant_id_trigger ON "user";`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user";`);

    // 2. Xoá bỏ cột tenant_id
    this.addSql(`DROP INDEX IF EXISTS "IDX_user_tenant_id";`);
    this.addSql(`ALTER TABLE "user" DROP COLUMN IF EXISTS tenant_id;`);

    // 3. Đảm bảo RLS vẫn bật trên bảng user
    this.addSql(`ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`ALTER TABLE "user" FORCE ROW LEVEL SECURITY;`);

    // 4. Tạo Policy cho SELECT
    this.addSql(`
      CREATE POLICY "tenant_isolation_policy_select" ON "user"
      AS PERMISSIVE FOR SELECT
      TO runtime_role
      USING (
        (NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
        OR
        EXISTS (
          SELECT 1 FROM "tenant_membership" tm
          WHERE tm.actor_id = "user".id
            AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            AND tm.deleted_at IS NULL
        )
      );
    `);

    // 5. Tạo Policy cho UPDATE
    this.addSql(`
      CREATE POLICY "tenant_isolation_policy_update" ON "user"
      AS PERMISSIVE FOR UPDATE
      TO runtime_role
      USING (
        (NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
        OR
        EXISTS (
          SELECT 1 FROM "tenant_membership" tm
          WHERE tm.actor_id = "user".id
            AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            AND tm.deleted_at IS NULL
        )
      )
      WITH CHECK (
        (NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
        OR
        EXISTS (
          SELECT 1 FROM "tenant_membership" tm
          WHERE tm.actor_id = "user".id
            AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            AND tm.deleted_at IS NULL
        )
      );
    `);

    // 6. Tạo Policy cho DELETE
    this.addSql(`
      CREATE POLICY "tenant_isolation_policy_delete" ON "user"
      AS PERMISSIVE FOR DELETE
      TO runtime_role
      USING (
        (NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
        OR
        EXISTS (
          SELECT 1 FROM "tenant_membership" tm
          WHERE tm.actor_id = "user".id
            AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            AND tm.deleted_at IS NULL
        )
      );
    `);

    // 7. Tạo Policy cho INSERT (Cho phép tạo Identity Global)
    this.addSql(`
      CREATE POLICY "tenant_isolation_policy_insert" ON "user"
      AS PERMISSIVE FOR INSERT
      TO runtime_role
      WITH CHECK ( true );
    `);
  }

  async down(): Promise<void> {
    // 1. Xoá bỏ Policy mới
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_select" ON "user";`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_update" ON "user";`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_delete" ON "user";`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation_policy_insert" ON "user";`);

    // 2. Thêm lại cột tenant_id
    this.addSql(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS tenant_id text;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_user_tenant_id" ON "user" ("tenant_id") WHERE deleted_at IS NULL;`);

    // 3. Khôi phục Policy cũ (nhóm Shared Table)
    this.addSql(`
      CREATE POLICY "tenant_isolation_policy" ON "user"
      AS PERMISSIVE FOR ALL
      TO runtime_role
      USING (
        tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
      )
      WITH CHECK (
        tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
      );
    `);

    // 4. Khôi phục Trigger
    this.addSql(`
      CREATE TRIGGER enforce_tenant_id_trigger
      BEFORE INSERT ON "user"
      FOR EACH ROW
      EXECUTE FUNCTION enforce_tenant_id_trigger_fn();
    `);
  }
}
