import axios from "axios"
import { execSync } from "child_process"
import { resolve } from "path"
import { Client } from "pg"
import jwt from "jsonwebtoken"

const DB_HOST = process.env.DB_HOST || "localhost"
const TEST_DB_NAME = "medusa_multi_tenant_smoke_db"
const DB_PORT = process.env.DB_PORT || 5432
const TEST_DB_ADMIN_URL = `postgres://postgres:postgres@${DB_HOST}:${DB_PORT}/postgres`
const MIGRATION_ROLE_URL = `postgres://postgres:postgres@${DB_HOST}:${DB_PORT}/${TEST_DB_NAME}`
const RUNTIME_ROLE_URL = `postgres://runtime_role:runtime_password@${DB_HOST}:${DB_PORT}/${TEST_DB_NAME}`
const PORT = 9009 

jest.setTimeout(180000)

const getHeaders = (actorId: string, tenantId?: string, extraHeaders: any = {}, invalidToken = false) => {
  const jwtSecret = process.env.JWT_SECRET || "supersecret"
  const token = jwt.sign({ actor_id: actorId, actor_type: "user" }, invalidToken ? "wrong-secret" : jwtSecret)
  const headers: any = {
    "x-actor-id": actorId,
    "authorization": `Bearer ${token}`,
    ...extraHeaders
  }
  if (tenantId) headers["x-tenant-id"] = tenantId
  return headers
}

describe("UAT Multi-Tenant Smoke Tests", () => {
  let server: any
  let container: any
  let api: any
  
  const platformAdminId = "smoke_platform_admin_" + Date.now()
  const tenant1AdminId = "smoke_tenant1_admin_" + Date.now()
  const tenant2AdminId = "smoke_tenant2_admin_" + Date.now()
  
  let tenant1: any
  let tenant2: any
  
  beforeAll(async () => {
    // 1. Create DB
    const adminClient = new Client({ connectionString: TEST_DB_ADMIN_URL })
    await adminClient.connect()
    try {
      await adminClient.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`)
      await adminClient.query(`CREATE DATABASE ${TEST_DB_NAME}`)
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${TEST_DB_NAME} TO runtime_role`)
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${TEST_DB_NAME} TO postgres`)
    } finally {
      await adminClient.end()
    }

    // 2. Migrate
    execSync(`npx medusa db:migrate`, {
      env: { ...process.env, DB_URL: MIGRATION_ROLE_URL, DATABASE_URL: MIGRATION_ROLE_URL },
      cwd: resolve(__dirname, "../../")
    })

    // 3. Grant
    const grantClient = new Client({ connectionString: MIGRATION_ROLE_URL })
    await grantClient.connect()
    try {
      await grantClient.query(`GRANT USAGE ON SCHEMA public TO runtime_role`)
      await grantClient.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO runtime_role`)
      await grantClient.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO runtime_role`)
    } finally {
      await grantClient.end()
    }

    // 4. Boot App
    process.env.MEDUSA_SKIP_CORE_DEFAULTS = "true"
    process.env.DB_URL = RUNTIME_ROLE_URL
    process.env.DATABASE_URL = RUNTIME_ROLE_URL
    process.env.DISABLE_MEDUSA_ADMIN = "true"
    process.env.JWT_SECRET = "supersecret"

    const express = require("express")
    const app = express()

    const load = require("@medusajs/medusa/loaders/index").default
    const result = await load({
      directory: resolve(__dirname, "../../"),
      expressApp: app
    })
    container = result.container
    server = app.listen(PORT)

    api = axios.create({
      baseURL: `http://localhost:${PORT}`,
      validateStatus: () => true
    })

    // 5. Seed basic data (Platform Admin, Tenant 1 & 2)
    const t1Email = `t1admin_${Date.now()}@test.com`
    const t2Email = `t2admin_${Date.now()}@test.com`
    const userModuleService = container.resolve("user")
    await userModuleService.createUsers([
      { id: platformAdminId, email: `platform_${Date.now()}@test.com` },
      { id: tenant1AdminId, email: t1Email },
      { id: tenant2AdminId, email: t2Email }
    ])

    const tenantModuleService = container.resolve("tenant")
    await tenantModuleService.createPlatformMemberships({ actor_id: platformAdminId, is_active: true })
    
    let res = await api.post("/admin/platform/tenants", {
      name: "Smoke Tenant 1",
      handle: "smoke-tenant-1",
      admin_email: t1Email,
      admin_password: "password",
      initial_admin_actor_id: tenant1AdminId
    }, { headers: getHeaders(platformAdminId) })
    tenant1 = res.data.tenant

    res = await api.post("/admin/platform/tenants", {
      name: "Smoke Tenant 2",
      handle: "smoke-tenant-2",
      admin_email: t2Email,
      admin_password: "password",
      initial_admin_actor_id: tenant2AdminId
    }, { headers: getHeaders(platformAdminId) })
    tenant2 = res.data.tenant
  })

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
  })

  it("should assert runtime_role is not superuser and cannot bypass RLS", async () => {
    const { ContainerRegistrationKeys } = require("@medusajs/framework/utils")
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const { rows: roles } = await knex.raw(`
      SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname = current_user;
    `)
    expect(roles[0].rolsuper).toBe(false)
    expect(roles[0].rolbypassrls).toBe(false)
    expect(roles[0].current_user).toBe("runtime_role")
  })

  it("should assert patch integrity check", () => {
    const fs = require("fs")
    const path = require("path")
    const file = fs.readFileSync(path.resolve(__dirname, "../../../../node_modules/@medusajs/framework/dist/http/utils/wrap-handler.js"), "utf8")
    expect(file).toContain("executeInTenantTransaction")
  })

  it("should block requests with invalid JWT (401)", async () => {
    const res = await api.get("/admin/tenant/current", {
      headers: getHeaders(tenant1AdminId, tenant1.id, {}, true) // true for invalid token
    })
    expect(res.status).toBe(401)
  })

  it("should reject x-actor-id fallback without JWT", async () => {
    const res = await api.get("/admin/products", {
      headers: { "x-actor-id": tenant1AdminId, "x-tenant-id": tenant1.id }
    })
    // Without JWT, auth_context is not populated, so it should be 401
    expect(res.status).toBe(401)
  })

  it("should allow /admin/users/me without tenant header (Bootstrap)", async () => {
    const res = await api.get("/admin/users/me", {
      headers: getHeaders(tenant1AdminId)
    })
    // 404 is fine (if route doesn't exist/mocked), just shouldn't be 400 or 403 from our middleware
    expect(res.status).not.toBe(400)
    expect(res.status).not.toBe(403)
  })

  it("should allow /admin/users/me/ and with query string", async () => {
    const res = await api.get("/admin/users/me/?fields=id", {
      headers: getHeaders(tenant1AdminId)
    })
    // Validation might fail if param isn't allowed, but we mainly care that it's not blocked by our middleware
    expect(res.status).not.toBe(403)
  })

  it("should block /admin/users (user-management)", async () => {
    const res = await api.get("/admin/users", {
      headers: getHeaders(tenant1AdminId)
    })
    // MedusaError.Types.NOT_ALLOWED often maps to 400 in Medusa framework
    expect([400, 403]).toContain(res.status) 
    expect(res.data.message).toContain("Route temporarily blocked")
  })

  it("should auto-resolve if missing tenant context and actor has 1 tenant", async () => {
    const res = await api.post("/admin/products", {
      title: "Auto-resolve T1 Product",
      options: [{ title: "Default", values: ["Default"] }]
    }, { headers: getHeaders(tenant1AdminId) })
    expect(res.status).toBe(200)
    expect(res.data.product.id).toBeDefined()
  })

  it("should block if missing tenant context and actor has 0 tenants", async () => {
    const noTenantActorId = "actor_" + Date.now()
    const res = await api.get("/admin/products", {
      headers: getHeaders(noTenantActorId)
    })
    expect(res.status).toBe(400) // mapped from NOT_ALLOWED MedusaError by Express
    expect(res.data.message).toContain("Not a member of any tenant")
  })

  it("should require tenant selection (409/400) if actor has > 1 tenants", async () => {
    const tenantModuleService = container.resolve("tenant")
    await tenantModuleService.createTenantMemberships({ tenant_id: tenant1.id, actor_id: tenant2AdminId, is_active: true })
    
    const res = await api.get("/admin/products", {
      headers: getHeaders(tenant2AdminId)
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain("TENANT_SELECTION_REQUIRED")
  })

  it("should block spoofed tenant headers (403)", async () => {
    // Tenant 1 admin tries to access Tenant 2
    const res = await api.get("/admin/tenant/current", {
      headers: getHeaders(tenant1AdminId, tenant2.id)
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain("Not a member of this tenant")
  })

  it("should strictly isolate data (List, Direct ID, Update, Delete)", async () => {
    // 1. T1 creates a product
    let res = await api.post("/admin/products", {
      title: "T1 Product",
      options: [{ title: "Default", values: ["Default"] }]
    }, { headers: getHeaders(tenant1AdminId, tenant1.id) })
    expect(res.status).toBe(200)
    const t1Product = res.data.product
    expect(t1Product.id).toBeDefined()

    // 2. T2 creates a product
    res = await api.post("/admin/products", {
      title: "T2 Product",
      options: [{ title: "Default", values: ["Default"] }]
    }, { headers: getHeaders(tenant2AdminId, tenant2.id) })
    expect(res.status).toBe(200)
    const t2Product = res.data.product

    // 3. T1 lists products, should only see T1 Products
    res = await api.get("/admin/products", { headers: getHeaders(tenant1AdminId, tenant1.id) })
    
    const products = res.data.products
    expect(products.find((p: any) => p.id === t1Product.id)).toBeDefined()
    expect(products.find((p: any) => p.id === t2Product.id)).toBeUndefined()

    // 4. T2 tries to fetch T1 Product by direct ID
    res = await api.get(`/admin/products/${t1Product.id}`, { headers: getHeaders(tenant2AdminId, tenant2.id) })
    expect(res.status).toBe(404)

    // 5. T2 tries to update T1 Product
    res = await api.post(`/admin/products/${t1Product.id}`, {
      title: "Hacked by T2"
    }, { headers: getHeaders(tenant2AdminId, tenant2.id) })
    expect(res.status).toBe(404)

    // 6. T2 tries to delete T1 Product
    res = await api.delete(`/admin/products/${t1Product.id}`, { headers: getHeaders(tenant2AdminId, tenant2.id) })
    // Medusa deletes often return 200 with deleted: true if entity not found depending on implementation, but RLS will prevent actual deletion
    // We check if T1 Product still exists for T1
    res = await api.get(`/admin/products/${t1Product.id}`, { headers: getHeaders(tenant1AdminId, tenant1.id) })
    expect(res.status).toBe(200)
    expect(res.data.product.id).toBe(t1Product.id)
  })

  it("should prevent pool leakage under highly parallel concurrent requests", async () => {
    // We fire 50 requests for T1 and 50 for T2 concurrently.
    const requests: Promise<any>[] = []
    
    for (let i = 0; i < 50; i++) {
      requests.push(
        api.post("/admin/products", {
          title: `Concurrent T1 ${i}`,
          options: [{ title: "Default", values: ["Default"] }]
        }, { headers: getHeaders(tenant1AdminId, tenant1.id) })
      )
      requests.push(
        api.post("/admin/products", {
          title: `Concurrent T2 ${i}`,
          options: [{ title: "Default", values: ["Default"] }]
        }, { headers: getHeaders(tenant2AdminId, tenant2.id) })
      )
    }

    await Promise.all(requests)

    // Check count for T1
    const res1 = await api.get("/admin/products?limit=100", { headers: getHeaders(tenant1AdminId, tenant1.id) })
    expect(res1.data.products.filter((p: any) => p.title.startsWith("Concurrent T1")).length).toBe(50)
    expect(res1.data.products.filter((p: any) => p.title.startsWith("Concurrent T2")).length).toBe(0)

    // Check count for T2
    const res2 = await api.get("/admin/products?limit=100", { headers: getHeaders(tenant2AdminId, tenant2.id) })
    expect(res2.data.products.filter((p: any) => p.title.startsWith("Concurrent T2")).length).toBe(50)
    expect(res2.data.products.filter((p: any) => p.title.startsWith("Concurrent T1")).length).toBe(0)
  })

  it("should allow platform admin to impersonate tenant A", async () => {
    // Platform admin does NOT have a TenantMembership to Tenant 2
    // But they have a PlatformMembership
    // They provide x-tenant-id = tenant2.id
    const res = await api.get("/admin/products", { headers: getHeaders(platformAdminId, tenant2.id) })
    
    // Should succeed and ONLY see T2 products
    expect(res.status).toBe(200)
    const products = res.data.products
    expect(products.length).toBeGreaterThan(0)
    expect(products.every((p: any) => p.title.startsWith("Concurrent T2") || p.title === "T2 Product")).toBe(true)
  })

  it("should allow platform admin to access platform routes", async () => {
    const res = await api.get("/admin/platform/tenants", { headers: getHeaders(platformAdminId) })
    // Returns 200 because GET is actually implemented
    expect(res.status).toBe(200)
  })

  it("should reject tenant admin from accessing platform routes", async () => {
    const res = await api.get("/admin/platform/tenants", { headers: getHeaders(tenant1AdminId) })
    expect(res.status).toBe(400) // Mapped from NOT_ALLOWED
    expect(res.data.message).toContain("Not a platform admin")
  })
})
