# Phase 4 Implementation Report: Tenant and Store Provisioning APIs

## Executive Summary
Phase 4 has been successfully implemented in strict accordance with the approved Phase 4 Plan and the Master Contract. The provisioning APIs for Tenant and Store lifecycles are now available, enforcing platform isolation and tenant constraints.

## Completed Objectives

### 1. Workflows
- **createTenantWorkflow**: Provisions a new Tenant and its initial administrative membership (`owner` or `admin`). Utilizes explicit compensation to safely roll back Tenant creation if Membership creation fails.
- **createTenantStoreWorkflow**: Provisions a new Medusa Store via `createStoresWorkflow` and a new default Sales Channel via `createSalesChannelsWorkflow`, then securely links them to the Tenant. Implements robust preflight idempotency and compensation mechanisms to prevent orphaned resources.

### 2. API Routes
- `POST /admin/platform/tenants`: Platform endpoint to provision tenants. Secured via `validatePlatformAdmin` and explicitly requires authentication.
- `GET /admin/tenant/current`: Securely returns the active tenant context resolved via `tenantResolutionMiddleware`.
- `POST /admin/tenant/stores`: Tenant endpoint to provision stores. Extracts `tenant_id` exclusively from `tenantContext`. Protects against cross-tenant attacks and body overrides.
- `GET /admin/tenant/stores`: Retrieves stores for the current tenant. Safely utilizes `query.graph()` starting from the tenant-store link to guarantee isolation.
- `GET /store/context`: Public endpoint providing safe domain resolution (returns only `tenantId` and `storeIds`). Complies with fail-closed rules for malformed or missing locators.

### 3. Validations & Constraints Enforcement
- Handled unique constraints correctly.
- Disallowed `tenant_id` override in request bodies.
- Strictly validated `actor_id` from the authentication context.
- Used Phase 1 approved model constraints.

### 4. Verification
- Built successfully (`npm run build`).
- Implemented and executed HTTP integration tests validating isolation, role enforcement, and provisioning flows.

## Deviations & Constraints
- Due to Medusa 2.18.0 internal boundaries, the custom module models and core Medusa models (Store, Sales Channel) do not share an implicit atomic transaction. Explicit compensation steps and `runAsStep` rollback features were used to guarantee clean failure modes.
- `deleteStoresWorkflow` and `deleteSalesChannelsWorkflow` were verified to exist in `@medusajs/core-flows` and correctly clean up core resources if a subsequent link fails.

### Verification Status (Resolved)

* **Status**: `IMPLEMENTED_AWAITING_APPROVAL`
* **Evidence**:
  * ADR-004 Option A was approved and successfully patched Medusa 2.18.0 to skip core defaults.
  * Integration tests refactored to test HTTP APIs dynamically (testing context propagation).
  * The exact 26 HTTP integration tests defined in `PHASE-04-PLAN.md` (plus 3 extra security tests) were executed and successfully mapped 1-to-1 in the final walkthrough with 29/29 total tests passing.
  * A dedicated test harness isolates database migrations (using `postgres`) from HTTP runtime execution (using `runtime_role`).
  * `runtime_role` was verified to NOT have `SUPERUSER` or `BYPASSRLS` privileges.
  * Application boots successfully without crashing because `MEDUSA_SKIP_CORE_DEFAULTS` successfully disables the unauthenticated core bootstrap.
  * Tenant resolution middleware strictly verifies the decoded JWT signature to extract `actor_id` before querying the database for explicit membership authorization, entirely preventing access leakage from absent or spoofed headers.
  * Verification correctly demonstrated cross-tenant linking is strictly impossible at the DB level, and compensation failures are recorded successfully to the audit log.

## Detailed Report Information

### Files Created, Modified, Deleted
**Created:**
- `apps/backend/src/workflows/tenant/create-tenant.ts`
- `apps/backend/src/workflows/tenant/create-tenant-store.ts`
- `apps/backend/src/workflows/tenant/steps/validate-create-tenant-store-input.ts`
- `apps/backend/src/workflows/tenant/steps/resolve-existing-provisioning.ts`
- `apps/backend/src/workflows/tenant/steps/verify-tenant-status.ts`
- `apps/backend/src/workflows/tenant/steps/verify-tenant-admin.ts`
- `apps/backend/src/workflows/tenant/steps/create-tenant-membership.ts`
- `apps/backend/src/workflows/tenant/steps/create-store-locator.ts`
- `apps/backend/src/api/admin/platform/tenants/route.ts`
- `apps/backend/src/api/admin/platform/tenants/validators.ts`
- `apps/backend/src/api/admin/tenant/current/route.ts`
- `apps/backend/src/api/admin/tenant/stores/route.ts`
- `apps/backend/src/api/admin/tenant/stores/validators.ts`
- `apps/backend/src/api/store/context/route.ts`

**Modified:**
- `apps/backend/integration-tests/http/custom-provisioning.spec.ts` (Comprehensive isolation/integration tests implemented, mapped exactly to all 26 approved tests + 3 extra security tests)
- `apps/backend/src/api/middlewares.ts` (Minor route matcher configuration)
- `apps/backend/package.json` (Added patch-package for ADR-004)
- `apps/backend/patches/@medusajs+medusa+2.18.0.patch` (ADR-004 Option A framework patch)

**Deleted:**
- None

### Database Changes
- No schema or migration changes were made in Phase 4. Existing Phase 1 and Phase 2 models, links, and RLS policies were utilized to prove isolation successfully.

### Commands Executed
- `npm run build` (Verified Medusa build successfully generates types and compiles).
- `npx jest integration-tests/http/custom-provisioning.spec.ts --runInBand` (29/29 tests passed).
- `npx patch-package @medusajs/medusa` (To generate the ADR-004 patch).

### Test Results
- **Approved Tests:** 26/26 passed.
- **Extra Tests:** 3/3 passed.
- **Failed:** 0
- **Skipped:** 0
- **Total:** 29/29 tests successfully passed with explicit assertions and DB isolation proofs.
- **Exact Jest Summary:** 
  - `Test Suites: 1 passed, 1 total`
  - `Tests:       29 passed, 29 total`
  - `Snapshots:   0 total`

### Deviations
- **Storefront Build Failure:** `npm run build` at the monorepo root exits with code 1 because the optional Next.js storefront fails to statically prerender `/404` pages when the Medusa backend is not actively running (`fetch failed`). This is an expected, pre-existing external build issue of the Next.js storefront unrelated to the Phase 4 Medusa backend APIs and workflows. The backend package compiles perfectly.

### Security Observations
- DB cross-tenant linking via `tenant_sales_channel` or `tenant_store` is strictly impossible. `query.graph()` reads correctly fail-closed under `runtime_role` unless `app.current_tenant_id` is applied.
- Platform contexts enforce explicit Role validation (verifying active `PlatformMembership`), preventing malicious `x-tenant-id` overriding.
- `MEDUSA_SKIP_CORE_DEFAULTS` successfully disables the insecure unauthenticated `admin_user` and `store` generation on startup.

### Known Limitations
- Background jobs are outside the current scope and remain unpatched for context propagation (tracked in Phase 5).
- Front-end / Storefront interactions with these new isolated endpoints are untested as this is a backend-only phase.

### Risks/Blockers
- **Blockers:** None.
- **Mitigated Risks:** R-02, R-03, R-04, R-05, R-06, R-09, and R-10 were all fully mitigated and proven via the integration tests during this phase.

### Git State Before and After
- **Before:** Commit `87f5899`
- **After:** The current uncommitted tree (to be committed upon user approval of Phase 4).

### Next Phase Readiness
- Phase 4 is fully implemented and tested. The project is strictly within bounds and ready for Phase 5 (Isolation Coverage and Verification).

### Approval Required
- **Next Allowed Action:** `APPROVE PHASE 4`
