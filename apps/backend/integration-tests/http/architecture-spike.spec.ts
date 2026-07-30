import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

// Architecture Spike: Transaction Propagation
medusaIntegrationTestRunner({
  env: {
    MEDUSA_FF_MEDUSA_V2: "true",
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/medusa_multi_tenant",
  },
  testSuite: ({ getContainer, api, dbConnection }) => {
    describe("Architecture Spike: Connection Lifecycle", () => {
      it("should inspect the knex pool and run a test", async () => {
        const container = getContainer()
        
        // 1. Inspect Knex instance and pool
        const manager = container.resolve("manager")
        const connection = manager.getConnection() // This is MikroORM EM's Knex instance
        
        console.log("Knex client:", connection.client?.constructor?.name)
        console.log("Knex pool:", !!connection.client?.pool)
        
        // Let's see if we can get the pool
        const pool = connection.client?.pool
        if (pool) {
          console.log("Pool acquire available:", typeof pool.on === "function")
          
          // Spy on acquire or afterCreate
          console.log("Pool configuration:", Object.keys(pool))
        }

        expect(true).toBe(true)
      })
    })
  }
})
