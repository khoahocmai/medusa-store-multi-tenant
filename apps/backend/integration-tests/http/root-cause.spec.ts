import { resolve } from "path"
import { Client } from "pg"
import { tenantContext } from "../../src/utils/tenant-context"
import { installRlsPgHook } from "../../src/utils/rls-pg-hook"

installRlsPgHook()

jest.setTimeout(60000)

const DB_HOST = process.env.DB_HOST || "localhost"
const TEST_DB_NAME = "medusa_multi_tenant_root_cause_test"
const TEST_DB_ADMIN_URL = `postgres://postgres:postgres@${DB_HOST}:5432/postgres`
const MIGRATION_ROLE_URL = `postgres://postgres:postgres@${DB_HOST}:5432/${TEST_DB_NAME}`
const RUNTIME_ROLE_URL = `postgres://runtime_role:runtime_password@${DB_HOST}:5432/${TEST_DB_NAME}`

// We need to patch pg to log all queries
const pg = require("pg")
const originalQuery = pg.Client.prototype.query

let connectionIdCounter = 0
const connectionIds = new WeakMap()

pg.Client.prototype.query = function(configOrText: any, ...rest: any[]) {
  if (!connectionIds.has(this)) {
    connectionIds.set(this, ++connectionIdCounter)
  }
  const cid = connectionIds.get(this)
  
  const text = typeof configOrText === "string" ? configOrText : (configOrText?.text ?? "")
  const values = typeof configOrText === "string" ? rest[0] : (configOrText?.values ?? [])
  
  if (
    /^\s*INSERT INTO "(product|order|store|customer)"/i.test(text) ||
    /^\s*(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)/i.test(text) ||
    /^\s*SELECT set_config/i.test(text)
  ) {
    console.log(`[Conn ${cid}] SQL:`, text.substring(0, 200).replace(/\n/g, " "), "| VALUES:", values)
  }
  
  return originalQuery.call(this, configOrText, ...rest)
}

describe("Root Cause Analysis", () => {
  let server: any
  let container: any
  let productModule: any
  let orderModule: any
  let customerModule: any
  let storeModule: any
  let tenant1Id = "tenant_test_123"

  beforeAll(async () => {
    const adminClient = new Client({ connectionString: TEST_DB_ADMIN_URL })
    await adminClient.connect()
    try {
      await adminClient.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`)
      await adminClient.query(`CREATE DATABASE ${TEST_DB_NAME}`)
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${TEST_DB_NAME} TO runtime_role`)
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${TEST_DB_NAME} TO postgres`)
    } finally {
      await adminClient.end()
    }

    const { execSync } = require("child_process")
    execSync(`npx medusa db:migrate`, {
      env: { ...process.env, DB_URL: MIGRATION_ROLE_URL, DATABASE_URL: MIGRATION_ROLE_URL },
      stdio: "inherit",
      cwd: resolve(__dirname, "../../")
    })

    const grantClient = new Client({ connectionString: MIGRATION_ROLE_URL })
    await grantClient.connect()
    try {
      await grantClient.query(`GRANT USAGE ON SCHEMA public TO runtime_role`)
      await grantClient.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO runtime_role`)
      await grantClient.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO runtime_role`)
    } finally {
      await grantClient.end()
    }

    process.env.MEDUSA_SKIP_CORE_DEFAULTS = "true"
    process.env.DB_URL = RUNTIME_ROLE_URL
    process.env.DATABASE_URL = RUNTIME_ROLE_URL
    process.env.DISABLE_MEDUSA_ADMIN = "true"

    const express = require("express")
    const app = express()

    const load = require("@medusajs/medusa/loaders/index").default
    const result = await load({
      directory: resolve(__dirname, "../../"),
      expressApp: app
    })
    container = result.container
    server = app.listen(9009)

    productModule = container.resolve("product")
    orderModule = container.resolve("order")
    customerModule = container.resolve("customer")
    storeModule = container.resolve("store")
  })

  afterAll((done) => {
    if (server) {
      server.close(done)
    } else {
      done()
    }
  })

  it("captures SQL for Product", async () => {
    await tenantContext.run({ tenantId: tenant1Id, accessMode: "tenant" }, async () => {
      console.log("--- START PRODUCT CREATE ---")
      try {
        await productModule.createProducts([{
          title: "Test Product",
          options: [{ title: "Size", values: ["One Size"] }]
        }])
      } catch (e) {
        console.error("Product create failed:", e.message)
      }
      console.log("--- END PRODUCT CREATE ---")
    })
  })

  it("captures SQL for Order", async () => {
    await tenantContext.run({ tenantId: tenant1Id, accessMode: "tenant" }, async () => {
      console.log("--- START ORDER CREATE ---")
      try {
        await orderModule.createOrders([{
          email: "test@t.com",
          currency_code: "usd",
          items: [{ title: "Item", unit_price: 100, quantity: 1 }]
        }])
      } catch (e) {
        console.error("Order create failed:", e.message)
      }
      console.log("--- END ORDER CREATE ---")
    })
  })

  it("captures SQL for Customer", async () => {
    await tenantContext.run({ tenantId: tenant1Id, accessMode: "tenant" }, async () => {
      console.log("--- START CUSTOMER CREATE ---")
      try {
        await customerModule.createCustomers([{
          email: "test_customer@t.com",
        }])
      } catch (e) {
        console.error("Customer create failed:", e.message)
      }
      console.log("--- END CUSTOMER CREATE ---")
    })
  })
  
  it("captures SQL for Store", async () => {
    await tenantContext.run({ tenantId: tenant1Id, accessMode: "tenant" }, async () => {
      console.log("--- START STORE CREATE ---")
      try {
        await storeModule.createStores([{
          name: "Test Store",
          supported_currencies: [{ currency_code: "usd" }]
        }])
      } catch (e) {
        console.error("Store create failed:", e.message)
      }
      console.log("--- END STORE CREATE ---")
    })
  })
})
