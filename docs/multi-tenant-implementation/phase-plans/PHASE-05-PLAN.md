# Phase 5 Plan: Isolation Coverage and Verification

## Status

- **Phase 5 status:** `NOT_STARTED`
- **Phase 5 plan status:** `DRAFT_AWAITING_USER_APPROVAL`
- **Next allowed action:** `APPROVE PHASE 5 PLAN`

---

## 1. Objective

Verify and complete the approved MVP isolation scope across all relevant execution paths.

Phase 5 must follow the entity-isolation matrix approved in Phase 0. It must not silently expand the matrix, introduce new business capabilities, or claim complete multi-tenancy without test evidence.

Phase 5 is verification-first:

1. Recover the approved isolation scope.
2. Audit the existing execution surfaces.
3. Test the current implementation.
4. Classify each entity and execution path accurately.
5. Stop and report a blocker if a required security correction would exceed the approved scope.

---

## 2. Phase-Gate Validation

Before creating or modifying any Phase 5 test or report file, the agent must:

1. Read:
   - `.agents/skills/building-with-medusa/SKILL.md`
   - `docs/multi-tenant-implementation/MASTER_CONTRACT.md`
   - `docs/multi-tenant-implementation/PHASE_MANIFEST.md`
   - `docs/multi-tenant-implementation/PROJECT_STATE.md`
   - `docs/multi-tenant-implementation/APPROVAL_LOG.md`
   - `docs/multi-tenant-implementation/ARCHITECTURE_DECISIONS.md`
   - `docs/multi-tenant-implementation/RISK_REGISTER.md`
   - `docs/multi-tenant-implementation/phase-reports/PHASE-00-AUDIT.md`
   - `docs/multi-tenant-implementation/phase-reports/PHASE-01-FOUNDATION.md`
   - `docs/multi-tenant-implementation/phase-reports/PHASE-02-RLS-CONTEXT.md`
   - `docs/multi-tenant-implementation/phase-reports/PHASE-03-AUTH-MIDDLEWARE.md`
   - `docs/multi-tenant-implementation/phase-reports/PHASE-04-PROVISIONING-API.md`
   - this approved Phase 5 plan.

2. Verify:
   - Phase 4 is recorded as `APPROVED_BY_USER`.
   - Phase 5 is the next sequential phase.
   - This Phase 5 plan is recorded as `APPROVED_BY_USER`.
   - The approved plan has not changed after approval.
   - The Master Contract, Phase Manifest, Project State, approval log, Phase 4 report, and repository state do not conflict.

3. Record the repository state:

   ```bash
   git rev-parse --show-toplevel
   git branch --show-current
   git rev-parse HEAD
   git status --short
   ```

4. Compare Phase 5-related files with the recorded Phase 4 end state.

5. Record unrelated uncommitted changes and leave them untouched.

6. Do not require an absolutely clean working tree. The requirement is:

   > The repository must match the recorded Phase 4 end state for Phase 5-related files. Existing unrelated uncommitted changes must be recorded and left untouched.

7. If any approval, plan-integrity, Git, repository, database, or documentation inconsistency exists:
   - set Phase 5 to `BLOCKED`;
   - record exact evidence;
   - do not modify implementation or test files;
   - stop and wait for user instruction.

---

## 3. Exact Authorized Phase 5 Scope

Phase 5 may audit and test the existing implementation for:

- Admin APIs;
- Store APIs;
- custom workflows;
- Medusa services;
- direct repository access;
- MikroORM;
- Knex and raw SQL;
- transactions;
- workflow retries;
- workflow compensation;
- connection-pool reuse;
- parallel requests from different tenants;
- existing subscribers;
- existing scheduled or background jobs;
- existing webhooks.

Phase 5 may:

- create the approved Phase 5 isolation test file;
- add test-only helpers inside that test file when necessary;
- reuse the proven Phase 4 isolated HTTP/RLS test harness;
- execute backend build and approved regression tests;
- document verified gaps, blocked routes, shared entities, and known limitations;
- update Phase 5 documentation and risk status using actual evidence.

Phase 5 must test the current behavior before proposing any implementation correction.

---

## 4. Explicitly Excluded Scope

Phase 5 must not:

- expand the entity-isolation matrix beyond Phase 0 approval;
- add RLS to a new entity not approved in Phase 0;
- add new APIs, workflows, routes, business features, or models;
- add billing, subscription, analytics, UI, storefront, DNS automation, or deployment work;
- upgrade Medusa or any dependency;
- add a dependency;
- refactor unrelated code;
- modify unrelated formatting;
- create demonstration subscribers, jobs, webhooks, seeders, or fixtures merely to satisfy a checklist;
- modify `.env`;
- run production migrations;
- modify an approved phase plan or approved phase report;
- begin Phase 6;
- claim complete multi-tenancy without complete supporting evidence.

---

## 5. Exact Phase 0-Approved Entity-Isolation Matrix

The following table must be reproduced and verified against `PHASE-00-AUDIT.md` before Phase 5 tests begin.

| Entity | Tenant-owned | Store-owned | Shared | Isolation mechanism | Planned phase |
|---|---:|---:|---:|---|---|
| Tenant | No | No | Platform | App-Enforced | 1 |
| Store | Yes | No | No | RLS / Link-Enforced | 1, 2 |
| User/Actor | No | No | Shared | App-Enforced (Membership) | 1, 3 |
| Product | Yes | No | No | RLS | 2, 5 |
| Order | Yes | Yes | No | RLS | 2, 5 |
| Customer | Yes | Yes | No | RLS | 2, 5 |

This matrix is authoritative for Phase 5 scope.

The following entities may be audited because they support or intersect with the approved model, but their presence in this plan does not add them to the Phase 0-approved tenant-owned entity matrix:

- Sales Channel;
- Region;
- TenantMembership;
- PlatformMembership;
- StoreLocator;
- tenant-store link;
- tenant-sales-channel link;
- Cart;
- Inventory;
- Pricing;
- Promotion;
- Fulfillment;
- Payment.

Entities outside the approved matrix may only be classified as:

- `LINK-ENFORCED`;
- `BLOCKED ROUTE`;
- `SHARED BY DESIGN`;
- `NOT IMPLEMENTED`;
- `OUT OF SCOPE`.

Phase 5 must not introduce new isolation implementation for those entities unless separately approved by the user through a plan amendment.

---

## 6. Required Isolation Classifications

Every relevant entity and execution path must be assigned exactly one of these classifications:

- `DATABASE-ENFORCED`
- `APPLICATION-ENFORCED`
- `LINK-ENFORCED`
- `BLOCKED ROUTE`
- `SHARED BY DESIGN`
- `NOT IMPLEMENTED`

Each classification must also have one evidence status:

- `VERIFIED FROM EXISTING EVIDENCE`
- `VERIFIED IN PHASE 5`
- `TO BE VERIFIED IN PHASE 5`
- `UNVERIFIED`
- `NOT APPLICABLE`

A classification must not be marked verified without exact supporting evidence such as:

- migration and policy name;
- `ENABLE ROW LEVEL SECURITY`;
- `FORCE ROW LEVEL SECURITY`;
- tenant column and index;
- database role evidence;
- middleware or route matcher;
- link definition;
- exact integration test;
- exact executed command and result.

Initial classifications for planning are:

| Entity or supporting surface | Initial classification | Evidence status |
|---|---|---|
| Tenant | `APPLICATION-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| Store | `DATABASE-ENFORCED` and `LINK-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| User/Actor | `SHARED BY DESIGN` with membership enforcement | `TO BE VERIFIED IN PHASE 5` |
| Product | `DATABASE-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| Order | `DATABASE-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| Customer | `DATABASE-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| Sales Channel | `LINK-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| Region | `LINK-ENFORCED` or `SHARED BY DESIGN` | `TO BE VERIFIED IN PHASE 5` |
| TenantMembership | `APPLICATION-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| PlatformMembership | `APPLICATION-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| StoreLocator | `APPLICATION-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| tenant-store link | `LINK-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| tenant-sales-channel link | `LINK-ENFORCED` | `TO BE VERIFIED IN PHASE 5` |
| Cart | `BLOCKED ROUTE`, `SHARED BY DESIGN`, or `NOT IMPLEMENTED` | `TO BE VERIFIED IN PHASE 5` |
| Inventory | `BLOCKED ROUTE`, `SHARED BY DESIGN`, or `NOT IMPLEMENTED` | `TO BE VERIFIED IN PHASE 5` |
| Pricing | `BLOCKED ROUTE`, `SHARED BY DESIGN`, or `NOT IMPLEMENTED` | `TO BE VERIFIED IN PHASE 5` |
| Promotion | `BLOCKED ROUTE`, `SHARED BY DESIGN`, or `NOT IMPLEMENTED` | `TO BE VERIFIED IN PHASE 5` |
| Fulfillment | `BLOCKED ROUTE`, `SHARED BY DESIGN`, or `NOT IMPLEMENTED` | `TO BE VERIFIED IN PHASE 5` |
| Payment | `BLOCKED ROUTE`, `SHARED BY DESIGN`, or `NOT IMPLEMENTED` | `TO BE VERIFIED IN PHASE 5` |

The final Phase 5 report must replace every ambiguous initial classification with a verified classification or an explicit unresolved limitation.

---

## 7. Audit Coverage

### 7.1 Admin APIs

Audit and test:

- authentication occurs before tenant authorization;
- `x-tenant-id` is treated only as a requested context;
- membership is active and belongs to the requested tenant;
- tenant routes fail when context is missing;
- tenant actors cannot access platform routes;
- direct-ID access cannot bypass tenant isolation;
- filters and pagination cannot expand the tenant scope;
- platform access is explicit and requires active `PlatformMembership`;
- missing tenant context never implies platform mode.

### 7.2 Store APIs

Audit and test:

- public Store context is derived from the approved locator mechanism;
- malformed or unknown locators fail closed;
- spoofed host, forwarded host, tenant ID, or store ID cannot select another tenant;
- exposed Product or other approved entity reads remain tenant-scoped;
- Store API routes that depend on unprotected entities are blocked or documented.

### 7.3 Workflows

Audit and test:

- tenant context reaches workflow steps;
- workflow retry does not create cross-tenant duplicates;
- compensation executes in the correct tenant context;
- compensation failure is visible and never reported as success;
- rollback does not leak tenant context into a reused connection.

### 7.4 Medusa services and repositories

Audit and test:

- approved Medusa service calls use the expected transaction manager;
- direct repository or service calls without tenant context fail closed;
- native service filters do not substitute for RLS evidence;
- a direct resource ID cannot bypass RLS.

### 7.5 MikroORM

Audit and test:

- the entity manager used by approved paths is bound to the tenant transaction;
- missing tenant context cannot read protected rows;
- Tenant A cannot update or delete Tenant B rows;
- entity-manager reuse does not preserve a previous tenant context.

### 7.6 Knex and raw SQL

Audit and test:

- transaction-local `set_config('app.current_tenant_id', ..., true)` is used;
- missing or invalid context returns no protected rows or fails closed;
- raw SQL cannot read, update, or delete another tenant’s protected rows;
- pooled connections do not retain the previous transaction-local setting.

### 7.7 Subscribers, jobs, and webhooks

For every existing background execution path:

1. Verify that the path actually exists.
2. Verify whether it accesses a Phase 0-approved tenant-owned entity.
3. Identify the tenant ID source.
4. Verify the tenant ID is trusted, authenticated, or signed.
5. Verify ALS context propagation.
6. Verify database transaction context propagation.
7. Test the path only when it is existing and inside the approved scope.

Do not create a new path merely to satisfy Phase 5 coverage.

An absent or out-of-scope path must be recorded as one of:

- `NOT IMPLEMENTED`;
- `OUT OF SCOPE`;
- `KNOWN LIMITATION`.

---

## 8. Required Actors and Contexts

Applicable tests must cover:

- Tenant A admin;
- Tenant A member;
- Tenant B admin;
- Tenant B member;
- platform admin;
- actor with active `PlatformMembership`;
- actor without `PlatformMembership`;
- store-scoped user;
- missing authentication;
- missing tenant context;
- invalid tenant context;
- spoofed `x-tenant-id`;
- spoofed store ID;
- invalid locator;
- reused database connection;
- parallel requests from Tenant A and Tenant B;
- existing in-scope background execution, when found.

---

## 9. Required Operation Matrix

For every Phase 0-approved tenant-owned resource, each operation below must have:

- at least one test ID and result; or
- an explicit `N/A` or `BLOCKED ROUTE` classification with evidence and reason.

Required operations:

- Create
- Read one
- Read list
- Update
- Delete
- Filter
- Pagination
- Direct-ID access
- Foreign-key spoofing
- Cross-tenant linking

### 9.1 Planned entity-operation coverage

| Entity | Create | Read one | Read list | Update | Delete | Filter | Pagination | Direct-ID | FK spoofing | Cross-tenant linking |
|---|---|---|---|---|---|---|---|---|---|---|
| Store | `STORE-CREATE-*` | `STORE-READ-ONE-*` or N/A | `STORE-LIST-*` | `STORE-UPDATE-*` or `BLOCKED ROUTE` | `STORE-DELETE-*` or `BLOCKED ROUTE` | `STORE-FILTER-*` or N/A | `STORE-PAGE-*` or N/A | `STORE-DIRECT-ID-*` | `STORE-FK-*` | `STORE-LINK-*` |
| Product | `PRODUCT-CREATE-*` | `PRODUCT-READ-ONE-*` | `PRODUCT-LIST-*` | `PRODUCT-UPDATE-*` | `PRODUCT-DELETE-*` | `PRODUCT-FILTER-*` | `PRODUCT-PAGE-*` | `PRODUCT-DIRECT-ID-*` | `PRODUCT-FK-*` or N/A | `PRODUCT-LINK-*` or N/A |
| Order | `ORDER-CREATE-*` or N/A | `ORDER-READ-ONE-*` | `ORDER-LIST-*` | `ORDER-UPDATE-*` or `BLOCKED ROUTE` | `ORDER-DELETE-*` or `BLOCKED ROUTE` | `ORDER-FILTER-*` | `ORDER-PAGE-*` | `ORDER-DIRECT-ID-*` | `ORDER-FK-*` | `ORDER-LINK-*` or N/A |
| Customer | `CUSTOMER-CREATE-*` | `CUSTOMER-READ-ONE-*` | `CUSTOMER-LIST-*` | `CUSTOMER-UPDATE-*` | `CUSTOMER-DELETE-*` | `CUSTOMER-FILTER-*` | `CUSTOMER-PAGE-*` | `CUSTOMER-DIRECT-ID-*` | `CUSTOMER-FK-*` | `CUSTOMER-LINK-*` or N/A |

The implementation phase must replace every wildcard family with concrete test IDs.

Operations that do not exist in the approved API surface must not cause new routes to be created. They must be classified as `N/A` or `BLOCKED ROUTE` with exact evidence.

---

## 10. Minimum Security Test Families

The final test suite must include concrete tests from the following families.

### 10.1 HTTP Admin tests

- `HTTP-ADMIN-AUTH-*`: authentication and membership enforcement;
- `HTTP-ADMIN-SPOOF-*`: spoofed tenant and store identifiers;
- `HTTP-ADMIN-DIRECT-ID-*`: direct access to another tenant’s resource;
- `HTTP-ADMIN-FILTER-*`: filter and pagination isolation;
- `HTTP-ADMIN-CRUD-*`: applicable Create, Read, Update, and Delete isolation;
- `HTTP-ADMIN-LINK-*`: foreign-key and cross-tenant link spoofing.

### 10.2 HTTP Store tests

- `HTTP-STORE-LOCATOR-*`: locator resolution and fail-closed behavior;
- `HTTP-STORE-SPOOF-*`: spoofed host, forwarded host, tenant ID, or store ID;
- `HTTP-STORE-PRODUCT-*`: Product isolation for the exposed Store API;
- `HTTP-STORE-BLOCK-*`: unsafe Store API route remains blocked.

### 10.3 Platform-boundary tests

- `HTTP-PLATFORM-MISSING-*`: missing tenant context does not imply platform mode;
- `HTTP-PLATFORM-DENY-*`: tenant actor cannot use a platform route;
- `HTTP-PLATFORM-MEMBERSHIP-*`: active `PlatformMembership` is required;
- `HTTP-PLATFORM-SPOOF-*`: spoofed platform context is rejected;
- `HTTP-PLATFORM-RLS-*`: platform behavior does not accidentally gain database bypass through `runtime_role`;
- `HTTP-PLATFORM-AUDIT-*`: platform action is explicit and auditable where an approved audit mechanism exists.

### 10.4 ORM and SQL tests

- `ORM-MISSING-CONTEXT-*`;
- `ORM-CROSS-TENANT-READ-*`;
- `ORM-CROSS-TENANT-UPDATE-*`;
- `ORM-CROSS-TENANT-DELETE-*`;
- `SQL-MISSING-CONTEXT-*`;
- `SQL-INVALID-CONTEXT-*`;
- `SQL-CROSS-TENANT-READ-*`;
- `SQL-CROSS-TENANT-UPDATE-*`;
- `SQL-CROSS-TENANT-DELETE-*`.

### 10.5 Connection and concurrency tests

- `POOL-SEQUENTIAL-*`;
- `POOL-ROLLBACK-*`;
- `POOL-INVALID-CONTEXT-*`;
- `PARALLEL-TENANT-*`;
- `PARALLEL-PROVISIONING-*`, when applicable.

### 10.6 Workflow tests

- `WORKFLOW-CONTEXT-*`;
- `WORKFLOW-RETRY-*`;
- `WORKFLOW-COMPENSATION-*`;
- `WORKFLOW-COMPENSATION-FAILURE-*`.

### 10.7 Background execution tests

- `BACKGROUND-CONTEXT-*`, only when an existing in-scope path is found;
- otherwise record `NOT IMPLEMENTED`, `OUT OF SCOPE`, or `KNOWN LIMITATION`.

---

## 11. Exact Files

### 11.1 Test files authorized

Create or modify:

```text
apps/backend/integration-tests/http/isolation-verification.spec.ts
```

Test-only helpers may be added inside this file.

A separate helper file is not authorized unless the plan is amended and explicitly approved.

### 11.2 Production files authorized

```text
No production source files are authorized for modification under this plan.
```

Existing production files may be read and audited.

If a Phase 5 test discovers a production security defect:

1. stop implementation;
2. set Phase 5 to `BLOCKED`;
3. identify the exact affected file;
4. describe the minimal proposed correction;
5. explain why the correction remains inside or exceeds the Phase 0 and Phase 5 scope;
6. request an explicit Phase 5 plan amendment;
7. do not modify production code before approval.

### 11.3 Documentation files authorized

Create:

```text
docs/multi-tenant-implementation/phase-reports/PHASE-05-ISOLATION-VERIFICATION.md
```

Update:

```text
docs/multi-tenant-implementation/PROJECT_STATE.md
docs/multi-tenant-implementation/RISK_REGISTER.md
```

`RISK_REGISTER.md` may only be updated from evidence obtained during Phase 5.

Do not modify:

- `MASTER_CONTRACT.md`;
- `PHASE_MANIFEST.md`;
- approved Phase 0–4 plans;
- approved Phase 0–4 reports;
- this Phase 5 plan after approval.

---

## 12. Commands

Before running any command, verify that the command targets the backend workspace and an isolated test database.

Expected commands:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
```

```bash
cd apps/backend
npm run build
```

```bash
cd apps/backend
npx jest integration-tests/http/isolation-verification.spec.ts --runInBand
```

```bash
cd apps/backend
npx jest integration-tests/http/custom-provisioning.spec.ts --runInBand
```

The agent must locate the existing Phase 2 and Phase 3 security regression test files before running them.

Rules:

- run only test files that already exist;
- record the exact discovered path and executed command;
- do not create a missing Phase 2 or Phase 3 regression file merely to satisfy this plan;
- do not run the monorepo root build when the known storefront build failure is unrelated to the backend;
- do not install or upgrade packages.

---

## 13. Database Safety and Test Harness

Reuse the proven Phase 4 isolated HTTP/RLS test harness unless the agent documents why it cannot support a required test.

Before every database or integration test run, report:

- database host;
- database name;
- database role;
- database environment type;
- whether the role is superuser;
- whether the role has `BYPASSRLS`;
- whether the role owns the tested tables;
- confirmation that the target is isolated and non-production.

Preserve role separation:

### Setup role

- performs only approved test-database setup;
- may have only privileges previously approved for that purpose;
- must not be used for application requests.

### Migration role

- runs migrations and module-link synchronization;
- owns or alters the schema as approved;
- must not be used by the running application.

### Runtime role

- `NOSUPERUSER`;
- `NOBYPASSRLS`;
- is not the schema owner;
- is subject to `FORCE ROW LEVEL SECURITY`;
- is used for application HTTP, service, ORM, and SQL verification.

Explicitly prohibited:

- database drop;
- schema drop;
- automatic database reset;
- broad truncate;
- destructive cleanup;
- production migration;
- migration against an unidentified database;
- tests against an unidentified database;
- hardcoded test database name unless runtime verification proves it safe and isolated;
- `.env` modification;
- printing passwords;
- printing complete database URLs.

If the existing harness performs a prohibited action, stop and set Phase 5 to `BLOCKED`. Do not silently weaken the safety rules.

---

## 14. Failure and Blocker Handling

When a test fails:

1. Determine whether the failure is:
   - a test defect;
   - missing test setup;
   - expected blocked behavior;
   - a documentation mismatch;
   - an existing production security defect;
   - an out-of-scope architecture gap.

2. Test-only corrections inside `isolation-verification.spec.ts` are allowed when they do not change the security expectation.

3. Do not weaken an assertion merely to make a test pass.

4. Do not change expected `403`, `404`, empty-result, or fail-closed behavior without evidence and user approval.

5. If production code must change:
   - set Phase 5 to `BLOCKED`;
   - preserve the working tree;
   - record exact Git state;
   - identify all Phase 5 files changed;
   - identify the exact production file and defect;
   - propose safe recovery or amendment options;
   - wait for user instruction.

6. Do not run:
   - `git reset --hard`;
   - `git clean -fd`;
   - `git checkout -- .`;
   - `git restore .`;
   - `git rebase`;
   - automatic revert;
   - automatic branch change;
   - commit or push without explicit user request.

---

## 15. Reporting Requirements

The Phase 5 report must use the Master Contract per-phase report structure and include:

- status;
- objective;
- authorized scope;
- explicitly excluded scope;
- repository state before work;
- exact approved Phase 0 matrix;
- initial and final isolation classifications;
- execution surfaces audited;
- operation matrix coverage;
- concrete test IDs;
- passed tests;
- failed tests;
- skipped tests;
- not-run tests;
- `N/A` operations and reasons;
- commands and actual outputs;
- files created;
- files modified;
- files deleted;
- database changes;
- database role evidence;
- `NOSUPERUSER` evidence;
- `NOBYPASSRLS` evidence;
- table-ownership evidence;
- RLS policy evidence;
- `FORCE ROW LEVEL SECURITY` evidence;
- missing-context evidence;
- invalid-context evidence;
- direct-ID evidence;
- foreign-key spoofing evidence;
- cross-tenant linking evidence;
- pool-reuse evidence;
- rollback evidence;
- parallel-request evidence;
- workflow retry and compensation evidence;
- background execution findings;
- platform-admin boundary findings;
- blocked routes;
- shared entities;
- entities not implemented;
- known limitations;
- security observations;
- risks and blockers;
- deviations from plan;
- repository state after work;
- summary;
- next phase readiness;
- approval required.

Do not report a classification as verified when its supporting test was skipped or not run.

Do not claim “complete multi-tenancy” unless every approved entity, applicable operation, and required execution path has supporting evidence.

---

## 16. Risk Register Rules

Phase 5 may update the status of existing risks only when evidence supports the change.

In particular:

- `R-07` may be mitigated only if an existing in-scope background path is found and successfully tested with trusted tenant context and database transaction propagation.
- If no applicable background path exists, retain the risk or record the exact limitation; do not fabricate a test path.
- `R-08` may be mitigated only after the relevant core routes are audited and tested, with unsafe routes proven blocked and approved protected routes proven isolated.
- A passing custom provisioning suite alone is not sufficient evidence to close all core-route risks.

Newly discovered risks may be added with:

- exact evidence;
- severity;
- affected phase;
- mitigation;
- current status.

Do not mark a risk mitigated based only on intended design.

---

## 17. Acceptance Criteria

Phase 5 is complete only when:

- Phase-gate validation succeeds.
- The exact Phase 0 entity-isolation matrix is verified.
- Every relevant entity has a final isolation classification.
- Every applicable approved entity-operation pair has:
  - an executed test result; or
  - an explicit `N/A` or `BLOCKED ROUTE` classification with evidence.
- All required security-negative test families are covered.
- Tenant A cannot read, update, delete, link, or directly access Tenant B protected resources.
- Tenant B receives equivalent isolation guarantees.
- Missing and invalid context fail closed.
- Spoofed tenant ID and store ID are rejected.
- Platform access remains explicit and does not arise from missing tenant context.
- `runtime_role` remains `NOSUPERUSER` and `NOBYPASSRLS`.
- `FORCE ROW LEVEL SECURITY` is verified for the approved protected tables.
- Reused pooled connections do not retain tenant context.
- Transaction rollback does not leak context.
- Parallel requests do not mingle tenant context.
- Existing in-scope background paths are tested, or their absence is documented accurately.
- All authorized tests pass.
- Failed, skipped, not-run, blocked, and N/A items are reported honestly.
- No production source file was modified under this plan.
- No out-of-scope entity or feature was implemented.
- The Phase 5 report is completed.
- `PROJECT_STATE.md` is updated.
- `RISK_REGISTER.md` is updated only from evidence.
- Git state before and after is reported.
- Phase 5 is set to `IMPLEMENTED_AWAITING_APPROVAL`.
- Phase 6 has not been started.
- The agent stops and requires explicit user approval.

---

## 18. End-of-Phase Gate

At completion, the agent must respond using the required Master Contract format:

```markdown
## Phase 5 completed

**Status:** IMPLEMENTED_AWAITING_APPROVAL

### Summary
- ...

### Files changed
- ...

### Database changes
- ...

### Tests executed
- Command: ...
- Result: PASS / FAIL / NOT RUN
- Evidence: ...

### Security findings
- ...

### Deviations
- None / ...

### Known limitations
- ...

### Reports
- `docs/multi-tenant-implementation/phase-reports/PHASE-05-ISOLATION-VERIFICATION.md`

### Git state
- Branch:
- Commit:
- Working tree:

### Gate
The next phase has NOT been started.

To approve this phase, the user must explicitly send:

`APPROVE PHASE 5`
```

Do not begin Phase 6.

---

## 19. Approval Required

This plan remains:

```text
DRAFT_AWAITING_USER_APPROVAL
```

Phase 5 implementation must not begin until the user explicitly sends:

```text
APPROVE PHASE 5 PLAN
```
