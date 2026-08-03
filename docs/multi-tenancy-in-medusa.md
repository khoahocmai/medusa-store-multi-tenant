

<!-- Start of picture text -->
Client Middleware AsyncLocalStorage FrameworkPatch PostgreSQL RLSPolicy<br>HTTP Request<br>x-tenant-id: abe-123<br>eT<br>Extracttenant ID& Validate(UUID)<br>store({ tenantld: "abc-123" })<br>ee?<br>Context stored<br>_ Continue request processing<br>Application makes query<br>SELECT * FROM product<br>getStore()<br>><br>{tenantld: "abc-123" }<br>SET app.current_tenant = 'abc-123'<br>a<br>Session variable set<br>SELECT * FROM product<br>a<br>RLS Policy Applied<br>WHERE tenant_id=<br>current_setting(‘app.current_tenant’)<br>Apply row-level filter<br>eea<br>Filtered rows (tenant abc-123 only)<br>Results (tenant-filtered)<br>JSON Response<br>(only tenant abc-123 data)<br>Database-level security<br>Cannot be bypassed by application code<br>Client Middleware AsyncLocalStorage FrameworkPatch PostgreSQL RLSPolicy<br><!-- End of picture text -->

# Prerequisites 

Before starting this tutorial, you should have: 

- + 

- <u>Node.js v20</u> 

- + 

- <u>PostgreSQL 12</u> with superuser access 

- <u>Git CLI tool</u> 

- A Medusa application installed. If you don't have one, follow the <u>installation guide.</u> 

- Basic understanding of PostgreSQL 

- ' 

- Familiarity with Medusa <u>s architecture</u> 

# Step 1: Understand Row Level Security Architecture 

Before implementing RLS, it's important to understand how the system works. 

## How RLS Works in Medusa 

RLS provides transparent multi-tenant data isolation through a three-layer architecture: 

**Layer 1: HTTP Middleware** extracts the tenant ID from request headers and stores it in AsyncLocalStorage for the duration of the request. 

**Layer 2: Framework Patch** intercepts all database connections and reads the tenant ID from AsyncLocalStorage, then sets it as a PostgreSQL session variable using **SET app.current_tenant = 'tenant-uuid'** 

**Layer 3: Database Policies** are PostgreSQL rules that automatically filter all queries based on the session variable, ensuring queries like **SELECT * FROM product** are automatically transformed to **SELECT * FROM product WHERE tenant_id = current_setting('app.current_tenant').** 

## Request Flow 

1. HTTP Request with x-tenant-id: "abc-123" 

2. Middleware stores tenant ID in AsyncLocalStorage 

3. Framework patch reads from AsyncLocalStorage 

4. Patch executes: SET app.current_tenant = 'abc-123' 

5. Application runs: SELECT * FROM product; 

6. PostgreSQL RLS automatically adds: WHERE tenant_id = 'abc-123' 

7. Response contains only tenant "abc-123" data 

## Key Benefits 

- **Database-Level Security** : Cannot be bypassed by application bugs or SQL injection. 

- **Transparent** : No code changes needed in business logic. 

- **Automatic** : All queries are automatically filtered. 

- **Admin Mode** : Can disable filtering by omitting tenant header. 

- **Performant** : Uses indexed columns with minimal overhead. 

# Step 2: Create Tenant Context Module 

In Medusa, you build custom features in modules. A module is a reusable package with data models and functionalities related to a single feature. 

In this step, you'll create a Tenant Context Module that manages tenant identification and context storage. 

## a. Create Module Directory 

Create the directory that will hold the module's files: 

mkdir -p src/modules/tenant-context 

## b. Create Middleware 

The middleware extracts the tenant ID from HTTP requests and stores it in AsyncLocalStorage, making it available to the database connection hooks. 

Create the file src/modules/tenant-context/middleware.ts with the following content: 

```
import { AsyncLocalStorage } from 'async_hooks';
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * Type for tenant context stored in AsyncLocalStorage
 */
export interface TenantContext {
  tenantId: string;
}
```

```
/**
 * AsyncLocalStorage to maintain tenant context across async operations
 * This ensures tenant_id is available to database connection hooks
 *
 * CRITICAL: This is used by the Medusa framework patch
(patches/@medusajs+framework+2.10.1.patch)
 * to inject tenant context into all database queries for Row Level Security (RLS).
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();
/**
 * Middleware to extract tenant_id from request and store in AsyncLocalStorage context
 *
 * Tenant ID can come from:
 * - Header: x-tenant-id (recommended for production)
 * - JWT token: tenant_id claim (if you store it in JWT)
 * - Query parameter: tenant_id (for testing/development only)
```

```
 *
 * The tenant_id is stored in AsyncLocalStorage, which makes it available
 * to the database connection hooks (via patch) that set PostgreSQL session variables.
 */
```

```
export function tenantContextMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Extract tenant_id from various sources
  let tenantId: string | undefined;
```

```
  // 1. Check header (recommended for production)
```

```
  tenantId = req.headers['x-tenant-id'] as string;
```

```
  // 2. Check JWT token if authenticated
  // Note: req.auth is not available in MedusaRequest type
  // If you need JWT-based tenant extraction, use a custom property or header
  // Example implementation (commented out):
  // if (!tenantId && (req as any).auth?.context) {
  //   const actorMetadata = (req as any).auth.context?.actor_metadata;
  //   if (actorMetadata?.tenant_id) {
  //     tenantId = actorMetadata.tenant_id;
```

```
  // 3. Check query parameter (for testing/development only)
  if (!tenantId && process.env.NODE_ENV !== 'production') {
    tenantId = req.query.tenant_id as string;
  }
  // If tenant_id is found, validate and store it in AsyncLocalStorage
  if (tenantId) {
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      console.log(`[TENANT_MIDDLEWARE] Invalid tenant_id format: ${tenantId}`);
      return res.status(400).json({
        message: 'Invalid tenant_id format. Expected UUID.'
      });
    }
    console.log(`[TENANT_MIDDLEWARE] Setting tenant context: ${tenantId}`);
    // Store tenant context in AsyncLocalStorage
    // This will be available to all async operations in this request
    return tenantContextStorage.run({ tenantId }, () => {
      next();
    });
  }
  // No tenant_id found - continue without context (admin/system mode)
  // RLS policies allow queries when app.current_tenant is NULL
  console.log('[TENANT_MIDDLEWARE] No tenant_id - admin mode');
  next();
}
```

This middleware performs the following functions: 

- **Exports tenantContextStorage** : An AsyncLocalStorage instance that will be accessed by the framework patch 

- **Extracts tenant ID** : From x-tenant-id header (production), JWT token (optional), or query parameter (development) 

- **Validates format** : Ensures tenant ID is a valid UUID 

- **Stores in context** : Uses AsyncLocalStorage to make tenant ID available throughout the request lifecycle 

- **Admin mode** : Allows requests without tenant ID to access all data 

**Production Note** : In production deployments, add authentication middleware before the tenant context middleware to verify that the authenticated user belongs to the requested tenant. Extract the tenant ID from verified JWT tokens rather than trusting request headers directly. 

## c. Create Module Service 

A module must export a service. Create a minimal service that satisfies this requirement. 

Create the file src/modules/tenant-context/service.ts: 

```
import { MedusaService } from "@medusajs/framework/utils"
class TenantContextModuleService extends MedusaService({}) {}
export default TenantContextModuleService
```

This creates an empty service using Medusa's service factory. The Tenant Context Module doesn't require data models since tenant information is extracted from requests and stored in AsyncLocalStorage, not in the database. 

## d. Create Module Definition 

The module definition tells Medusa about your module and registers it in the application. 

Create the file src/modules/tenant-context/index.ts: 

```
import Service from "./service"
import { Module } from "@medusajs/framework/utils"
export const TENANT_CONTEXT_MODULE = "tenantContextModule"
export default Module(TENANT_CONTEXT_MODULE, {
  service: Service,
})
```

You export: 

- TENANT_CONTEXT_MODULE: The module's name for referencing it elsewhere 

- Default export: The module definition created with the Module function 

## e. Register Module in Medusa Configuration 

Add your module to Medusa's configuration to make it available in the application. 

In medusa-config.ts, import the module name and add it to the modules configuration: 

```
import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { TENANT_CONTEXT_MODULE } from './src/modules/tenant-context'
loadEnv(process.env.NODE_ENV || 'development', process.cwd())
```

```
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },
  modules: {
    [TENANT_CONTEXT_MODULE]: {
      resolve: './modules/tenant-context',
    },
  },
})
```

## f. Register Middleware Globally 

To apply the tenant context middleware to all requests, register it in the API middleware configuration. 

Create the file src/api/middlewares.ts: 

```
import { defineMiddlewares } from "@medusajs/framework/http"
import { tenantContextMiddleware } from "../modules/tenant-context/middleware"
export default defineMiddlewares({
  routes: [
    {
      matcher: "*",
      middlewares: [tenantContextMiddleware],
    },
  ],
})
```

This configuration applies the tenantContextMiddleware to all routes (matcher: "*"), ensuring every request has tenant context processed. 

# Step 3: Create Framework Patch for Database Connection Hooks 

The framework patch intercepts Medusa's database connections and injects tenant context as PostgreSQL session variables. This is the critical piece that makes RLS work with Medusa. 

**Why a patch?** We need to modify the framework's database connection loader to inject tenant context. Using a patch is the cleanest approach because it: 

- Preserves all of Medusa's existing database logic without overwriting core files. 

- Ensures RLS context applies to ALL queries, including core modules and thirdparty extensions. 

- Keeps your customizations separate and version-controlled. 

**Maintenance** : Patches require testing when upgrading @medusajs/framework. Implement a process to verify the patch applies cleanly and RLS continues working after each framework upgrade. This is a small trade-off for the security benefits of database-level tenant isolation. 

## a. Install patch-package 

First, install the patch-package dependency to manage framework patches: 

```
npm install patch-package
```

Add the postinstall script to package.json: 

```
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

This ensures patches are automatically applied after npm install or yarn install. 

## b. Create Patches Directory 

Create the directory to hold your patches: 

```
mkdir -p patches
```

## c. Create Framework Patch 

Create the file patches/@medusajs+framework+2.10.1.patch with the following content: 

```
diff --git a/nodeb/node_modules/@medusajs/framework/dist/database/pg-connection-loader.js _modules/@medusajs/framework/dist/database/pg-connection-loader.js
```

|`index 94ebc88..95bb245 100644`|
|---|
|`--- a/node_modules/@medusajs/framework/dist/database/pg-connection-loader.js`|
|`+++ b/node_modules/@medusajs/framework/dist/database/pg-connection-loader.js`<br>`@@ -53,6 +53,106 @@ async function pgConnectionLoader() {`<br>`logger_1.logger.warn(`Pg connection failed to connect to the database.`<br>`Retrying...\\n${(0, utils_1.stringifyCircular)(error)}`);`<br>`},`<br>`});`<br>`+`<br>`+    // ============================================================================`<br>`+    // RLS PATCH: Add Row Level Security support via query hooks`<br>`+    // ============================================================================`<br>`+    try {`<br>`+        logger_1.logger.info('[RLS_PATCH] Initializing Row Level Security hooks on Knex`<br>`connection');`<br>`+`<br>`+        // Get tenant_id from AsyncLocalStorage context`<br>`+        function getTenantIdFromContext() {`<br>`+            try {`<br>`+                const path = require('path');`<br>`+                const tenantContextModule = require(path.join(process.cwd(),`<br>`'src/modules/tenant-context/middleware'));`<br>`+                const store = tenantContextModule?.tenantContextStorage?.getStore();`<br>`+                return store?.tenantId || null;`<br>`+            } catch (error) {`<br>`+                // If module not available, return null (admin/system mode)`<br>`+                logger_1.logger.debug(`[RLS_PATCH] Could not load tenant context:`<br>`${error.message}`);`<br>`+                return null;`<br>`+            }`<br>`+        }`<br>`+`<br>`+        // Track tenant_id per connection to avoid redundant set_config calls (optimization)`<br>`+        const connectionTenantMap = new WeakMap();`<br>`+`<br>`+        // Set tenant context on a connection`<br>`+        async function setTenantContextOnConnection(connection, tenantId) {`<br>`+            if (!connection) {`<br>`+                return;`<br>`+            }`<br>`+`<br>`+            const lastTenantId = connectionTenantMap.get(connection);`<br>`+`<br>`+            // Only set if tenant_id changed or not set yet (optimization)`<br>`+            if (lastTenantId !== tenantId) {`|



```
+                try {
+                    if (tenantId) {
+                        // Use settransaction-local) _config with session-level scope (false = session, true =
+                        await connection.query("SELECT setfalse)", [tenantId]); _config('app.current_tenant', $1,
+                        connectionTenantMap.set(connection, tenantId);
+                        logger${tenantId} for connection`); _1.logger.debug(`[RLS_PATCH] Set app.current_tenant:
+                    } else {
+                        // Clear tenant context if not set (for admin/system operations)
+                        await connection.query("SELECT setfalse)"); _config('app.current_tenant', NULL,
+                        connectionTenantMap.set(connection, null);
+                        loggerconnection'); _1.logger.debug('[RLS_PATCH] Cleared app.current_tenant for
+                    }
+                } catch (error) {
+                    logger${String(error)}`); _1.logger.error(`[RLS_PATCH] Failed to set tenant context:
+                }
+            }
+        }
+
+        // Hook into connection acquisition to set tenant context when connection is acquired
+        if (pgConnection.client && typeof pgConnection.client.acquireConnection ===
'function') {
+            const originalAcquireConnection =
pgConnection.client.acquireConnection.bind(pgConnection.client);
+
+            pgConnection.client.acquireConnection = async function () {
+                const connection = await originalAcquireConnection();
+
+                // Set tenant context from AsyncLocalStorage if available
+                const tenantId = getTenantIdFromContext();
+                await setTenantContextOnConnection(connection, tenantId);
+
+                return connection;
+            };
+
+            logger_1.logger.info('[RLS_PATCH] Hooked into client.acquireConnection');
+        }
+
+        // Wrap query execution to set tenant_id before each query
+        // This ensures tenant_id is always current, even if connection is reused from pool
+        if (pgConnection.client && typeof pgConnection.client.query === 'function') {
```

```
+            const originalQuery = pgConnection.client.query.bind(pgConnection.client);
+
+            pgConnection.client.query = async function (connection, obj, ...args) {
+                // Get current tenant_id from context
+                const tenantId = getTenantIdFromContext();
+
+                // Set tenant_id before query execution
+                await setTenantContextOnConnection(connection, tenantId);
+
+                // Execute original query
+                return originalQuery(connection, obj, ...args);
+            };
+
+            logger_1.logger.info('[RLS_PATCH] Hooked into client.query');
+        }
+
+        // NOTE: Transaction hook is not needed because transactions use client.query under
the hood
+        // which is already hooked above. This avoids "Cannot assign to read only property"
errors.
+
+        loggersuccessfully'); _1.logger.info('[RLS_PATCH] Row Level Security hooks initialized
+    } catch (error) {
+        logger${String(error)}`); _1.logger.error(`[RLS_PATCH] Failed to initialize RLS hooks:
+        // Don't throw - allow application to continue without RLS if setup fails
+    }
+    // ============================================================================
+    // END RLS PATCH
+    // ============================================================================
+
     containerawilix_1.asValue)(pgConnection)); _1.container.register(utils_1.ContainerRegistrationKeys.PG_CONNECTION, (0,
     return pgConnection;
 }
```

This patch does the following: 

- **getTenantIdFromContext()** : Loads the tenant context middleware module and reads the tenant ID from AsyncLocalStorage 

- **connectionTenantMap** : A WeakMap that tracks which tenant ID is set on each connection to avoid redundant SET queries 

- **setTenantContextOnConnection()** : Executes SELECT 

set_config('app.current_tenant', $1, false) to set the PostgreSQL session variable 

- **Hooks client.acquireConnection** : Sets tenant context when a connection is acquired from the pool 

- **Hooks client.query** : Sets tenant context before each query execution 

- **Logs extensively** : Uses [RLS_PATCH] prefix for easy debugging 

**IMPORTANT** : If you're using a different version of @medusajs/framework, adjust the patch file name to match your version (e.g., @medusajs+framework+2.11.0.patch). 

# Step 4: Create RLS Migration 

Now you'll create a migration that adds the tenant_id column to all relevant tables and creates RLS policies to enforce tenant isolation. 

## a. Generate Migration File 

Generate a new migration file: 

```
npx medusa db:generate tenantContext
```

This will create a new migration file in src/modules/tenant-context/migrations/ with a timestamp in its name. 

## b. Implement Migration 

Replace the content of the generated migration file with the RLS implementation. The migration adds RLS to 44+ Medusa tables. 

### **Complete implementation** : View the full migration file in the repository (384 lines). 

Here's the structure of what the migration does: 

```
import { Migration } from '@mikro-orm/migrations'
export class Migration20251201120000 extends Migration {
  async up(): Promise<void> {
    const tables = [
      // Core entities
      'product', 'product_variant', 'product_option', 'product_option_value',
      'product_type', 'product_collection', 'product_category', 'product_tag',
      'image',
      // Customer & Auth
      'customer', 'customer_group', 'customer_address', 'user', 'invite',
      // Orders & Cart
      'order', 'order_item', 'cart', 'line_item', 'order_change',
```

```
      'order_claim', 'order_edit', 'return', 'return_item', 'return_reason',
      // Payments
      'payment_collection', 'payment', 'refund',
      // Fulfillment & Shipping
      'fulfillment', 'fulfillment_item', 'fulfillment_set',
      'shipping_option', 'shipping_profile', 'shipping_method',
      // Inventory
      'inventory_item', 'inventory_level', 'reservation_item', 'stock_location',
      // Sales Channels & Regions
      'sales_channel', 'region', 'store', 'currency',
      // Pricing
      'price_list', 'price_set', 'price', 'money_amount',
      // Promotions
      'promotion', 'campaign', 'discount',
      // API & Auth
      'api_key', 'publishable_api_key',
      // Notifications & Workflows
      'notification', 'workflow_execution'
    ]
    // For each table: add tenant_id, enable RLS, create policies
    for (const table of tables) {
      try {
        await this.execute(`
          DO $$
          BEGIN
            -- Check if table exists
            IF EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = '${table}'
            ) THEN
              -- Add tenant_id column with DEFAULT
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
```

```
                AND table_name = '${table}'
                AND column_name = 'tenant_id'
                ALTER TABLE "${table}" ADD COLUMN tenant_id UUID
                  DEFAULT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
                CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON "${table}" (tenant_id);
        await this.execute(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
        await this.execute(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`)
```

```
        // Create policies (SELECT, INSERT, UPDATE, DELETE)
        // ... (see full implementation in repository)
      } catch (error) {
        console.log(`Skipped table ${table}: ${error}`)
      }
    }
```

```
    // Create helper function to check RLS status
    await this.execute(`
      CREATE OR REPLACE FUNCTION check_rls_status()
      RETURNS TABLE (
        table_name TEXT,
        rls_enabled BOOLEAN,
        rls_forced BOOLEAN,
        policies_count BIGINT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          c.relname::TEXT,
          c.relrowsecurity,
          c.relforcerowsecurity,
          COUNT(p.polname)
        FROM pg_class c
        LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE c.relnamespace = 'public'::regnamespace
          AND c.relkind = 'r'
          AND c.relrowsecurity = true
```

```
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
        ORDER BY c.relname;
      END;
      $$ LANGUAGE plpgsql;
    `)
  }
  async down(): Promise<void> {
    // Rollback: drop policies, disable RLS, remove columns
    // ... (see full implementation in repository)
  }
}
```

The migration performs the following for each table: 

- **Adds tenant_id column** : A UUID column to store the tenant identifier 

- **Creates index** : On tenant_id for query performance 

- **Sets DEFAULT** : Automatically populates tenant_id from the app.current_tenant session variable 

- **Enables RLS** : Activates row-level security on the table 

- **Forces RLS** : Applies RLS even to table owners (required for non-superusers) 

- **Creates 4 policies** : One each for SELECT, INSERT, UPDATE, and DELETE operations 

The policies allow operations when: 

1. The row's tenant_id matches current_setting('app.current_tenant'), OR 

2. The session variable is NULL (admin mode), OR 

3. The session variable is empty string (admin mode) 

The migration also creates a helper function check_rls_status() to verify RLS configuration. 

# Step 5: Create Non-Superuser Database Role 

**CRITICAL** : PostgreSQL bypasses RLS policies for superuser roles. You must use a non-superuser role for your application. 

## a. Create User Creation Script 

Create the file src/scripts/seed-rls-user.ts: 

```
import { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
/**
 * Seed script to create non-superuser for RLS (Row Level Security)
 *
 * IMPORTANT: RLS policies are bypassed for PostgreSQL superusers!
 * This script creates a dedicated application user (medusa_app_user)
 * that will have RLS enforced.
 *
 * Run with: yarn medusa exec ./src/scripts/seed-rls-user.ts
 */
export default async function seedRlsUser({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const APP_USER = process.env.RLS_APP_USER || 'medusa_app_user'
  const APP_PASSWORD = process.env.RLS_APP_PASSWORD || 'medusa_app_password'
  logger.info('='.repeat(60))
  logger.info('RLS User Setup Script')
  logger.info('='.repeat(60))
  try {
    // Check if we're running as superuser
    const superuserCheck = await pgConnection.raw(`
      SELECT current_user, usesuper
      FROM pg_user
      WHERE usename = current_user
    `)
    const isSuperuser = superuserCheck.rows[0]?.usesuper
    logger.info(`Current user: ${superuserCheck.rows[0]?.current_user}`)
    logger.info(`Is superuser: ${isSuperuser}`)
    if (!isSuperuser) {
      logger.warn('   Current user is NOT a superuser.')
      logger.warn('   You need superuser privileges to create new users.')
      logger.warn('   Run this script with DATABASE_URL pointing to superuser.')
      return
    }
    // Check if user already exists
```

`logger.info(`\\n Checking if user '${APP_USER}' exists...`) const userExists = await pgConnection.raw(` SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}' `) if (userExists.rows.length > 0) { logger.info(`` ✓ `User '${APP_USER}' already exists`) await pgConnection.raw(` ALTER USER ${APP_USER} WITH PASSWORD '${APP_PASSWORD}' `) logger.info(`` ✓ `Password updated`) } else { logger.info(`   Creating user '${APP_USER}'...`) await pgConnection.raw(` CREATE USER ${APP_USER} WITH PASSWORD '${APP_PASSWORD}' `) logger.info(`` ✓ `User '${APP_USER}' created`) } // Get current database name const dbResult = await pgConnection.raw(`SELECT current_database()`) const dbName = dbResult.rows[0]?.current_database logger.info(`\\n Granting privileges on database '${dbName}'...`) // Grant privileges await pgConnection.raw(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO ${APP_USER}`) await pgConnection.raw(`GRANT ALL ON SCHEMA public TO ${APP_USER}`) await pgConnection.raw(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${APP_USER}`) await pgConnection.raw(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${APP_USER}`)` <mark>`await pgConnection.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO`</mark> `${APP_USER}`)` <mark>`await pgConnection.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES`</mark> `TO ${APP_USER}`)` 

`logger.info(`` ✓ `All privileges granted`)` 

```
    // Verify user is NOT a superuser
    const verifyResult = await pgConnection.raw(`
      SELECT rolname, rolsuper
      FROM pg_roles
      WHERE rolname = '${APP_USER}'
    `)
```

`const userInfo = verifyResult.rows[0] if (userInfo?.rolsuper) { logger.error('ERROR: User is a superuser! RLS will be bypassed!') } else { logger.info('` ✓ `User is NOT a superuser - RLS will be enforced') } // Summary logger.info('\\n' + '='.repeat(60)) logger.info('RLS User Setup Complete!') logger.info('='.repeat(60)) logger.info('\\nUpdate your .env file with:') logger.info(`DATABASE_URL=postgresql://${APP_USER}:${APP_PASSWORD}@localhost:5432/${dbName}`) logger.info('='.repeat(60)) } catch (error) { logger.error(`Error during RLS user setup: ${error}`) throw error }` <mark>`}`</mark> 

### This script: 

- Uses Medusa's exec command to access the application container 

- Resolves logger and database connection from the container 

- Verifies the current user is a superuser (required to create users) 

- Creates a new non-superuser role medusa_app_user with password 

- Grants all necessary privileges on database, schema, tables, and sequences 

- Verifies the user is not a superuser 

- Outputs the new DATABASE_URL to use 

## b. Add Script to package.json 

Add the script to your package.json: 

```
{
  "scripts": {
    "seed:rls-user": "medusa exec ./src/scripts/seed-rls-user.ts"
  }
}
```

This uses Medusa's exec command to run the script with access to the application container. 

## c. Create Non-Superuser 

Run the script to create the non-superuser (ensure your DATABASE_URL uses superuser credentials) 

```
npm run seed:rls-user
```

### You should see output like: 

`Connected as superuser Created user: medusa_app_user Granted privileges to medusa_app_user` ✓ `User is correctly configured as non-superuser Update your .env file with:` <mark>`DATABASErls-poc`</mark> `_` <mark>`URL=postgresql://medusa`</mark> `_` <mark>`app`</mark> `_` <mark>`user:medusa`</mark> `_` <mark>`app`</mark> `_` <mark>`password@localhost:5432/medusa-medusa-`</mark> 

## d. Update Environment Variables 

Update your .env file with the new connection string: 

```
DATABASErls-poc _URL=postgresql://medusa_app_user:medusa_app_password@localhost:5432/medusa-medusa-
```

**Important** : Keep your superuser credentials available for future migrations. You might want to add: 

```
DATABASE_SUPER_URL=postgresql://postgres:postgres@localhost:5432/medusa-medusa-rls-poc
```

Then run migrations with: 

```
DATABASE_URL=$DATABASE_SUPER_URL npx medusa db:migrate
```

# Step 6: Test the Implementation 

In this step, you'll create comprehensive integration tests to verify that RLS is working correctly. 

## a. Setup Test Configuration 

Create the file jest.config.js: 

```
const { loadEnv } = require('@medusajs/utils')
loadEnv('test', process.cwd())
module.exports = {
  transform: {
    '^.+\\\\.[jt]s$': [
      '@swc/jest',
      {
```

```
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
        },
      },
    ],
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts', 'json'],
  modulePathIgnorePatterns: ['dist/', '<rootDir>/.medusa/'],
  setupFiles: ['./integration-tests/setup.js'],
}
if (process.env.TEST_TYPE === 'integration:http') {
  module.exports.testMatch = ['**/integration-tests/http/**/*.spec.[jt]s']
} else if (process.env.TEST_TYPE === 'integration:modules') {
  module.exports.testMatch = ['**/src/modules/*/__tests__/**/*.[jt]s']
} else if (process.env.TEST_TYPE === 'unit') {
  module.exports.testMatch = ['**/src/**/__tests__/**/*.unit.spec.[jt]s']
}
```

### This configuration: 

- Loads test environment variables 

- Configures SWC for TypeScript transformation with decorator support 

- Sets up module path ignores for compiled files 

- Loads the setup file before tests 

- Configures different test patterns based on TEST_TYPE environment variable 

### Create the file integration-tests/setup.js: 

```
const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")
```

```
MetadataStorage.clear()
```

This clears the MikroORM metadata storage to ensure clean test state. 

## b. Create Product API Tests 

Create the file integration-tests/http/tenant-context/rls-products-api.spec.ts: 

```
 * Integration tests for RLS (Row Level Security) with Products API
 *
 * These tests verify that:
```

```
 * 1. Products are automatically assigned to the correct tenant based on the x-tenant-id
header
 * 2. Each tenant can only access their own products
 * 3. Admin requests (without tenant header) can see all products
 *
 * Prerequisites:
 * 1. Database user must be a non-superuser (RLS is bypassed for superusers)
 * 2. Framework patch must be applied (patches/@medusajs+framework+2.10.1.patch)
 * 3. RLS migration has been applied (Migration20251201120000)
 * 4. Middleware is registered in src/api/middlewares.ts
 * 5. Valid secret API key
 */
import axios from 'axios'
const BASE_URL = '<http://localhost:9000>'
const SECRET_KEY = 'test' // Replace with your actual secret key
// Test tenant UUIDs
const TENANT_1 = 'a3f7c8e2-9b4d-4a6f-8c3e-7d2f1b5a9c4e'
const TENANT_2 = 'b4f8d9f3-0c5e-5b7g-9d4f-8e3g2c6b0d5f'
describe('RLS Products API Tests', () => {
  let tenant1ProductId: string
  let tenant2ProductId: string
  it('should create product for tenant 1', async () => {
    const response = await axios.post(
      `${BASE_URL}/admin/products`,
      {
        title: 'Tenant 1 Product',
        status: 'published',
      },
      {
        headers: {
          'x-tenant-id': TENANT_1,
          'Authorization': `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    expect(response.status).toBe(200)
```

```
    expect(response.data.product).toBeDefined()
    tenant1ProductId = response.data.product.id
    console.log(`Created product for Tenant 1: ${tenant1ProductId}`)
  })
  it('should create product for tenant 2', async () => {
    const response = await axios.post(
      `${BASE_URL}/admin/products`,
      {
        title: 'Tenant 2 Product',
        status: 'published',
      },
      {
        headers: {
          'x-tenant-id': TENANT_2,
          'Authorization': `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    expect(response.status).toBe(200)
    expect(response.data.product).toBeDefined()
    tenant2ProductId = response.data.product.id
    console.log(`Created product for Tenant 2: ${tenant2ProductId}`)
  })
  it('should only return tenant 1 products when queried with tenant 1 header', async () => {
    const response = await axios.get(
      `${BASE_URL}/admin/products`,
      {
        headers: {
          'x-tenant-id': TENANT_1,
          'Authorization': `Bearer ${SECRET_KEY}`,
        },
      }
    )
    expect(response.status).toBe(200)
    expect(response.data.products).toBeDefined()
```

```
    const productIds = response.data.products.map((p: any) => p.id)
    expect(productIds).toContain(tenant1ProductId)
    expect(productIds).not.toContain(tenant2ProductId)
    console.log(`Tenant 1 can see ${response.data.products.length} products (including
${tenant1ProductId})`)
  })
  it('should only return tenant 2 products when queried with tenant 2 header', async () => {
    const response = await axios.get(
      `${BASE_URL}/admin/products`,
      {
        headers: {
          'x-tenant-id': TENANT_2,
          'Authorization': `Bearer ${SECRET_KEY}`,
        },
      }
    )
    expect(response.status).toBe(200)
    expect(response.data.products).toBeDefined()
    const productIds = response.data.products.map((p: any) => p.id)
    expect(productIds).toContain(tenant2ProductId)
    expect(productIds).not.toContain(tenant1ProductId)
    console.log(`Tenant 2 can see ${response.data.products.length} products (including
${tenant2ProductId})`)
  })
  it('should return all products in admin mode (no tenant header)', async () => {
    const response = await axios.get(
      `${BASE_URL}/admin/products`,
      {
        headers: {
          'Authorization': `Bearer ${SECRET_KEY}`,
        },
      }
    )
    expect(response.status).toBe(200)
    expect(response.data.products).toBeDefined()
    const productIds = response.data.products.map((p: any) => p.id)
```

```
    expect(productIds).toContain(tenant1ProductId)
    expect(productIds).toContain(tenant2ProductId)
    console.log(`Admin mode can see ${response.data.products.length} products (all tenants)`)
  })
  it('should reject invalid tenant UUID format', async () => {
    try {
      await axios.get(
        `${BASE_URL}/admin/products`,
        {
          headers: {
            'x-tenant-id': 'invalid-uuid',
            'Authorization': `Bearer ${SECRET_KEY}`,
          },
        }
      )
      fail('Should have thrown an error')
    } catch (error: any) {
      expect(error.response.status).toBe(400)
      expect(error.response.data.message).toContain('Invalid tenant_id format')
    }
  })
})
```

This test suite verifies: 

- Products created with tenant header are isolated to that tenant 

- Tenant 1 cannot see Tenant 2's products and vice versa 

- Admin mode (no header) can see all products 

- Invalid UUID formats are rejected 

## c. Create Customer API Tests 

Create the file integration-tests/http/tenant-context/rls-customers-api.spec.ts: 

```
/**
 * Integration tests for RLS with Customers API
 */
import axios from 'axios'
const BASE_URL = '<http://localhost:9000>'
const SECRET_KEY = 'test'
```

```
const TENANT_1 = 'a3f7c8e2-9b4d-4a6f-8c3e-7d2f1b5a9c4e'
const TENANT_2 = 'b4f8d9f3-0c5e-5b7g-9d4f-8e3g2c6b0d5f'
describe('RLS Customers API Tests', () => {
  let tenant1CustomerId: string
  let tenant2CustomerId: string
  it('should create customer for tenant 1', async () => {
    const response = await axios.post(
      `${BASE_URL}/admin/customers`,
      {
        email: 'tenant1-customer@example.com',
        first_name: 'Tenant1',
        last_name: 'Customer',
      },
      {
        headers: {
          'x-tenant-id': TENANT_1,
          'Authorization': `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    expect(response.status).toBe(200)
    tenant1CustomerId = response.data.customer.id
  })
  it('should create customer for tenant 2', async () => {
    const response = await axios.post(
      `${BASE_URL}/admin/customers`,
      {
        email: 'tenant2-customer@example.com',
        first_name: 'Tenant2',
        last_name: 'Customer',
      },
      {
        headers: {
          'x-tenant-id': TENANT_2,
          'Authorization': `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
```

```
      }
    )
    expect(response.status).toBe(200)
    tenant2CustomerId = response.data.customer.id
  })
```

```
  it('should only return tenant 1 customers', async () => {
    const response = await axios.get(
      `${BASE_URL}/admin/customers`,
      {
        headers: {
          'x-tenant-id': TENANT_1,
          'Authorization': `Bearer ${SECRET_KEY}`,
        },
      }
    )
```

```
    const customerIds = response.data.customers.map((c: any) => c.id)
    expect(customerIds).toContain(tenant1CustomerId)
    expect(customerIds).not.toContain(tenant2CustomerId)
```

```
  it('should only return tenant 2 customers', async () => {
    const response = await axios.get(
      `${BASE_URL}/admin/customers`,
      {
        headers: {
          'x-tenant-id': TENANT_2,
          'Authorization': `Bearer ${SECRET_KEY}`,
        },
      }
    )
    const customerIds = response.data.customers.map((c: any) => c.id)
    expect(customerIds).toContain(tenant2CustomerId)
    expect(customerIds).not.toContain(tenant1CustomerId)
  })
  it('should return all customers in admin mode', async () => {
    const response = await axios.get(
      `${BASE_URL}/admin/customers`,
      {
```

```
        headers: {
          'Authorization': `Bearer ${SECRET_KEY}`,
        },
      }
    )
    const customerIds = response.data.customers.map((c: any) => c.id)
    expect(customerIds).toContain(tenant1CustomerId)
    expect(customerIds).toContain(tenant2CustomerId)
  })
})
```

## d. Add Test Scripts to package.json 

### Add the test scripts: 

```
{
  "scripts": {
    "test:rls-products": "NODEtests/http/tenant-context/rls-products-api.spec.ts --forceExit", _OPTIONS=--experimental-vm-modules jest integration-
    "test:rls-customers": "NODEtests/http/tenant-context/rls-customers-api.spec.ts --forceExit", _OPTIONS=--experimental-vm-modules jest integration-
    "test:rls-patch": "NODEtests/http/tenant-context/rls-patch.spec.ts --forceExit" _OPTIONS=--experimental-vm-modules jest integration-
  }
}
```

The --forceExit flag ensures Jest exits cleanly after tests complete. 

## e. Run Tests 

First, start your Medusa application: 

```
npm run dev
```

In another terminal, run the tests: 

```
npm run test:rls-products
```

You should see output confirming that: 

- Products are created with the correct tenant 

- Tenant 1 only sees their products 

- Tenant 2 only sees their products 

- Admin mode sees all products 

- Invalid UUIDs are rejected 

Run the customer tests: 

```
npm run test:rls-customers
```

All tests should pass, confirming that RLS is working correctly for both products and customers. 

## f. Additional Advanced Tests 

The full implementation includes additional comprehensive tests that verify the RLS patch mechanism at a deeper level. The rls-patch.spec.ts test file includes: 

- **Patch initialization verification** : Confirms that RLS hooks are properly installed in the Knex connection 

- **Direct database testing** : Tests RLS policies using raw SQL queries with Knex 

- **Transaction consistency** : Verifies tenant context persists correctly in database transactions 

- **AsyncLocalStorage integration** : Tests the middleware and patch working together 

- **Cross-tenant isolation** : Comprehensive tests for data isolation between tenants 

- **Admin mode** : Verifies that requests without tenant context can access all data 

These advanced tests provide deep verification of the RLS mechanism working correctly at the database level. 

Find the complete test suite here! 

# Step 7: Verify RLS Configuration 

In this step, you'll verify that RLS is properly configured and working at the database level. 

## a. Check RLS Status 

Connect to your database using the non-superuser credentials: 

```
psql postgresql://medusa_app_user:medusa_app_password@localhost:5432/medusa-medusa-rls-poc
```

Run the helper function to check RLS status: 

```
SELECT * FROM check_rls_status() LIMIT 10;
```

You should see output like: 

```
  table_name   | rls_enabled | rls_forced | policies_count
---------------+-------------+------------+----------------
 address       | t           | t          |              4
 api_key       | t           | t          |              4
```

```
 campaign      | t           | t          |              4
 cart          | t           | t          |              4
 country       | t           | t          |              4
...
```

### This confirms that: 

- RLS is enabled (rls_enabled = t) 

- RLS is forced even for table owners (rls_forced = t) 

- 4 policies exist per table (SELECT, INSERT, UPDATE, DELETE) 

## b. Test RLS Manually 

Test the RLS policies manually in psql: 

```
-- Set tenant context
SELECT set_config('app.current_tenant', 'a3f7c8e2-9b4d-4a6f-8c3e-7d2f1b5a9c4e', false);
-- Query products (should only return tenant's products)
SELECT id, title, tenant_id FROM product LIMIT 5;
-- Reset to admin mode
SELECT set_config('app.current_tenant', '', false);
-- Query products (should return all products)
SELECT id, title, tenant_id FROM product LIMIT 5;
```

## c. Verify User Configuration 

### Confirm you're using a non-superuser: 

```
SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;
```

### The output should show: 

```
   current_user    | usesuper
-------------------+----------
 medusa_app_user   | f
```

If usesuper is t (true), RLS will not work! You must use a non-superuser. 

## d. Check Policies 

View the policies for a specific table: 

```
SELECT
  schemaname,
  tablename,
  policyname,
```

```
  cmd,
  pg_get_expr(qual, pol.polrelid) as using_expression
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
WHERE c.relname = 'product';
```

This shows all four policies (SELECT, INSERT, UPDATE, DELETE) with their conditions. 

# Step 8: Create Debug SQL Utilities (Optional) 

For easier debugging, create a SQL file with helpful queries. 

Create the file src/modules/tenant-context/debug-rls.sql: 

```
-- Debug RLS Configuration
-- Run these queries to troubleshoot RLS issues
-- 1. Check current database user and superuser status
SELECT current_user, usesuper
FROM pg_user
WHERE usename = current_user;
-- Expected: usesuper should be 'f' (false) for RLS to work
-- 2. Check current tenant setting
SELECT current_setting('app.current_tenant', true) as current_tenant;
-- This shows which tenant context is currently set
-- 3. Check RLS status for all tables
SELECT * FROM check_rls_status();
-- Shows which tables have RLS enabled and policy counts
-- 4. View policies for a specific table
SELECT
  tablename,
  policyname,
  cmd,
  pg_get_expr(qual, pol.polrelid) as using_expression
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
WHERE c.relname = 'product';
-- 5. Test tenant isolation manually
BEGIN;
```

```
SELECT set_config('app.current_tenant', 'a3f7c8e2-9b4d-4a6f-8c3e-7d2f1b5a9c4e', false);
SELECT id, title, tenant_id FROM product LIMIT 5;
ROLLBACK;
-- 6. Test admin mode
BEGIN;
SELECT set_config('app.current_tenant', '', false);
SELECT id, title, tenant_id FROM product LIMIT 5;
ROLLBACK;
-- 7. Check tenant_id distribution
SELECT
  COALESCE(tenant_id::text, 'NULL') as tenant_id,
  COUNT(*) as count
FROM product
GROUP BY tenant_id
ORDER BY count DESC;
-- 8. Find rows without tenant_id
SELECT id, title, tenant_id
FROM product
WHERE tenant_id IS NULL
LIMIT 10;
```

You can run these queries when troubleshooting: 

```
psql $DATABASE_URL -f src/modules/tenant-context/debug-rls.sql
```

# Step 9: Production Deployment Checklist 

This RLS implementation provides excellent database-level security for multi-tenant applications. Before deploying to production, verify these requirements: 

## Database Configuration 

- Non-superuser database role created and configured 

- Application uses non-superuser credentials 

- Superuser credentials saved separately for migrations 

- RLS migration executed successfully 

- All tables have RLS enabled 

- Policies created for all tables (4 per table) 

## Application Configuration 

- Framework patch applied successfully 

- postinstall script configured in package.json 

- Tenant context module registered in medusa-config.ts 

- Middleware registered globally in src/api/middlewares.ts 

- Authentication middleware added before tenant context middleware 

- Test suite passes with 100% success rate 

- Framework upgrade testing process documented 

## Verification 

```
# 1. Check patch is applied
grep -c "RLS_PATCH" node_modules/@medusajs/framework/dist/database/pg-connection-loader.js
# Should return > 0
# 2. Check RLS is enabled
psql $DATABASE_URL -c "SELECT COUNT(*) FROM check_rls_status();"
# Should return 44 (number of tables)
# 3. Verify non-superuser
psql $DATABASEcurrent_user;" _URL -c "SELECT current_user, usesuper FROM pg_user WHERE usename =
# usesuper should be 'f'
# 4. Run integration tests
npm run test:rls-products
npm run test:rls-customers
# All tests should pass
```

## Security Considerations 

### **Best Practices:** 

- Use UUIDv4 for tenant IDs (cryptographically secure) 

- Never expose tenant IDs in URLs or responses 

- Implement rate limiting per tenant 

- Log all admin mode access (requests without tenant header) 

- Monitor for cross-tenant access attempts 

- **Add authentication middleware** before tenant context middleware to verify user identity and tenant ownership 

- Use JWT tokens with tenant claims for production deployments 

- Use HTTPS to prevent header interception 

# Troubleshooting 

Problem: RLS Not Filtering (Seeing All Data) 

**Symptom** : Queries return data from all tenants regardless of x-tenant-id header. **Cause** : Using a PostgreSQL superuser role. 

### **Solution:** 

```
# Check if you're using a superuser
psql $DATABASEcurrent_user;" _URL -c "SELECT current_user, usesuper FROM pg_user WHERE usename =
# If usesuper = t, update .env to use medusa_app_user
DATABASE_URL=postgresql://medusa_app_user:medusa_app_password@localhost:5432/your-db
```

Problem: No [RLS_PATCH] Logs 

**Symptom** : Server starts but no [RLS_PATCH] logs appear. 

**Cause** : Patch not applied to framework. 

### **Solution** : 

```
# Verify patch exists
ls -la patches/@medusajs+framework+*.patch
# Reapply patch
yarn postinstall
# Verify patch is applied
grep -n "RLS_PATCH" node_modules/@medusajs/framework/dist/database/pg-connection-loader.js
# Restart server
npm run dev
```

Problem: Migration Fails 

**Symptom** : npx medusa db:migrate fails with permission errors. 

**Cause** : Trying to run migration as non-superuser. 

### **Solution** : 

```
# Run migrations with superuser
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/your-db npx medusa db:migrate
# Then use non-superuser for application
# .env
DATABASE_URL=postgresql://medusa_app_user:medusa_app_password@localhost:5432/your-db
```

Problem: Middleware Not Setting Context 

**Symptom** : Logs show [RLS_PATCH] Set app.current_tenant: null. 

**Causes** : 

1. Missing x-tenant-id header in request 

2. Invalid UUID format 

3. Middleware not registered 

### **Solution** : 

```
# Test with valid UUID
curl -H "x-tenant-id: a3f7c8e2-9b4d-4a6f-8c3e-7d2f1b5a9c4e" \\
     -H "Authorization: Bearer YOUR_KEY" \\
     <http://localhost:9000/admin/products>
# Check middleware registration
grep -r "tenantContextMiddleware" src/api/middlewares.ts
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## Problem: Tests Failing 

**Symptom** : Integration tests fail with permission errors or no data isolation. 

**Cause** : Server not using RLS-enabled configuration. 

### **Solution:** 

```
# Ensure correct DATABASE_URL in .env
echo $DATABASE_URL
# Should be medusa_app_user, not postgres
# Verify RLS is enabled
psql $DATABASE_URL -c "SELECT * FROM check_rls_status() LIMIT 5;"
```

```
# Restart server completely
pkill -f "medusa"
npm run dev
# Run tests again
npm run test:rls-products
```

# Next Steps 

Expand Multi-Tenancy Features 

Now that you have database-level tenant isolation, you can: 

- **JWT Integration** : Extract tenant ID from JWT tokens instead of headers 

- **Tenant Onboarding** : Create workflows for tenant registration and setup 

- **Tenant-Specific Configuration** : Store per-tenant settings in a dedicated table 

- **Usage Tracking** : Monitor per-tenant resource usage and API calls 

- **Tenant Admin UI** : Build admin interfaces for tenant management 

## Production Deployment 

For production deployment: 

- **Use Environment Variables** : Store credentials securely 

- **Database Backups** : Implement regular backup strategy 

- **Monitoring** : Set up alerts for cross-tenant access attempts 

- **Performance** : Monitor query performance with tenant filters 

- **Audit Logging** : Log all data access with tenant context 

## Tutorial repository 

- <u>Medusa Multi-tenancy</u> 

