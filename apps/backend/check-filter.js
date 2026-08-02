const { resolve } = require("path");
const load = require("@medusajs/medusa/loaders/index").default;
const express = require("express");

async function run() {
  process.env.MEDUSA_SKIP_CORE_DEFAULTS = "true";
  process.env.DISABLE_MEDUSA_ADMIN = "true";
  const app = express();
  const { container } = await load({
    directory: resolve(__dirname, "../../"),
    expressApp: app
  });
  const tenantModule = container.resolve("tenant");
  const memberships = await tenantModule.listTenantMemberships({ actor_id: "fake" });
  console.log("Fake actor memberships length:", memberships.length);
  process.exit(0);
}
run();
