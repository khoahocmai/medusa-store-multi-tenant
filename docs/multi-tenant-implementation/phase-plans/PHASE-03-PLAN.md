# Phase 3 Implementation Plan: Auth, Tenant Resolution, Middleware

**Status:** APPROVED_BY_USER

## 1. Supported-Extension-Point Investigation
We must determine whether tenant database context can be reliably propagated through the Medusa v2 (`2.18.0`) request lifecycle to ensure fail-closed RLS policies do not break core commerce flows.

**Candidates Evaluated:**

1. **Request-scoped transaction management (Awilix `req.scope` registration)**
   - *Mechanism:* Registering a custom `manager` onto `req.scope` in middleware.
   - *Coverage:* Workflows, nested workflows, module services using that scope.
   - *Misses:* Background workers, scheduled jobs, subscribers (they use their own scope), and Medusa core Admin/Store routes that resolve their own connections or start internal parallel transactions.
   - *Evidence:* Medusa core routes often instantiate new transactions via `@medusajs/medusa` service layers rather than strictly reusing the middleware's transaction manager.

2. **Medusa workflow shared context**
   - *Mechanism:* `myWorkflow(req.scope).run({ input, context: { manager: txManager } })`
   - *Coverage:* Custom Workflows, nested workflows.
   - *Misses:* Medusa core Admin routes, Medusa core Store routes (they don't use our wrapper), subscribers, scheduled jobs.
   - *Evidence:* Workflow SDK documentation explicitly supports `context: { manager }`.

3. **MikroORM transaction context (`RequestContext`)**
   - *Mechanism:* `RequestContext.create(em, next)`
   - *Coverage:* Module services and workflows executing within that specific context.
   - *Misses:* Raw Knex queries used in some Medusa core modules, connection pool recycling, and asynchronous boundaries not wrapped by ALS.

4. **Knex connection or pool hooks**
   - *Mechanism:* Injecting a Postgres `pool.on('acquire')` hook that reads from Node's AsyncLocalStorage and executes `SELECT set_config('app.current_tenant_id', ...)` on the `pg` connection.
   - *Constraint 1:* A Knex `afterCreate` hook cannot provide per-request tenant context because it only runs when a new connection is created, not when it is acquired from the pool for a request.
   - *Constraint 2:* `set_config(..., true)` only applies to the current PostgreSQL transaction. A pool-acquire hook runs *outside* the query transaction, so it must not be assumed to automatically propagate tenant context into subsequent transactions on that connection.
   - *Constraint 3:* `set_config(..., false)` is session-scoped and must **not** be used unless connection reset and pool-reuse safety are formally proven.
   - *Coverage:* **EVERYTHING** (Medusa core Admin routes, core Store routes, workflows, nested workflows, module services, subscribers, scheduled jobs, background workers) IF supported.
   - *Evidence:* Requires a formal architecture spike to prove these constraints can be safely managed.

5. **Supported middleware wrapping**
   - *Mechanism:* Express middleware `txManager.transactional(async () => next())`
   - *Misses:* Fails fundamentally because Express `next()` does not properly await the entire route execution if the route internally forks promises or manages its own transactions.

6. **Existing repository transaction APIs**
   - *Mechanism:* Overriding Medusa's base repository `transaction()` method.
   - *Coverage:* Module services.
   - *Misses:* Direct Knex queries, workflow orchestrator state queries.

## 2. Correcting the Transaction-Wrapper Example
The previous example was flawed because an outer transaction around a workflow is insufficient unless transaction propagation is proven.

**Revised Mechanism:**
For custom routes and workflows, the connection must be explicitly passed into the workflow execution context:
```typescript
await withTenantTransaction(req.scope.resolve("manager"), async (txManager) => {
  // Prove transaction propagation by passing txManager into the workflow context
  await createProductWorkflow(req.scope).run({
    input: payload,
    context: { manager: txManager }
  });
});
```
**Test Requirement:** We will define and run an exact HTTP-to-database integration test proving that a query inside `createProductWorkflow` executes on the *exact same Postgres connection* as the wrapper, and that `app.current_tenant_id` remains intact.

## 3. Separate Admin and Storefront Resolution

**Admin Routes (`/admin/*`)**
- Require an authenticated staff actor.
- Require an active tenant membership.
- Require role authorization.
- Optional store assignment (for store-scoped staff).

**Storefront Routes (`/store/*`)**
- **Must NOT** require `tenant_membership`.
- Context is defined by an approved combination of:
  - Trusted normalized hostname / store locator.
  - Publishable API key.
  - Optional customer authentication (which binds the customer to a specific tenant/store context implicitly).

## 4. Harden Bootstrap Tables
`tenant_membership` and `store_locator` are not RLS-protected. They will be hardened as follows:
- **Parameterized Lookup Predicates:** Exact matching only (e.g., `where: { domain: normalizedDomain }`).
- **Minimum Selected Fields:** Query only what is necessary (`fields: ["id", "tenant_id", "role"]`).
- **No Generic List Routes:** We will not expose any API routes that list these tables globally.
- **Actor ID Derivation:** The `actor_id` will be derived **only** from the cryptographically verified `req.auth_context.actor_id`, never from a request payload.
- **Domain Normalization & Spoofing Protection:** The `Host` header will be aggressively normalized. We will define strict trusted-proxy rules to prevent `X-Forwarded-Host` spoofing, explicitly rejecting unverified custom domain headers.

## 5. Explicit Platform Admin Resolution (Deviation Required)
**STATUS: APPROVED DEVIATION**
Phase 1 did not define a Platform Admin model. We will implement a minimal `PlatformMembership` model.
- **Model:**
  - `id`
  - `actor_id`
  - `role`: `superadmin | viewer`
  - `is_active`
  - `created_by`
  - `created_at`
  - `updated_at`
- **Required constraints:**
  - Unique `actor_id`.
  - Tenant users cannot grant platform roles.
  - Create, update, activation, and revocation are audited.
  - User metadata is not the authorization source of truth.

## 6. Route Protection Matrix
Given the fail-closed RLS on `store`, `product`, `order`, and `customer`, we map the core commerce flows:

| Route Family | Classification | Auth Context | Resolution Source | Primary Tables | RLS Coverage | Tx Propagation | Effect if Blocked | MVP Operational? |
|---|---|---|---|---|---|---|---|---|
| Authentication | ALLOW | None | Host / API Key | `user`, `customer` | None | N/A | Auth breaks | NO |
| Users | TEMPORARILY_BLOCKED_PENDING_ISOLATION | Admin | Tenant Header | `user` | None (Leaks) | Missing | Staff management fails | YES |
| Stores | ALLOW | Admin | Tenant Header | `store` | FULL | Missing | UI fails closed | NO |
| Sales Channels | TEMPORARILY_BLOCKED_PENDING_ISOLATION | Admin/Store | Host / API Key | `sales_channel`| None (Leaks) | Missing | Commerce mapping fails | NO |
| Regions | TEMPORARILY_BLOCKED_PENDING_ISOLATION | Admin/Store | Host / API Key | `region` | None (Leaks) | Missing | Pricing/Checkout breaks| NO |
| Products / Catalog | WRAP/PATCH | Admin/Store | Host / API Key | `product` | FULL | Missing | Catalog breaks | NO |
| Pricing / Inventory| TEMPORARILY_BLOCKED_PENDING_ISOLATION | Admin/Store | Host / API Key | `price`, `inv` | None (Leaks) | Missing | Add to cart fails | NO |
| Promotions | TEMPORARILY_BLOCKED_PENDING_ISOLATION | Admin/Store | Host / API Key | `promotion` | None (Leaks) | Missing | Discounts unavailable | YES |
| Customers | WRAP/PATCH | Store Auth | Session | `customer` | FULL | Missing | Profiles break | NO |
| Carts | TEMPORARILY_BLOCKED_PENDING_ISOLATION | Store Auth | Session / Host | `cart` | None (Leaks) | Missing | Checkout impossible | NO |
| Checkout / Payment | TEMPORARILY_BLOCKED_PENDING_ISOLATION | Store Auth | Session / Host | `payment` | None (Leaks) | Missing | Sales impossible | NO |
| Orders | WRAP/PATCH | Admin/Store | Session / Host | `order` | FULL | Missing | Order mgmt fails | NO |
| API Keys | TEMPORARILY_BLOCKED_PENDING_ISOLATION | Admin | Platform | `api_key` | None (Leaks) | Missing | PK generation fails | YES |

## 7. Architectural Blocker and Decision Matrix
**CRITICAL BLOCKER:** 
- Context propagation alone does not isolate tables that do not have RLS or another approved tenant-enforcement mechanism.
- Phase 2 currently protects ONLY `store`, `product`, `customer`, and `order`.
- Core commerce routes must remain blocked until their complete entity dependencies are classified and protected.

**We cannot block core Admin and Store routes without silencing the entire commerce backend.** We also cannot expand RLS to the entire schema automatically, nor can we rewrite the entire Storefront/Admin API from scratch, as both violate the approved Master Contract MVP scope.

### Framework Patch Design
* **Exact package and version:** `@medusajs/framework` v2.18.0
* **Exact source and compiled file:** `node_modules/@medusajs/framework/dist/http/utils/middlewares.js`
* **Exact function being patched:** `createRouteHandler` (specifically modifying the execution wrapper around the user's route handler).
* **Transaction start point:** Inside the patched `createRouteHandler`, immediately before executing the original route handler, we invoke `req.scope.resolve("manager").transaction(async (txManager) => { ... })`.
* **`set_config(..., true)` execution point:** Immediately after `txManager` is created and inside the transaction block, before yielding to the route handler.
* **How the downstream handler is awaited:** The patched wrapper natively `await`s the Medusa core route handler promise inside the `txManager.transaction` callback.
* **Commit and rollback behavior:** If the awaited core handler succeeds, MikroORM automatically commits. If the core handler throws, MikroORM catches and automatically issues a rollback.
* **Manager and transactionManager injection:** The `txManager` is explicitly registered into `req.scope` (the Awilix container) for the duration of the request: `req.scope.register({ manager: asValue(txManager), transactionManager: asValue(txManager) })`.
* **How workflows/module services receive it:** Because they resolve `manager` or `transactionManager` from `req.scope` (which we just overrode with `txManager`), they implicitly share the identical transaction and Postgres connection where `set_config` was run.
* **Behavior on thrown errors and rejected promises:** The patch propagates the error up to Medusa's global error handler, guaranteeing that the `txManager` issues a `ROLLBACK` and the connection is cleanly released to the pool without leaking tenant context.
* **Subscribers, jobs, and workers coverage:** NOT covered by this HTTP route patch. They execute outside the HTTP pipeline and require separate explicit wrapping (documented in Risk R-07).
* **Startup validation:** We will add a startup loader (`src/admin/loaders/patch-verifier.ts`) that imports `createRouteHandler` and asserts via `toString()` or runtime checks that our specific patch signature is present, failing the boot if missing.
* **Patch-package filename:** `patches/@medusajs+framework+2.18.0.patch`
* **Upgrade verification procedure:** Any version bump of `@medusajs/framework` will cause `patch-package` to fail or the startup loader to crash, enforcing a manual review of the `middlewares.js` AST before the new version can boot in production.

We must choose one of the following paths:

**Option A: Knex Pool Hooks**
- *Status:* `REJECTED_BY_ARCHITECTURE_SPIKE`
- *Reason:* Tarn.js `acquire` events are not awaited.

**Option B: Minimal Medusa 2.18.0 Framework Patch**
- *Status:* `SELECTED`
- *Reason:* Targeted, minimal patch to inject `withTenantTransaction` around core HTTP handlers restores core commerce flows safely.

**Option C: Expanded RLS plus Complete Custom Commerce APIs**
- *Status:* `REJECTED_OUT_OF_SCOPE`
- *Reason:* Violates MVP constraints.

**Next Action:** Await user decision on the `PlatformMembership` Phase 1 correction and final plan approval.

## 8. Required Phase 3 Tests
- Valid tenant member.
- Non-member denied.
- Inactive membership denied.
- Inactive tenant denied.
- Spoofed tenant ID denied.
- Malformed tenant ID denied.
- Tenant A actor cannot select Tenant B.
- Invalid domain/store locator denied.
- Missing tenant context denied.
- Tenant admin denied from Platform routes.
- Explicit Platform Admin access succeeds and is audited.
- Store-scoped user denied from another store.
- Unsafe Admin core route cannot bypass isolation.
- Unsafe Store core route cannot bypass isolation.
- Auth/session routes remain functional.
- HTTP request executes database work through `withTenantTransaction` proving context propagation.

## 9. Phase 3 Implementation Scope
**Included:**
- PlatformMembership model, migration, and authorization service
- Admin staff tenant resolution
- Public Storefront tenant/store resolution
- Trusted hostname normalization
- Publishable-key/store validation
- Active tenant and membership checks
- Store-scoped staff authorization
- Platform Admin audit logging
- AsyncLocalStorage context
- Exact-version framework patch POC and verification
- Explicit route allow/block matrix
- Required Phase 3 tests

**Explicitly Excluded:**
- Expansion of RLS to unapproved commerce tables
- Custom replacement commerce APIs
- Tenant/store provisioning workflows
- Phase 4 work
