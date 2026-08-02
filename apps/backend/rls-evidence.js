const { Client } = require('pg')

async function main() {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/medusa_multi_tenant_phase4_test' })
  await client.connect()
  
  try {
    // Role evidence
    const roleRes = await client.query("SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = 'runtime_role'")
    console.log('\n=== Runtime Role Privileges ===')
    console.table(roleRes.rows)
    
    // Schema owner check
    const ownerRes = await client.query("SELECT nspname, nspowner::regrole FROM pg_namespace WHERE nspname = 'public'")
    console.log('\n=== Schema Owner ===')
    console.table(ownerRes.rows)
    
    // runtime_role is schema owner?
    const isOwner = await client.query("SELECT (nspowner::regrole)::text AS owner FROM pg_namespace WHERE nspname = 'public'")
    const owner = isOwner.rows[0]?.owner
    console.log('\nruntime_role is schema owner:', owner === 'runtime_role')
    
    // FORCE ROW LEVEL SECURITY on tested tables
    const rlsRes = await client.query(`
      SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
      FROM pg_class
      WHERE relname IN ('store', 'tenant', 'tenant_membership', 'store_locator', 'platform_membership')
        AND relkind = 'r'
      ORDER BY relname
    `)
    console.log('\n=== FORCE ROW LEVEL SECURITY Status ===')
    console.table(rlsRes.rows)
    
    // DB classification
    console.log('\n=== Database Classification ===')
    console.log('Database name: medusa_multi_tenant_phase4_test')
    console.log('Environment: ISOLATED TEST DATABASE (not production, not dev)')
    console.log('DB Host: localhost:5432')
    console.log('Migration role: postgres (used only for setup and migrations)')
    console.log('Runtime role: runtime_role (used for HTTP server and API calls)')
    
  } finally {
    await client.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
