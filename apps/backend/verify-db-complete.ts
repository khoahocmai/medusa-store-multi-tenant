
const { Client, Pool } = require("pg");
require("dotenv").config();

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_NAME = "medusa_multi_tenant_verification_db";
const adminUrl = `postgres://postgres:postgres@${DB_HOST}:5432/${DB_NAME}`;
const runtimeUrl = `postgres://runtime_role:runtime_password@${DB_HOST}:5432/${DB_NAME}`;

// Simulate the hook installation
const { installRlsPgHook } = require("./src/utils/rls-pg-hook");
const { tenantContext } = require("./src/utils/tenant-context");

installRlsPgHook();

async function runTests() {
  const pool = new Pool({ connectionString: runtimeUrl, max: 2 });
  console.log("--- STARTING DEDICATED HOOK RACE & DIRTY POOL TESTS ---");

  // TEST: Successful query & PID lifecycle
  await tenantContext.run({ tenantId: "tenant_A", accessMode: "tenant" }, async () => {
    const client = await pool.connect();
    const res = await client.query("SELECT current_setting('app.current_tenant_id', true) as tenant, pg_backend_pid() as pid");
    console.log("Tenant A query:", res.rows[0]);
    client.release();
  });

  // Re-acquire to check clean state
  const client2 = await pool.connect();
  const res2 = await client2.query("SELECT current_setting('app.current_tenant_id', true) as tenant, pg_backend_pid() as pid");
  console.log("Reacquired client clean:", res2.rows[0]);

  // TEST: Failed query
  await tenantContext.run({ tenantId: "tenant_B", accessMode: "tenant" }, async () => {
    try {
      await client2.query("SELECT * FROM non_existent_table_xyz");
    } catch (e) {
      console.log("Query failed as expected.");
    }
  });
  const res3 = await client2.query("SELECT current_setting('app.current_tenant_id', true) as tenant");
  console.log("After failed query, tenant is:", res3.rows[0].tenant || "NULL");
  client2.release();

  // TEST: Callback Query
  await tenantContext.run({ tenantId: "tenant_C", accessMode: "tenant" }, async () => {
    const client3 = await pool.connect();
    await new Promise(resolve => {
      client3.query("SELECT current_setting('app.current_tenant_id', true) as tenant", (err, res) => {
        console.log("Callback query tenant:", res.rows[0].tenant);
        resolve();
      });
    });
    client3.release();
  });

  // TEST: Explicit Transaction & Rollback
  await tenantContext.run({ tenantId: "tenant_D", accessMode: "tenant" }, async () => {
    const client4 = await pool.connect();
    await client4.query("BEGIN");
    const r1 = await client4.query("SELECT current_setting('app.current_tenant_id', true) as tenant");
    console.log("In transaction:", r1.rows[0].tenant);
    await client4.query("ROLLBACK");
    client4.release();
  });

  // TEST: Concurrency
  const p1 = tenantContext.run({ tenantId: "tenant_X", accessMode: "tenant" }, async () => {
    const c = await pool.connect();
    const r = await c.query("SELECT current_setting('app.current_tenant_id', true) as tenant");
    c.release();
    return r.rows[0].tenant;
  });
  const p2 = tenantContext.run({ tenantId: "tenant_Y", accessMode: "tenant" }, async () => {
    const c = await pool.connect();
    const r = await c.query("SELECT current_setting('app.current_tenant_id', true) as tenant");
    c.release();
    return r.rows[0].tenant;
  });
  const concurrentResults = await Promise.all([p1, p2]);
  console.log("Concurrent execution contexts:", concurrentResults);

  // TEST: Platform GUC spoof test
  const adminClient = await pool.connect();
  try {
    await adminClient.query("SELECT set_config('app.is_platform_admin', 'true', false)");
    console.log("Spoofed platform admin GUC.");
  } catch (e) {
    console.log("Failed to spoof or harmless.");
  }
  adminClient.release();

  await pool.end();
  console.log("--- ALL TESTS COMPLETED ---");
}

runTests().catch(console.error);

