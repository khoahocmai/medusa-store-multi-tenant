const { Client } = require('pg');

async function runAudit() {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/medusa_multi_tenant_phase5_test' });
  await client.connect();

  console.log("=== 1. Discover the exact physical tables ===");
  const tables = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname='public' AND (tablename LIKE '%product%' OR tablename LIKE '%order%')
    ORDER BY tablename;
  `);
  console.log("Found matching tables:", tables.rows.map(r => r.tablename).join(', '));

  console.log("\n=== 2. Inspect tenant columns (product, order) ===");
  for (const table of ['product', 'order']) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name=$1;
    `, [table]);
    
    console.log(`\nTable: ${table}`);
    if (cols.rows.length === 0) {
      console.log(`  Table not found or no columns.`);
      continue;
    }
    const tenantCol = cols.rows.find(c => c.column_name === 'tenant_id' || c.column_name.includes('tenant'));
    if (tenantCol) {
      console.log(`  Tenant column found: ${JSON.stringify(tenantCol)}`);
    } else {
      console.log(`  NO tenant_id column found.`);
    }

    const fks = await client.query(`
      SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name=$1;
    `, [table]);
    console.log(`  Foreign keys: ${JSON.stringify(fks.rows)}`);
  }

  console.log("\n=== 3. Inspect RLS configuration ===");
  for (const table of ['product', 'order']) {
    const rls = await client.query(`
      SELECT relowner::regrole as owner, relrowsecurity, relforcerowsecurity 
      FROM pg_class 
      WHERE relname=$1;
    `, [table]);
    console.log(`\nTable: ${table} RLS config:`, rls.rows[0]);

    const policies = await client.query(`
      SELECT polname, polroles, polcmd, polqual, polwithcheck 
      FROM pg_policy 
      WHERE polrelid = $1::regclass;
    `, [table]);
    console.log(`  Policies:`, policies.rows);
    
    const triggers = await client.query(`
      SELECT tgname 
      FROM pg_trigger 
      WHERE tgrelid = $1::regclass AND tgisinternal = false;
    `, [table]);
    console.log(`  Triggers:`, triggers.rows);
  }

  const role = await client.query(`
    SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb 
    FROM pg_roles 
    WHERE rolname='runtime_role';
  `);
  console.log(`\nruntime_role attributes:`, role.rows[0]);

  console.log("\n=== 4. Inspect the actual inserted fixtures ===");
  const stores = await client.query(`SELECT * FROM store LIMIT 5;`);
  console.log("Store rows (count):", stores.rows.length);
  if (stores.rows.length > 0) {
      const s = stores.rows[0];
      console.log("Sample Store:", {
          id: s.id,
          tenant_id: s.tenant_id
      });
  }

  const customers = await client.query(`SELECT * FROM customer LIMIT 5;`);
  console.log("Customer rows (count):", customers.rows.length);
  if (customers.rows.length > 0) {
      const c = customers.rows[0];
      console.log("Sample Customer:", {
          id: c.id,
          tenant_id: c.tenant_id
      });
  }

  await client.end();
}

runAudit().catch(console.error);
