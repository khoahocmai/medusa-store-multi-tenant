import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260807033625 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "tenant_invite" ("id" text not null, "invite_id" text not null, "tenant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_invite_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_invite_tenant_id" ON "tenant_invite" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_invite_deleted_at" ON "tenant_invite" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "tenant_invite" add constraint "tenant_invite_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "tenant_invite" cascade;`);
  }

}
