const { Client, Pool } = require("pg");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_NAME = "medusa_multi_tenant_verification_db";

async function main() {
  console.log("Creating database...");
  const adminUrl = `postgres://postgres:postgres@${DB_HOST}:5432/postgres`;
  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();
  
  try {
    const res = await adminClient.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`, [DB_NAME]);
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${DB_NAME}`);
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO runtime_role`);
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO postgres`);
      console.log("Database created.");
    } else {
      console.log("Database already exists. Skipping creation.");
    }
  } finally {
    await adminClient.end();
  }

  console.log("\n--- SAME-CONNECTION CONTEXT PROOF ---");
  const runtimeUrl = `postgres://runtime_role:runtime_password@${DB_HOST}:5432/${DB_NAME}`;
  const pool = new Pool({ connectionString: runtimeUrl, max: 1 });
  
  const client = await pool.connect();
  console.log("Acquired connection from pool.");
  
  // 1. Initial State
  let res = await client.query(`SELECT current_user, pg_backend_pid(), current_setting('app.current_tenant_id', true) as tenant`);
  console.log(`Initial state: user=${res.rows[0].current_user}, pid=${res.rows[0].pg_backend_pid}, tenant=${res.rows[0].tenant || "NULL"}`);
  
  // 2. Set Context
  await client.query(`SELECT set_config('app.current_tenant_id', 'tenant_A', false)`);
  res = await client.query(`SELECT current_user, pg_backend_pid(), current_setting('app.current_tenant_id', true) as tenant`);
  console.log(`After set_config: user=${res.rows[0].current_user}, pid=${res.rows[0].pg_backend_pid}, tenant=${res.rows[0].tenant || "NULL"}`);
  
  // 3. Clear Context
  await client.query(`SELECT set_config('app.current_tenant_id', '', false)`);
  res = await client.query(`SELECT current_user, pg_backend_pid(), current_setting('app.current_tenant_id', true) as tenant`);
  console.log(`After reset: user=${res.rows[0].current_user}, pid=${res.rows[0].pg_backend_pid}, tenant=${res.rows[0].tenant || "NULL"}`);
  
  client.release();
  console.log("Released connection.");
  
  // 4. Reacquire and check
  const client2 = await pool.connect();
  res = await client2.query(`SELECT pg_backend_pid(), current_setting('app.current_tenant_id', true) as tenant`);
  console.log(`Reacquired connection: pid=${res.rows[0].pg_backend_pid}, tenant=${res.rows[0].tenant || "NULL"}`);
  client2.release();
  await pool.end();
  
  console.log("\n--- MIGRATION ROLE SAFETY ---");
  const rPool = new Pool({ connectionString: runtimeUrl, max: 1 });
  try {
    const c = await rPool.query("SELECT current_user");
    console.log(`Executing as: ${c.rows[0].current_user}`);
    
    // Check if member of migration_role
    try {
      await rPool.query("SET ROLE migration_role");
      console.log("FAILURE: runtime_role was able to SET ROLE migration_role!");
    } catch(e) {
      console.log("SUCCESS: runtime_role cannot SET ROLE migration_role. Error:", e.message);
    }
    
    // Check superuser
    const su = await rPool.query("SELECT usesuper, usebypassrls FROM pg_user WHERE usename = 'runtime_role'");
    console.log(`runtime_role usesuper=${su.rows[0].usesuper}, usebypassrls=${su.rows[0].usebypassrls}`);
    
  } finally {
    await rPool.end();
  }
}

main().catch(console.error);
