import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260730043949 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "platform_membership" drop constraint if exists "platform_membership_actor_id_unique";`);
    this.addSql(`create table if not exists "platform_membership" ("id" text not null, "actor_id" text not null, "role" text check ("role" in ('superadmin', 'viewer')) not null default 'viewer', "is_active" boolean not null default true, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "platform_membership_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_membership_actor_id_unique" ON "platform_membership" ("actor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_platform_membership_deleted_at" ON "platform_membership" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "platform_membership" cascade;`);
  }

}
