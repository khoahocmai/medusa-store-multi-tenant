import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260730033325 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "store_locator" drop constraint if exists "store_locator_domain_unique";`);
    this.addSql(`alter table if exists "tenant" drop constraint if exists "tenant_handle_unique";`);
    this.addSql(`create table if not exists "tenant" ("id" text not null, "name" text not null, "handle" text not null, "status" text check ("status" in ('active', 'inactive', 'pending')) not null default 'active', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_handle_unique" ON "tenant" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_deleted_at" ON "tenant" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "store_locator" ("id" text not null, "tenant_id" text not null, "store_id" text not null, "domain" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "store_locator_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_locator_tenant_id" ON "store_locator" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_store_locator_domain_unique" ON "store_locator" ("domain") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_locator_deleted_at" ON "store_locator" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant_membership" ("id" text not null, "actor_id" text not null, "tenant_id" text not null, "role" text check ("role" in ('owner', 'admin', 'member')) not null default 'member', "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_membership_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_membership_tenant_id" ON "tenant_membership" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_membership_deleted_at" ON "tenant_membership" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "store_locator" add constraint "store_locator_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table if exists "tenant_membership" add constraint "tenant_membership_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "store_locator" drop constraint if exists "store_locator_tenant_id_foreign";`);

    this.addSql(`alter table if exists "tenant_membership" drop constraint if exists "tenant_membership_tenant_id_foreign";`);

    this.addSql(`drop table if exists "tenant" cascade;`);

    this.addSql(`drop table if exists "store_locator" cascade;`);

    this.addSql(`drop table if exists "tenant_membership" cascade;`);
  }

}
