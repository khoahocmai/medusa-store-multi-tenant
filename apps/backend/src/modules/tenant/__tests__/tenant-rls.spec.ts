import { Pool } from 'pg';

describe('PostgreSQL RLS Tenant Isolation', () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let tenant1Id = 'tenant_1_' + Date.now();
  let tenant2Id = 'tenant_2_' + Date.now();
  
  beforeAll(async () => {
    // Admin pool to seed data bypassing RLS (superuser)
    adminPool = new Pool({
      connectionString: 'postgres://postgres:postgres@localhost:5432/medusa_multi_tenant'
    });

    // Seed some data
    await adminPool.query(`INSERT INTO "store" (id, name, tenant_id) VALUES ('store_1', 'Store 1', $1) ON CONFLICT DO NOTHING`, [tenant1Id]);
    await adminPool.query(`INSERT INTO "store" (id, name, tenant_id) VALUES ('store_2', 'Store 2', $1) ON CONFLICT DO NOTHING`, [tenant2Id]);

    // Runtime pool for application simulation
    runtimePool = new Pool({
      connectionString: 'postgres://runtime_role:runtime_password@localhost:5432/medusa_multi_tenant'
    });
  });

  afterAll(async () => {
    // Cleanup seeded data
    await adminPool.query(`DELETE FROM "store" WHERE tenant_id IN ($1, $2)`, [tenant1Id, tenant2Id]);
    await adminPool.end();
    await runtimePool.end();
  });

  it('denies read access when context is missing', async () => {
    const res = await runtimePool.query('SELECT * FROM "store" WHERE tenant_id = $1', [tenant1Id]);
    expect(res.rows.length).toBe(0);
  });

  it('allows read access when context is set', async () => {
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenant1Id]);
      const res = await client.query('SELECT * FROM "store" WHERE tenant_id = $1', [tenant1Id]);
      expect(res.rows.length).toBe(1);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  it('prevents cross-tenant reads', async () => {
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenant1Id]);
      const res = await client.query('SELECT * FROM "store" WHERE tenant_id = $1', [tenant2Id]);
      expect(res.rows.length).toBe(0);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  it('prevents context leak on rollback', async () => {
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenant1Id]);
      await client.query('ROLLBACK');

      // Now query should return 0 rows because context was rolled back
      const res = await client.query('SELECT * FROM "store" WHERE tenant_id = $1', [tenant1Id]);
      expect(res.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });

  it('allows platform admin explicitly', async () => {
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.is_platform_admin', 'true', true)`);
      const res = await client.query('SELECT * FROM "store" WHERE tenant_id = $1', [tenant1Id]);
      expect(res.rows.length).toBe(1);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });
});
