const { Client } = require("pg")

async function testPlatformAdminSpoof() {
  const DB_HOST = process.env.DB_HOST || "localhost"
  const client = new Client({ connectionString: `postgres://runtime_role:runtime_password@${DB_HOST}:5432/medusa_multi_tenant_root_cause_test` })
  await client.connect()
  try {
    await client.query(`SELECT set_config('app.is_platform_admin', 'true', false)`)
    console.log("SPOOF SUCCESSFUL!")
    const res = await client.query(`SELECT current_setting('app.is_platform_admin', true) as val`)
    console.log("Current value:", res.rows[0].val)
  } catch(e) {
    console.error("SPOOF FAILED:", e.message)
  } finally {
    await client.end()
  }
}

testPlatformAdminSpoof()
