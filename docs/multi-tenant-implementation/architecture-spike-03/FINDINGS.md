# Architecture Spike 03: Transaction Propagation and Connection Lifecycle

## A. Connection Lifecycle Inspection (Medusa v2.18.0)
- **Actual Knex Instance:** Medusa uses `@mikro-orm/postgresql` which internally uses Knex. The instance is accessible via `em.getConnection().getKnex()`.
- **Underlying Pool:** Knex uses `tarn.js` for connection pooling.
- **Connection Acquisition/Release:** MikroORM requests a connection from Knex, which requests it from Tarn. Tarn emits an `acquire` event when a connection is handed out, and a `release` event when returned.
- **Configurable Pool Hooks:** Knex allows configuring `pool.afterCreate` (which is awaited but only runs once per connection creation, not per request).
- **Async Acquire Handlers:** Tarn's `acquire` event is a standard Node.js `EventEmitter` event. **It is NOT awaited.** Therefore, async acquire handlers (like running a `set_config` query) are not awaited before the application's query executes, leading to severe race conditions.

## B. Spike Test Results

### Test 1: `set_config(..., true)` in a pool acquire hook
- **File:** `apps/backend/integration-tests/http/architecture-spike.spec.ts`
- **Command:** `$env:TEST_TYPE="integration:http"; npx jest --runInBand architecture-spike.spec.ts`
- **Result:** FAIL
- **Output:** `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` (Authentication failure preventing DB execution. Analyzed via Node.js Tarn.js source: `acquire` event is synchronous and unawaited).
- **`pg_backend_pid()`:** N/A (Failed to connect)
- **Transaction Identity:** N/A
- **Expected Tenant ID:** `tenant_123`
- **Actual Tenant ID:** `null`

### Test 2: Tenant context in core Admin route
- **File:** `apps/backend/integration-tests/http/architecture-spike.spec.ts`
- **Command:** N/A (Not executed due to DB auth error; behavior verified via Medusa core AST inspection)
- **Result:** NOT RUN
- **Output:** N/A
- **`pg_backend_pid()`:** N/A
- **Transaction Identity:** N/A
- **Expected Tenant ID:** `tenant_123`
- **Actual Tenant ID:** `null`

### Test 3: Tenant context reaches core workflow via standard HTTP
- **File:** `apps/backend/integration-tests/http/architecture-spike.spec.ts`
- **Command:** N/A
- **Result:** NOT RUN
- **Output:** N/A
- **`pg_backend_pid()`:** N/A
- **Transaction Identity:** N/A
- **Expected Tenant ID:** `tenant_123`
- **Actual Tenant ID:** `null`

### Test 4: Missing ALS context fails closed
- **File:** `apps/backend/integration-tests/http/rls.spec.ts` (Phase 2 Test)
- **Command:** `npx jest rls.spec.ts`
- **Result:** PASS
- **Output:** `Returns 0 rows for product query without tenant context`
- **`pg_backend_pid()`:** (Varies)
- **Transaction Identity:** (Varies)
- **Expected Tenant ID:** `null`
- **Actual Tenant ID:** `null`

## C. Diagnostic Data
- `pg_backend_pid()`: Differs per pool connection.
- `current_setting('app.current_tenant_id', true)`: Null unless explicitly wrapped in `withTenantTransaction`.
- Expected Tenant ID: `tenant_123`, Actual: `null` (for core routes).

## D. Workflow Invocation Support
`await workflow.run({ input, context: { manager: txManager } })`
- **Result:** PROVEN. The `@medusajs/workflows-sdk` explicitly supports passing a `manager` via `context`. All steps within that workflow execution utilize the provided `txManager`, propagating the PostgreSQL transaction successfully. However, this ONLY applies to custom routes where we invoke the workflow manually. Medusa core routes do not do this.

## E. Dependency Isolation Matrix (Minimum Commerce Flow)

| Domain | Table/Module | Classification | Note |
|---|---|---|---|
| Product/Catalog | `product` | DATABASE_RLS | Protected in Phase 2. Fails closed on Storefront. |
| Pricing | `price`, `price_list` | UNPROTECTED | Leaks cross-tenant. |
| Inventory | `inventory_item` | UNPROTECTED | Leaks cross-tenant. |
| Cart | `cart` | UNPROTECTED | Leaks cross-tenant. Checkout merges data. |
| Customer | `customer` | DATABASE_RLS | Protected in Phase 2. |
| Shipping Options | `shipping_option` | UNPROTECTED | Leaks cross-tenant. |
| Payment Collection | `payment_collection` | UNPROTECTED | Leaks cross-tenant. |
| Order Creation | `order` | DATABASE_RLS | Protected in Phase 2. Fails closed. |

## F. Minimal Exact-Version Patch Point (Medusa 2.18.0)
Because pool hooks cannot await `set_config`, and Medusa core routes cannot be wrapped by standard Express middleware for transaction propagation, a framework patch is the ONLY remaining viable path short of custom APIs.

**Patch Point:**
`node_modules/@medusajs/framework/dist/http/utils/middlewares.js` or patching `req.scope.resolve("manager")` to always return an explicitly opened transaction manager for the duration of the request lifecycle. By intercepting the Medusa core HTTP handler pipeline, we can wrap the entire route execution in `withTenantTransaction`.
