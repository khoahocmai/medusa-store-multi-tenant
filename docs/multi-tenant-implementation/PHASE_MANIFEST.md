# Phase Manifest

This manifest strictly controls the phase execution order and bounds. It matches the `MASTER_CONTRACT.md`. No new phases may be introduced, and no phase may be skipped, renamed, merged, or reordered without explicit user approval.

## Phase 0 — Repository Audit and Architecture Lock
* **Objective:** Understand the repository before changing implementation.
* **Allowed Scope:** Create/update `docs/multi-tenant-implementation/` documentation only.
* **Excluded Scope:** Any production code changes.
* **Required Report:** `PHASE-00-AUDIT.md`
* **Next Phase:** 1

## Phase 1 — Foundation, Models, and Module Links
* **Objective:** Implement the minimal domain foundation for: `Platform → Tenant → Multiple Stores`
* **Allowed Scope:** Custom module, models, service, module registration, required indexes, unique constraints, module links, generated migration, model/module tests, compilation verification.
* **Excluded Scope:** RLS, tenant middleware, platform routes, provisioning workflows, storefront resolution, billing, Admin UI, core commerce isolation.
* **Required Report:** `PHASE-01-FOUNDATION.md`
* **Next Phase:** 2

## Phase 2 — PostgreSQL RLS and Tenant Context
* **Objective:** Implement database-enforced tenant isolation for the table scope approved in Phase 0.
* **Allowed Scope:** Database roles (`migration_role`, `runtime_role`), RLS policies (`tenant_id`, indexes, fail-closed policies), AsyncLocalStorage tenant context, transaction wrapper, pool isolation testing.
* **Excluded Scope:** HTTP tenant resolution or tenant API routes.
* **Required Report:** `PHASE-02-RLS-CONTEXT.md`
* **Next Phase:** 3

## Phase 3 — Authentication, Tenant Resolution, and Middleware
* **Objective:** Resolve tenant and store context securely for HTTP requests.
* **Allowed Scope:** Authentication before authorization, tenant membership validation, middleware order implementation, core route protection/blocking.
* **Excluded Scope:** Tenant provisioning workflows or UI.
* **Required Report:** `PHASE-03-AUTH-MIDDLEWARE.md`
* **Next Phase:** 4

## Phase 4 — Tenant and Store Provisioning APIs
* **Objective:** Implement controlled workflows and API routes for tenant and store lifecycle.
* **Allowed Scope:** Approved workflows (create tenant, create tenant store), approved routes (`/admin/platform/tenants`, `/admin/tenant/current`, `/admin/tenant/stores`, `/store/context`), route validation.
* **Excluded Scope:** Billing, subscription plans, cross-tenant analytics, Admin UI, storefront UI, production DNS automation.
* **Required Report:** `PHASE-04-PROVISIONING-API.md`
* **Next Phase:** 5

## Phase 5 — Isolation Coverage and Verification
* **Objective:** Verify and complete the approved MVP isolation scope across all relevant execution paths.
* **Allowed Scope:** Audit and test Admin APIs, Store APIs, workflows, Medusa services, MikroORM, Knex, transactions, subscribers, jobs, webhooks, pool reuse. Security negative tests.
* **Excluded Scope:** Expanding the entity-isolation matrix outside Phase 0 approval. Unapproved features.
* **Required Report:** `PHASE-05-ISOLATION-VERIFICATION.md`
* **Next Phase:** 6

## Phase 6 — Final Verification and Handoff
* **Objective:** Verify and document the existing implementation. Do not add new features.
* **Allowed Scope:** Repository reconciliation, full test execution, security verification, operational documentation, recording known limitations.
* **Excluded Scope:** Any new feature work.
* **Required Report:** `PHASE-06-FINAL-HANDOFF.md`
* **Next Phase:** None
