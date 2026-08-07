import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Baseline schema for the multi-tenant/platform module.
 *
 * Squashed from:
 * - Migration20260730033325
 * - Migration20260730043949
 * - Migration20260807033625
 *
 * This migration intentionally preserves the original table shapes,
 * indexes, enum-like CHECK constraints, and tenant foreign keys.
 */
export class Migration20260807160000_InitTenantSchema extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "tenant" (
        "id" text not null,
        "name" text not null,
        "handle" text not null,
        "status" text check ("status" in ('active', 'inactive', 'pending')) not null default 'active',
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "tenant_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_handle_unique" ON "tenant" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_deleted_at" ON "tenant" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`
      create table if not exists "store_locator" (
        "id" text not null,
        "tenant_id" text not null,
        "store_id" text not null,
        "domain" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "store_locator_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_locator_tenant_id" ON "store_locator" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_store_locator_domain_unique" ON "store_locator" ("domain") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_locator_deleted_at" ON "store_locator" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`
      create table if not exists "tenant_membership" (
        "id" text not null,
        "actor_id" text not null,
        "tenant_id" text not null,
        "role" text check ("role" in ('owner', 'admin', 'member')) not null default 'member',
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "tenant_membership_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_membership_tenant_id" ON "tenant_membership" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_membership_deleted_at" ON "tenant_membership" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`
      create table if not exists "platform_membership" (
        "id" text not null,
        "actor_id" text not null,
        "role" text check ("role" in ('superadmin', 'viewer')) not null default 'viewer',
        "is_active" boolean not null default true,
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "platform_membership_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_membership_actor_id_unique" ON "platform_membership" ("actor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_platform_membership_deleted_at" ON "platform_membership" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`
      create table if not exists "tenant_invite" (
        "id" text not null,
        "invite_id" text not null,
        "tenant_id" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "tenant_invite_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_invite_tenant_id" ON "tenant_invite" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_invite_deleted_at" ON "tenant_invite" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`
      ALTER TABLE "store_locator"
      DROP CONSTRAINT IF EXISTS "store_locator_tenant_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "store_locator"
      ADD CONSTRAINT "store_locator_tenant_id_foreign"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON UPDATE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE "tenant_membership"
      DROP CONSTRAINT IF EXISTS "tenant_membership_tenant_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "tenant_membership"
      ADD CONSTRAINT "tenant_membership_tenant_id_foreign"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON UPDATE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE "tenant_invite"
      DROP CONSTRAINT IF EXISTS "tenant_invite_tenant_id_foreign";
    `);
    this.addSql(`
      ALTER TABLE "tenant_invite"
      ADD CONSTRAINT "tenant_invite_tenant_id_foreign"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON UPDATE CASCADE;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "tenant_invite" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "platform_membership" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "tenant_membership" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "store_locator" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "tenant" CASCADE;`);
  }
}
