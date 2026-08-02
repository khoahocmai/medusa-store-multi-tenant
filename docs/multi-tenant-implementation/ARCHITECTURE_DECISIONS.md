# Architecture Decisions

## ADR-001: Multi-Tenant Architecture Strategy

**Status:** ACCEPTED
**Context:** The system needs to support multiple independent tenants (businesses/franchises) within a single deployment, where each tenant can own multiple Medusa stores. Data isolation and security are paramount.
**Decision:** Adopt a Single-Application / Single-Database multi-tenancy model using PostgreSQL Row Level Security (RLS) and Medusa's module linking, governed by AsyncLocalStorage for request/transaction contexts.
**Reason:** This balances operational complexity (avoiding infrastructure overhead of multi-DB/multi-instance) with strong database-level data isolation guarantees.
**Alternatives considered:** 
- Schema-per-tenant (complex migrations and connection pooling).
- Database-per-tenant (high infrastructure cost and operational overhead).
- Application-level isolation only (high risk of accidental data leakage).
**Consequences:** Requires strict management of the `runtime_role` in PostgreSQL, application patches/hooks for context propagation, and careful review of core Medusa APIs to ensure they respect the RLS context.
**User approval:** APPROVE PHASE 0

## ADR-002: Framework Patching for Core Routes (Phase 2)

**Status:** REQUIRES_REEVALUATION
**Context:** During Phase 2, a decision was made that a framework patch was not required to enforce RLS, assuming standard middleware could wrap the context.
**Decision:** Originally "NO PATCH REQUIRED", but Phase 3 planning reveals that Express middleware cannot natively force all Medusa core routes, nested services, and background jobs to share a single PostgreSQL connection for `set_config('app.current_tenant_id')`. 
**Reason:** Medusa core workflows and module services instantiate their own connections or parallel transactions from the Awilix container, bypassing standard middleware transaction wrappers.

## ADR-003: Core Route Transaction Propagation Strategy (Phase 3)

**Status:** ACCEPTED (Implemented and tested in Phase 3)
**Context:** RLS policies on core Medusa tables (`product`, `order`, etc.) cause core API routes (e.g., `/store/products`) to fail-closed (return 0 rows) because they do not run inside our `withTenantTransaction` wrapper.
**Decision:** We must choose a propagation strategy that preserves core commerce usability without violating the MVP scope.
**Alternatives considered:**
1. **Supported Knex Pool Hooks (Status: REJECTED_BY_ARCHITECTURE_SPIKE):** Tarn.js `acquire` events are not awaited, meaning `set_config` races with application queries. `afterCreate` only runs once and cannot inject per-request tenant context.
2. **Minimal Version-Specific Framework Patch (Status: SELECTED):** Patch Medusa's internal HTTP handler pipeline to globally inject `withTenantTransaction`. This restores core commerce flows without rewriting them.
3. **Expanded RLS + Custom Commerce APIs (Status: REJECTED_OUT_OF_SCOPE):** Reject core routes entirely. Add RLS everywhere and build custom `/store/tenant/...` routes. Enormous maintenance cost, massive scope explosion. Violates MVP.
**Consequences:** The minimal framework patch for HTTP transaction propagation was applied, validated, and verified in Phase 3 using `patch-package`.
**User approval:** APPROVE ADR-003 OPTION B

## ADR-004: Core Defaults Bootstrap Strategy for RLS Runtime Role

**Status:** ACCEPTED (Implemented and tested in Phase 4)
**Context:** Medusa 2.18.0 unconditionally executes `createDefaultsWorkflow(container).run()` on every application boot. This workflow queries the `store` table to check if a default store exists. When starting with a `runtime_role` that strictly enforces RLS (NOSUPERUSER, NOBYPASSRLS) and lacks a global platform-admin context, this bootstrap sequence fails. The `runtime_role` is denied access to the existing store by RLS, causing the workflow to attempt to create a duplicate store, which fails via RLS/unique constraints. This physically prevents Medusa from starting in production or tests.
**Exact Medusa 2.18.0 source behavior:** At the end of `node_modules/@medusajs/medusa/dist/loaders/index.js`, Medusa imports `createDefaultsWorkflow` from `@medusajs/core-flows` and executes it. This execution is completely hardcoded and bypassing it natively is impossible.
**Selected patch target:** `@medusajs/medusa/dist/loaders/index.js` line 134-135.
**Rejected alternatives:**
1. *Prepare DB and start with `runtime_role` natively*: Fails because `runtime_role` still triggers the bootstrap sequence and crashes.
2. *Modify RLS to allow unauthenticated global reads on `store`*: Weakens tenant isolation significantly.
3. *Run the entire app globally as a platform admin*: Violates security constraints and risks leaking privileges.
4. *Patch the definition of `createDefaultsWorkflow`*: Changing `@medusajs/core-flows` breaks its explicit usage in other scripts or user-defined seed workflows. The correct target is the auto-bootloader.
**Environment-variable behavior:** 
- When `MEDUSA_SKIP_CORE_DEFAULTS` is explicitly `"true"`, the loader will skip calling `createDefaultsWorkflow(container).run()` and emit a warning log. 
- When absent or any other value, Medusa maintains its exact native behavior and automatically provisions defaults.
**Database-role separation:** 
- `test_db_admin` / `setup_admin`: May have `CREATEDB` strictly for creating the identified isolated test database. Must not have `CREATEROLE` unless separately justified and approved.
- `migration_role`: Used strictly for running migrations and module-link synchronization. Must not automatically have `SUPERUSER`, `CREATEDB`, or `CREATEROLE`.
- `runtime_role`: Remains strictly `NOSUPERUSER`, `NOBYPASSRLS`, not the schema owner, and subject to `FORCE ROW LEVEL SECURITY`.

**Empirical Feasibility Evidence:**
A custom script (`prove-feasibility.js`) was executed to verify the core bootstrap logic natively using the following command:
`node prove-feasibility.js`

- **Isolated database name:** `medusa_multi_tenant`
- **Role used:** `postgres` for setup, `runtime_role` for runtime boot.
- **Printed credentials:** None.
- **Temporary patch reverted:** Confirmed.
- **Git State:** `feat/multi-tenant` at HEAD `87f5899b7f89fc7de5729728726b520e101f00ba` with uncommitted changes.

**Execution output summary:**
```
=== Role Verification ===
runtime_role privileges: { rolname: 'runtime_role', rolsuper: false, rolbypassrls: false }
=== Clean DB Verification ===
Pre-start: store count = 0, sales_channel count = 0
=== Patch Application Loader ===
Patch applied.
=== Application Start 1 ===
Application started successfully
=== Verify No Defaults Created ===
Mid-start: store count = 0
=== Application Start 2 (Restart) ===
Application restarted successfully
=== Revert Loader Patch ===
Patch fully reverted.
```

**Production bootstrap procedure:**
1. Database is provisioned via CI/CD using `setup_role`.
2. Migrations and link sync are executed manually or via pipeline using `migration_role`.
3. The real application boots using `runtime_role` with `MEDUSA_SKIP_CORE_DEFAULTS=true`.
4. Tenant and Store resources are created exclusively through approved Phase 4 APIs by a platform admin.
**Test procedure:** Tests will use a custom script (not `medusaIntegrationTestRunner`'s auto DB create) to emulate the production bootstrap. It will create an isolated DB, run migrations using the setup role, and start a real HTTP server wrapper using the runtime role with `MEDUSA_SKIP_CORE_DEFAULTS=true`.
**Failure and rollback behavior:** If the environment variable is misspelled, the server will crash on boot (fail-safe). If the patch fails to apply after upgrading, tests will immediately fail during HTTP server start.
**Upgrade verification:** Before any Medusa upgrade, we must verify that `loaders/index.js` structurally still matches the patch. The custom test harness will inherently catch regressions since `runtime_role` will fail to boot if the defaults workflow runs again.
**Risks and limitations:** Medusa components (e.g., storefront API) that blindly assume the existence of a default Store or Sales Channel may error during runtime. This must be verified as part of the test plan.
**User approval:** APPROVE ADR-004 OPTION A
