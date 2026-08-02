const { Client } = require('pg');
const { tenantContext } = require('./src/utils/tenant-context');
require('./src/utils/rls-pg-hook'); // This patches the pg Client

async function runRuntimeAudit() {
  const connectionString = 'postgres://runtime_role:runtime_password@localhost:5432/medusa_multi_tenant_phase5_test';
  
  const client = new Client({ connectionString });
  await client.connect();

  const tenant1 = { id: 'test_tenant_A' }; // Placeholder, we don't know real ID, but we can just use a dummy context

  await tenantContext.run({ tenantId: tenant1.id, accessMode: "tenant" }, async () => {
    // We must manually start a transaction to trigger the hook, because the hook intercepts BEGIN
    await client.query('BEGIN');
    
    console.log("=== 5. Prove runtime context on the same connection ===");
    console.log("Context: Tenant A");
    const userRes = await client.query('SELECT current_user');
    const settingRes = await client.query(`SELECT current_setting('app.current_tenant_id', true) as tenant_setting`);
    const isPlatformAdminRes = await client.query(`SELECT current_setting('app.is_platform_admin', true) as platform_setting`);
    const txidRes = await client.query('SELECT txid_current()');
    
    console.log("current_user:", userRes.rows[0].current_user);
    console.log("app.current_tenant_id:", settingRes.rows[0].tenant_setting);
    console.log("app.is_platform_admin:", isPlatformAdminRes.rows[0].platform_setting);
    console.log("txid_current:", txidRes.rows[0].txid_current);
    
    // Now query the product table
    const products = await client.query('SELECT id, tenant_id FROM product LIMIT 1');
    console.log("Query 'SELECT * FROM product LIMIT 1':", products.rows);

    await client.query('ROLLBACK');
  });

  await client.end();
}

runRuntimeAudit().catch(console.error);
