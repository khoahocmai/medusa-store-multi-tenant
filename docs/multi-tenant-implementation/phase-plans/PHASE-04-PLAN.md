# Phase 4 Plan: Tenant and Store Provisioning APIs

## Status
Phase 4 status: NOT_STARTED  
Phase 4 plan status: DRAFT_AWAITING_USER_APPROVAL  
Next allowed action: APPROVE PHASE 4 PLAN  

## Objective
Implement controlled workflows and API routes for tenant and store lifecycle management, in strict adherence to Phase 4 of the Master Contract.

## User Review Required

> [!IMPORTANT]  
> Please review this plan to ensure it strictly follows the boundaries set by the Master Contract for Phase 4. Approval is required before execution begins.

---

## 1. Phase-Gate & Database Safety Validation

Before implementing any Phase 4 production code, the agent MUST perform the following validations:
1. Read `PROJECT_STATE.md`.
2. Read Phase 3 report (`PHASE-03-AUTH-MIDDLEWARE.md`).
3. Verify Phase 3 is marked `APPROVED_BY_USER`.
4. Verify ADR-003 is resolved (`ACCEPTED`).
5. Verify Phase 4 is the next sequential phase.
6. Record Git state:
   - `git rev-parse --show-toplevel`
   - `git branch --show-current`
   - `git rev-parse HEAD`
   - `git status --short`
7. Compare repository with the end state of Phase 3. 
   - Note any unrelated uncommitted files but DO NOT modify them.
   - If Phase 4 cannot be executed without touching unrelated files, or if the repository deviates from the approved Phase 3 end state on related files, immediately halt and set status to `BLOCKED`.

Before integration/database tests run, the agent MUST report:
- Database host, name, role.
- Whether role is superuser.
- Whether role has `BYPASSRLS`.
- Whether DB is dev, test, or production.
- Explicit confirmation of using an isolated test database.
- **Constraints**: No database/schema drops, no `.env` modifications, no unverified destructive runs on an unidentified database.

---

## 2. Proposed Workflows

### 2.1 `createTenantWorkflow` (`apps/backend/src/workflows/tenant/create-tenant.ts`)

- **Context & Actor Rules**:
  - `authenticated_actor_id`: Must be passed into the workflow from the authentication context. Cannot be overridden via the request body.
  - `initial_admin_actor_id`: The user who will be granted the initial membership of the new Tenant.
  - Only authenticated platform admins can provide the `initial_admin_actor_id`.
  - Missing tenant context in the request must *not* be inferred as platform mode. Route/middleware handles auth; workflow boundary protects the inputs.
  - Use the exact audit mechanism implemented and approved in prior phases for recording the authenticated platform actor. Do not invent a `created_by` field on the `Tenant` model if the approved Phase 1 model does not contain it.

- **Workflow Steps**:
  1. `verifyPlatformAdminStep`: Asserts that `authenticated_actor_id` has valid platform privileges.
  2. `validateCreateTenantInputStep`: Normalizes `name` and `handle`. Prevents duplicate handles. Validates `initial_admin_actor_id`.
  3. `createTenantStep`: Provisions the Tenant.
  4. `createInitialTenantMembershipStep`: Assigns the exact initial administrative role defined by the approved `TenantMembership` model. The role value must be verified before implementation.
  5. Returns the provisioned Tenant context.

- **Transaction, Retry & Compensation Strategy**:
  - The agent must verify whether Tenant creation and Membership creation actually share one supported database transaction in Medusa 2.18.0.
  - If a shared transaction cannot be proven, explicit compensation must be used and the workflow must not claim atomicity.
  - If Membership creation fails, compensation logic must delete the orphaned Tenant.
  - Idempotency ensures duplicate retries on the exact handle do not create a second Tenant.

### 2.2 `createTenantStoreWorkflow` (`apps/backend/src/workflows/tenant/create-tenant-store.ts`)

- **Context & Actor Rules**:
  - `tenant_id`: Strictly read from `tenantContext` (ALS). Cannot be overridden via request body.
  - `authenticated_actor_id`: Strictly read from authentication context.
  - Tenant must have a valid active status (e.g., `status === 'active'` per Phase 1 model). 
  - Membership must exist and be `is_active === true`. 
  - Allowed store-provisioning roles must match the exact approved `TenantMembership` role values (e.g., `owner` or `admin`).
  - A Medusa Store cannot belong to two Tenants.

- **Workflow Steps**:
  1. `validateCreateTenantStoreInputStep`: Normalizes and validates the domain locator.
  2. `resolveExistingProvisioningStep`:
     - Normalizes domain.
     - Checks if locator/domain already exists.
     - If it exists and belongs to the correct tenant with a complete provisioning, return the existing context.
     - If it exists but belongs to a different tenant, return `409 Conflict`.
     - If it is in a partial provisioning state, recover, compensate, or report a clear error.
     - Only proceed to create a new Store if no provisioning exists.
  3. `verifyTenantStatusStep`: Asserts the tenant is active.
  4. `verifyTenantAdminStep`: Asserts `authenticated_actor_id` holds an active authorized role for `tenant_id`.
  5. `invokeCoreCreateStoreStep`: 
     - Verify the actual Medusa 2.18.0 `createStoresWorkflow` behavior and output. 
     - Do not assume it automatically creates a default Sales Channel. 
     - If Sales Channel creation or linking is required by the approved design, use only supported workflows verified for this repository.
  6. `verifyStoreOwnershipAvailabilityStep`: Verifies the newly created Store is free to be linked (preventing cross-tenant linking).
  7. `linkTenantToStoreStep`: Links Tenant to the Store via `remoteLink.create`.
  8. `linkTenantToSalesChannelStep`: Links Tenant to the Sales Channel via `remoteLink.create` (if applicable).
  9. `createStoreLocatorStep`: Generates the `StoreLocator` domain mapping for HTTP resolution.
  10. Returns the provisioned Store context.

- **Transaction, Retry & Compensation Strategy**:
  - The agent must verify whether core creation steps and custom module steps can share a supported transaction boundary in Medusa 2.18.0. If this cannot be proven, explicit compensation must be used.
  - The agent must check Medusa Development Assistance Skills, exports, and actual API of Medusa 2.18.0 to verify if APIs like `deleteStoresWorkflow` or `deleteSalesChannelsWorkflow` exist and are safe to use.
  - If a compensation API does not exist or cannot clean up safely, the agent must document it as a blocker or known limitation, NOT report success, record the orphaned resource, and MUST NOT silently ignore cleanup errors.
  - Compensation must cover:
    - Tenant created, but Membership failed.
    - Store created, but tenant-store link failed.
    - tenant-store link created, but sales-channel link failed.
    - Links created, but locator creation failed.
    - Compensation itself failed.
  - Preflight idempotency (step 2) and unique constraints act as the final defense against concurrent provisioning requests. In the event of a race condition triggering a unique constraint, the system must read the updated state and return a deterministic result without leaving orphaned stores.

---

## 3. Proposed API Routes

### 3.1 `POST /admin/platform/tenants`
- **Rules**: 
  - Requires authenticated platform admin. Explicit platform authorization (`validatePlatformAdmin`).
  - Tenant admin accessing this returns `403`.
  - `actor_id` passed to workflow is taken from auth context.
  - Handle is normalized and unique. Action is audited using existing mechanisms.
  - Missing tenant context does *not* grant platform access.

### 3.2 `GET /admin/tenant/current`
- **Rules**: 
  - Strictly returns context verified by the middleware (`tenantId`, `accessMode`).
  - Never returns sensitive authorization data or metadata.

### 3.3 `POST /admin/tenant/stores`
- **Rules**:
  - `tenant_id` read from ALS `tenantContext`. `actor_id` read from auth context.
  - Request body *cannot* select/override the tenant.
  - Tenant and membership must be active with valid roles.
  - Provisioning executes safely under the RLS and tenant module path which has been proven safe.

### 3.4 `GET /admin/tenant/stores`
- **Rules**:
  - Queries utilizing `query.graph()` must start *strictly* from the `tenant-store` ownership link of the current `tenant_id`.
  - Only returns Stores belonging to the current tenant.
  - Direct IDs or filters passed by the client CANNOT bypass the tenant scope.
  - Only selects necessary fields.
  - Execution runs under the established `tenantContext` / RLS transaction wrapper proven in Phase 3.

### 3.5 `GET /store/context`
- **Rules**:
  - Public endpoint. Only returns public-safe context (resolved `tenantId` and `storeId`/`storeIds`).
  - Never exposes actors, memberships, roles, or platform metadata.
  - Domain resolution strictly matches `StoreLocator` normalization.
  - Malformed host/domain returns `400 Bad Request`.
  - Unknown or missing locator returns `404 Not Found` (fail-closed).
  - Never accepts tenant overrides from query parameters or untrusted headers.
  - Check Express `trust proxy` configuration; only trust `x-forwarded-host` when the proxy chain is configured and trusted.
  - Resolves the exact Tenant and Store.

---

## 4. Required Validations

- `tenant.handle`: Must be normalized, strictly formatted, and unique.
- Identifiers: Identifiers must be validated according to the exact ID types and constraints defined by the approved Phase 1 models and the Medusa 2.18.0 resources. Do not assume all identifiers are UUIDs.
- `domain`: Normalized (lowercased, stripped paths) and unique.
- Tenant Status: Checked against exact model fields.
- Membership: Checked for active existence.
- Roles: Checked for valid privileges to perform creation tasks (using exact enum values from Phase 1).
- Ownership & Constraints: Store ownership is mutually exclusive. Duplicate provisioning requests are identified and rejected or resolved idempotently. Cross-tenant resource linking is strictly blocked.
- Untrusted inputs: If `tenant_id` is supplied in the request body, the request must be rejected with `400 Bad Request`. The route must always derive `tenant_id` exclusively from the verified `tenantContext`.
- Locators: Malformed or missing locators fail gracefully and securely.

---

## 5. Required Test Plan

1. Platform admin creates tenant successfully (records exact authenticated platform actor to existing audit mechanism).
2. Tenant admin CANNOT call the platform tenant creation route (`403`).
3. Valid Tenant admin/owner creates a Store successfully in their own tenant.
4. Non-admin Tenant member CANNOT create a Store (`403`).
5. Inactive membership CANNOT create a Store (`403`).
6. Tenant user CANNOT create a Store in another tenant (`403`).
7. Tenant ID injected maliciously into request body CANNOT override the context.
8. Duplicate tenant handle is REJECTED.
9. Duplicate domain locator is REJECTED.
10. Duplicate provisioning / retry does NOT result in a second Store.
11. A Store belonging to Tenant A CANNOT be linked to Tenant B.
12. Store Locator successfully resolves the exact Tenant and Store.
13. Invalid/missing locator results in fail-closed behavior (`404 Not Found`).
14. Malformed public locator returns `400 Bad Request`.
15. An injected error in the middle of the workflow triggers the designed rollback/compensation mechanism.
16. Compensation failure is recorded and does not return success.
17. Resources created for Tenant A are INVISIBLE to Tenant B.
18. Missing tenant context does NOT result in accidental platform access.
19. `GET /admin/tenant/stores` CANNOT read another tenant's store via direct ID injection or filter manipulation.
20. Core workflow and query paths execute successfully through the RLS patch and do NOT leak context via the connection pool.
21. Two concurrent provisioning requests for the same domain do NOT create two Stores (unique constraint triggers safe recovery without orphaned resources).
22. Retry check occurs BEFORE Store creation.
23. Existing complete provisioning returns existing context; existing partial provisioning does NOT blindly create a new Store.
24. `x-forwarded-host` is NOT trusted when `trust proxy` is not enabled.
25. Role authorization tests use the exact role values of the actual model.
26. `createStoresWorkflow` and Sales Channel behavior is tested against actual Medusa 2.18.0 outputs.

---

## 6. Deliverables

- Successful build/compilation verification.
- Complete Type checks (if repository has a specific command for it).
- Workflow and Module unit/integration tests passing.
- HTTP Integration tests passing.
- Database/RLS isolation tests passing for the provisioning flows.
- Artifact `docs/multi-tenant-implementation/phase-reports/PHASE-04-PROVISIONING-API.md`.
- Updated `PROJECT_STATE.md`.
- Explicit records of created/modified/deleted files, commands run, and database changes.
- Explicit records of deviations, limitations, risks, and blockers.
- Git state explicitly reported post-implementation.
- Status transition of Phase 4 to `IMPLEMENTED_AWAITING_APPROVAL`.
- Explicit confirmation that Phase 5 has NOT started.
