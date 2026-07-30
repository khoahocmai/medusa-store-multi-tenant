# MASTER IMPLEMENTATION PROMPT

## Medusa Scenario 3 — Multi-Tenant + Multi-Store

You are a senior Medusa v2 backend engineer and PostgreSQL security architect.

Your task is to implement a **Multi-Tenant + Multi-Store MVP** in the current Medusa repository using a strictly controlled, phase-gated workflow.

You must use the installed **Medusa Development Assistance Skills** whenever they apply. Follow the current repository version, existing architecture, official Medusa patterns available through those skills, and the rules in this prompt.

---

# 1. Business Architecture

Implement the following business hierarchy:

```text
Platform
│
├── Tenant A
│   ├── Store A1
│   ├── Store A2
│   └── Store A3
│
├── Tenant B
│   ├── Store B1
│   └── Store B2
│
└── Tenant C
    └── Store C1
```

Definitions:

* **Platform Admin** manages the entire platform and tenant lifecycle.
* **Tenant** is an independent business, franchise group, dealer, distributor, or white-label client.
* **Store** is a storefront, branch, region, domain, brand, B2B/B2C channel, or location belonging to exactly one tenant.
* A tenant may own multiple stores.
* A store must not belong to multiple tenants unless the user explicitly approves a different model.
* Tenant users must never access another tenant’s data.
* Store-scoped users may access only the stores assigned to them.
* Platform-level access must be explicit and auditable.

---

# 2. MVP Technical Architecture

Unless Phase 0 proves that the repository already uses another user-approved architecture, implement the MVP as:

```text
One Medusa application
        +
One shared PostgreSQL database
        +
Tenant-aware application context
        +
PostgreSQL Row Level Security
        +
Medusa Store / Sales Channel / Region links
```

The business model follows Scenario 3, but the MVP does not automatically create one Medusa deployment or one database per tenant.

The following are outside MVP scope unless explicitly approved later:

* Separate Medusa instance per tenant.
* Separate database or schema per tenant.
* Kubernetes, ECS, Terraform, or infrastructure orchestration.
* Billing implementation.
* Cross-tenant analytics dashboard.
* Custom Admin UI.
* Storefront UI.
* Subscription plans.
* Usage metering.
* Tenant-specific code forks.
* Production deployment.
* Unrelated Medusa customizations.

---

# 3. Reference Documents

Use the following repository or attached documents as architectural references:

* `Multi-Tenant Architecture in eCommerce The Complete Guide (2026 Edition).md`
* `multi-tenancy-in-medusa.md`

Rules for reference material:

1. Treat the documents as references, not as code that must be copied.
2. Verify every code pattern against:

   * the current repository;
   * the installed Medusa version;
   * the installed Medusa Development Assistance Skills;
   * the actual framework internals used by the project.
3. Do not copy a framework patch written for another Medusa version.
4. Do not copy a fixed list of Medusa database tables without verifying the current schema.
5. Do not blindly add `tenant_id` to every Medusa core table.
6. Do not trust `x-tenant-id` by itself as proof of tenant membership.
7. Do not treat a missing tenant context as automatic platform-admin access.
8. Do not silently continue when RLS initialization fails.

---

# 4. Absolute Phase-Gate Rules

These rules override all other implementation preferences.

## 4.1 Execute one phase only

* Execute only the phase explicitly authorized by the user.
* On the first run, execute **Phase 0 only**.
* Do not implement Phase 1 during Phase 0.
* Do not prepare code for future phases.
* Do not create placeholders, scaffolding, migrations, models, routes, or tests belonging to a later phase.
* Do not begin the next phase even when the current phase succeeds.

## 4.2 User approval is mandatory

Only the user can approve a phase.

A phase can have one of these statuses:

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
IMPLEMENTED_AWAITING_APPROVAL
APPROVED_BY_USER
```

The agent may set:

* `NOT_STARTED`
* `IN_PROGRESS`
* `BLOCKED`
* `IMPLEMENTED_AWAITING_APPROVAL`

The agent must never set `APPROVED_BY_USER` by itself.

A phase becomes approved only after the user explicitly sends:

```text
APPROVE PHASE <number>
```

Examples:

```text
APPROVE PHASE 0
APPROVE PHASE 1
```

If the user asks for corrections, remain in the same phase.

## 4.3 Start-of-phase validation

Before beginning any phase after Phase 0:

1. Read `docs/multi-tenant-implementation/PROJECT_STATE.md`.
2. Read the previous phase report.
3. Verify that the previous phase is marked `APPROVED_BY_USER`.
4. Verify that the current phase is the next sequential phase.
5. Check Git status.
6. Compare the repository with the recorded end state of the previous phase.

If any requirement fails, stop and report the inconsistency. Do not continue.

## 4.4 End-of-phase stop

At the end of every phase:

1. Complete the phase report.
2. Update `PROJECT_STATE.md`.
3. Show a concise report in the chat.
4. Set the phase to `IMPLEMENTED_AWAITING_APPROVAL`.
5. State that the next phase has not been started.
6. Stop.

Do not ask permission and then continue in the same response.

---

# 5. Scope-Control Rules

You must:

* Make the smallest changes necessary for the authorized phase.
* Reuse existing project patterns when safe.
* Preserve existing naming and directory conventions.
* Avoid unrelated refactoring.
* Avoid formatting unrelated files.
* Avoid package upgrades unless the phase explicitly requires them.
* Avoid adding dependencies when the same result can be achieved with existing dependencies.
* Avoid speculative features.
* Avoid implementing optional items merely because they are mentioned in reference documents.
* Clearly label assumptions.
* Report every deviation from the approved plan.

You must not:

* Automatically implement a “better architecture” outside the approved scope.
* Add billing, analytics, UI, deployment infrastructure, or unrelated APIs.
* Rewrite existing modules merely to make them cleaner.
* modify files unrelated to multi-tenancy.
* create demo subscribers, seeders, or sample data unless the current phase requires them.
* commit, push, merge, rebase, reset, or change branches unless explicitly requested.
* claim tests passed unless they were actually executed successfully.

---

# 6. Repository and Database Safety

## 6.1 Git safety

Before every phase, record:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
```

Do not run:

```bash
git reset --hard
git clean -fd
git checkout -- .
git restore .
git rebase
git push --force
```

If unrelated uncommitted files already exist:

* Record them.
* Do not modify them.
* Continue only when the authorized phase can be completed without touching them.
* Otherwise mark the phase `BLOCKED`.

## 6.2 Database safety

Never execute:

* database drop;
* schema drop;
* automatic database reset;
* broad truncate;
* destructive cleanup;
* production migration;
* migration against an unidentified database.

Before executing any migration or database test, report:

* database host;
* database name;
* database role;
* whether the role is superuser;
* whether it has `BYPASSRLS`;
* whether the database is development, test, or production.

Never print passwords or full database URLs.

Use an isolated test database for destructive or integration tests.

Do not modify `.env` automatically. Document required environment changes instead.

## 6.3 Migration role separation

The intended role model is:

```text
migration_role
- owns or alters schema;
- runs migrations;
- must not be used by the running application.

runtime_role
- NOSUPERUSER;
- NOBYPASSRLS;
- used by the Medusa application;
- subject to FORCE ROW LEVEL SECURITY.
```

Do not grant unnecessary schema ownership or superuser privileges to `runtime_role`.

---

# 7. Required Documentation Folder

Create and maintain:

```text
docs/
└── multi-tenant-implementation/
    ├── README.md
    ├── PROJECT_STATE.md
    ├── ARCHITECTURE_DECISIONS.md
    ├── RISK_REGISTER.md
    └── phase-reports/
        ├── PHASE-00-AUDIT.md
        ├── PHASE-01-FOUNDATION.md
        ├── PHASE-02-RLS-CONTEXT.md
        ├── PHASE-03-AUTH-MIDDLEWARE.md
        ├── PHASE-04-PROVISIONING-API.md
        ├── PHASE-05-ISOLATION-VERIFICATION.md
        └── PHASE-06-FINAL-HANDOFF.md
```

Do not create reports for future phases before those phases are authorized.

## 7.1 `README.md`

Explain:

* purpose of the folder;
* phase-gate workflow;
* status values;
* approval command;
* report conventions;
* architecture target;
* MVP boundaries.

## 7.2 `PROJECT_STATE.md`

This is the source of truth.

Use a table similar to:

```markdown
| Phase | Name | Status | Report | Approved by user |
|---|---|---|---|---|
| 0 | Repository Audit | IN_PROGRESS | phase-reports/PHASE-00-AUDIT.md | No |
| 1 | Foundation and Models | NOT_STARTED | — | No |
```

Also record:

* repository root;
* branch;
* starting commit;
* current commit;
* package manager;
* Medusa version;
* database strategy;
* last completed phase;
* next allowed phase;
* known blockers;
* approved MVP scope.

## 7.3 `ARCHITECTURE_DECISIONS.md`

For each decision, record:

```markdown
## ADR-XXX: Decision title

Status:
Context:
Decision:
Reason:
Alternatives considered:
Consequences:
User approval:
```

Do not invent user approval.

## 7.4 `RISK_REGISTER.md`

Record:

```markdown
| ID | Risk | Severity | Phase | Mitigation | Status |
|---|---|---|---|---|---|
```

At minimum consider:

* cross-tenant data leakage;
* missing tenant context;
* spoofed tenant ID;
* connection-pool context leakage;
* RLS bypass by database role;
* unsafe platform-admin bypass;
* Medusa framework upgrade breaking a patch;
* background job without tenant context;
* unprotected Medusa core routes;
* incomplete tenant ownership mapping.

## 7.5 Per-phase report format

Every phase report must contain:

```markdown
# Phase N — Name

## Status

## Objective

## Authorized scope

## Explicitly excluded scope

## Repository state before work

## Audit or implementation performed

## Files created

## Files modified

## Files deleted

## Database changes

## Commands executed

## Test results

## Acceptance criteria

## Deviations from plan

## Security observations

## Known limitations

## Risks and blockers

## Repository state after work

## Summary

## Next phase readiness

## Approval required
```

For commands and tests, report actual outputs or concise evidence. Do not fabricate results.

---

# 8. Definition of Done for Every Phase

A phase is complete only when:

* all authorized deliverables are implemented;
* no later-phase work was performed;
* project compilation succeeds where applicable;
* authorized tests pass;
* no unrelated files were changed;
* database safety rules were followed;
* documentation is updated;
* Git status is reported;
* remaining limitations are clearly documented;
* phase status is `IMPLEMENTED_AWAITING_APPROVAL`.

Passing tests does not authorize the next phase.

---

# 9. Phase 0 — Repository Audit and Architecture Lock

## Objective

Understand the repository before changing implementation.

## Allowed changes

Only create or update:

```text
docs/multi-tenant-implementation/
```

No production code changes are allowed in Phase 0.

## Required audit

Inspect and report:

### Repository

* repository root;
* current branch;
* current commit;
* Git status;
* package manager;
* workspace structure;
* backend application location.

### Versions

Identify exact versions of:

* `@medusajs/framework`;
* `@medusajs/medusa`;
* MikroORM;
* Knex;
* PostgreSQL client;
* Node.js;
* package manager.

### Installed Medusa skills

Determine which installed Medusa Development Assistance Skills apply.

Do not install additional skills unless explicitly requested.

### Existing multi-tenant implementation

Search for:

* tenant models;
* tenant-store models;
* memberships;
* store locator or domain resolver;
* AsyncLocalStorage;
* request context;
* middleware;
* RLS migrations;
* database roles;
* `set_config`;
* `current_setting`;
* framework patches;
* module links;
* tenant workflows;
* tenant API routes;
* subscribers;
* integration tests;
* documentation from earlier work.

Classify each relevant item as:

```text
VERIFIED_IMPLEMENTED
PARTIAL
PLACEHOLDER
BROKEN
MISSING
OUT_OF_SCOPE
```

### Current Medusa architecture

Map:

* modules;
* workflows;
* API routes;
* middleware order;
* authentication;
* stores;
* sales channels;
* regions;
* users;
* customers;
* products;
* carts;
* orders;
* background jobs;
* subscribers.

### Database architecture

Inspect:

* migration history;
* table ownership;
* RLS status;
* PostgreSQL roles;
* role privileges;
* `BYPASSRLS`;
* current tenant columns;
* existing policies;
* connection pool behavior.

Do not change the database.

### Architecture proposal

Produce an exact implementation proposal covering:

* tenant model;
* store ownership model;
* membership model;
* tenant resolution;
* store resolution;
* RLS table scope;
* platform-admin access;
* runtime role;
* migration role;
* request context;
* transaction context;
* core route strategy;
* provisioning workflows;
* isolation tests.

Create a table showing which Medusa entities are planned for tenant isolation:

```markdown
| Entity | Tenant-owned | Store-owned | Shared | Isolation mechanism | Planned phase |
|---|---:|---:|---:|---|---|
```

Do not implement this proposal during Phase 0.

## Phase 0 acceptance criteria

* Repository audit completed.
* Existing implementation classified.
* Exact version compatibility risks documented.
* Proposed architecture documented.
* MVP scope matrix documented.
* No implementation files modified.
* Phase report completed.
* Phase marked `IMPLEMENTED_AWAITING_APPROVAL`.
* Agent stops.

---

# 10. Phase 1 — Foundation, Models, and Module Links

Phase 1 may start only after:

```text
APPROVE PHASE 0
```

## Objective

Implement the minimal domain foundation for:

```text
Platform → Tenant → Multiple Stores
```

## Expected domain concepts

Implement only the approved Phase 0 model design. It will normally include:

### Tenant

Represents an independent business unit.

Possible fields must be justified by actual requirements:

* ID;
* handle or slug;
* name;
* status;
* metadata;
* timestamps.

Do not add speculative billing or subscription fields.

### Tenant Store ownership

Represent the ownership or association between a tenant and a Medusa Store.

The design may use:

* a custom `TenantStore` model;
* Medusa module links;
* or both, when each has a distinct justified purpose.

Do not duplicate ownership data without documenting the source of truth.

### Tenant Store Locator

Provide a global mapping used before tenant context exists, such as:

* hostname;
* domain;
* subdomain;
* public reference;
* store code.

The locator must not expose tenant data beyond what is required to resolve context.

### Tenant Membership

Represent an authenticated actor’s relationship to a tenant.

At minimum consider:

* actor or user identifier;
* tenant;
* role;
* active status;
* optional store scope.

Do not implement a complex permission engine in this phase.

### Medusa links

Implement only approved links to relevant Medusa resources, potentially:

* Store;
* Sales Channel;
* Region.

Use the current Medusa module-link pattern verified through installed skills.

## Required work

* custom module;
* models;
* service;
* module registration;
* required indexes;
* unique constraints;
* module links;
* generated migration;
* model or module tests;
* compilation verification.

## Excluded

Do not implement:

* RLS;
* tenant middleware;
* platform routes;
* provisioning workflows;
* storefront resolution;
* billing;
* Admin UI;
* core commerce isolation.

## Phase 1 acceptance criteria

* Models match the approved Phase 0 design.
* Ownership source of truth is documented.
* Constraints prevent invalid tenant-store mappings.
* Module is registered.
* Migration is generated and reviewed.
* Relevant tests pass.
* Report completed.
* Phase marked `IMPLEMENTED_AWAITING_APPROVAL`.
* Agent stops.

---

# 11. Phase 2 — PostgreSQL RLS and Tenant Context

Phase 2 may start only after:

```text
APPROVE PHASE 1
```

## Objective

Implement database-enforced tenant isolation for the table scope approved in Phase 0.

## 11.1 Database roles

Provide an idempotent setup mechanism for:

* `migration_role`;
* `runtime_role`.

Do not hardcode real passwords.

Verify:

```text
runtime_role:
- NOSUPERUSER
- NOBYPASSRLS
```

## 11.2 RLS policy requirements

For tenant-owned tables:

* add or verify a `tenant_id`;
* index `tenant_id`;
* enable RLS;
* force RLS;
* create policies for relevant operations;
* use both `USING` and `WITH CHECK` where required.

Policies must be fail-closed.

A missing or empty tenant context must not grant access.

Conceptual condition:

```sql
tenant_id =
NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
```

Do not add conditions equivalent to:

```sql
OR current_setting(...) IS NULL
OR current_setting(...) = ''
```

Platform-level access must use an explicit, separately controlled mechanism.

## 11.3 Tenant context

Implement an AsyncLocalStorage-based context containing only approved fields, such as:

```ts
type TenantContext = {
  tenantId: string
  actorId?: string
  storeIds?: string[]
  accessMode: "tenant" | "platform"
}
```

Do not use `accessMode: "platform"` merely because `tenantId` is missing.

## 11.4 Transaction context

Implement a supported transaction wrapper that:

1. begins a transaction;
2. sets PostgreSQL tenant context transaction-locally;
3. executes the operation;
4. commits or rolls back;
5. prevents context leaking through the connection pool.

Prefer transaction-local configuration:

```sql
SELECT set_config('app.current_tenant_id', $1, true);
```

Do not rely on an unreset session-level variable without proving pool safety.

## 11.5 Framework patch decision

Do not automatically patch Medusa.

First determine whether tenant context can be applied safely through:

* supported transaction APIs;
* MikroORM hooks;
* Knex hooks;
* existing repository wrappers;
* official extension points available in the installed version.

A framework patch is allowed only when all of these are true:

1. no supported mechanism covers the approved query paths;
2. exact framework version is recorded;
3. the patch is minimal;
4. the patch is version-controlled;
5. patch application is tested;
6. startup fails safely when the patch is missing;
7. the patch never silently disables RLS;
8. an upgrade verification procedure is documented.

Do not copy a patch intended for another Medusa version.

## 11.6 Required tests

At minimum test:

* Tenant A cannot read Tenant B rows.
* Tenant A cannot update Tenant B rows.
* Tenant A cannot delete Tenant B rows.
* Tenant A cannot insert rows with Tenant B’s ID.
* Missing tenant context is denied.
* Invalid tenant ID is denied.
* Runtime role cannot bypass RLS.
* Table owner is subject to `FORCE ROW LEVEL SECURITY`.
* Reused pooled connection does not retain the previous tenant.
* Transaction rollback does not leak context.
* Platform access works only through its explicit approved mechanism.

## Excluded

Do not implement HTTP tenant resolution or tenant API routes.

## Phase 2 acceptance criteria

* Runtime role is verified as non-superuser and non-bypass.
* RLS is enabled and forced on the approved tables.
* Policies are fail-closed.
* Tenant transaction context is implemented.
* Pool-reuse isolation tests pass.
* Framework patch decision is documented.
* Report completed.
* Phase marked `IMPLEMENTED_AWAITING_APPROVAL`.
* Agent stops.

---

# 12. Phase 3 — Authentication, Tenant Resolution, and Middleware

Phase 3 may start only after:

```text
APPROVE PHASE 2
```

## Objective

Resolve tenant and store context securely for HTTP requests.

## Requirements

### Authentication before tenant authorization

Resolve the authenticated actor before granting tenant access.

### Tenant membership validation

A supplied tenant identifier is only a requested context.

It must be checked against:

* authenticated identity;
* active membership;
* membership role;
* optional store scope;
* tenant status.

Never trust `x-tenant-id` alone.

### Allowed resolution sources

Depending on approved route type:

* authenticated membership;
* verified token claim;
* trusted hostname/domain locator;
* platform-admin route namespace;
* signed internal job payload.

Query parameters must not be used for production tenant resolution.

### Platform-admin separation

Platform access must use:

* explicit platform-admin authentication;
* dedicated route namespace;
* explicit authorization check;
* audit logging.

Missing tenant information must not imply platform-admin mode.

### Middleware order

Document and implement the order, for example:

```text
Authentication
→ Platform/tenant route classification
→ Tenant or store resolution
→ Membership authorization
→ AsyncLocalStorage context
→ Route handler
```

### Core route protection

Audit Medusa core routes that could bypass tenant scoping.

For unsafe routes:

* block them;
* wrap them;
* replace them with tenant-scoped custom routes;
* or document why they are safe.

Do not leave unrestricted core Admin APIs merely because custom tenant APIs also exist.

## Required tests

At minimum:

* valid tenant member succeeds;
* non-member is denied;
* inactive membership is denied;
* spoofed tenant header is denied;
* user from Tenant A cannot select Tenant B;
* invalid domain/store locator is denied;
* missing tenant context fails on tenant routes;
* tenant admin cannot access platform routes;
* platform admin access is explicit;
* store-scoped user cannot access another store;
* protected core routes cannot bypass tenant isolation.

## Excluded

Do not implement tenant provisioning workflows or UI.

## Phase 3 acceptance criteria

* Middleware order is documented.
* Tenant context is derived from trusted evidence.
* Header spoofing is prevented.
* Platform access is explicit.
* Unsafe core routes are controlled.
* Authorization tests pass.
* Report completed.
* Phase marked `IMPLEMENTED_AWAITING_APPROVAL`.
* Agent stops.

---

# 13. Phase 4 — Tenant and Store Provisioning APIs

Phase 4 may start only after:

```text
APPROVE PHASE 3
```

## Objective

Implement controlled workflows and API routes for tenant and store lifecycle.

## Required workflows

Implement only workflows approved in Phase 0.

Expected workflows normally include:

### Create tenant

Potential steps:

1. validate platform-admin permission;
2. create tenant;
3. create initial tenant membership;
4. optionally create initial Medusa Store;
5. link Store, Sales Channel, and Region as approved;
6. create locator;
7. return provisioned tenant context.

### Create tenant store

Potential steps:

1. verify tenant-admin permission;
2. create or link Medusa Store;
3. create required Sales Channel;
4. associate Region;
5. create tenant-store ownership;
6. create domain or locator;
7. return store context.

Workflows must be:

* transactional where possible;
* idempotent;
* safe under retry;
* explicit about compensation for partially completed steps;
* tenant-scoped.

## Expected routes

Implement only the approved route set, potentially:

```text
POST /admin/platform/tenants
GET  /admin/tenant/current
GET  /admin/tenant/stores
POST /admin/tenant/stores
GET  /store/context
```

Do not add CRUD endpoints that were not approved.

## Validation

Validate:

* handles;
* IDs;
* domain uniqueness;
* tenant status;
* membership;
* store ownership;
* duplicate requests;
* cross-tenant resource linking.

## Required tests

At minimum:

* platform admin can create a tenant;
* tenant admin cannot create another tenant;
* tenant owner can create a store in their tenant;
* tenant user cannot create a store in another tenant;
* duplicate provisioning is handled safely;
* a Store cannot be linked to two tenants unexpectedly;
* locator resolves the correct tenant and store;
* workflow rollback or compensation is tested;
* created resources are invisible to another tenant.

## Excluded

Do not implement:

* billing;
* subscription plans;
* cross-tenant analytics;
* Admin UI;
* storefront UI;
* production DNS automation.

## Phase 4 acceptance criteria

* Approved provisioning workflows are complete.
* Routes are authorization-safe.
* Workflows are retry-safe.
* Tenant-store ownership is enforced.
* Tests pass.
* Report completed.
* Phase marked `IMPLEMENTED_AWAITING_APPROVAL`.
* Agent stops.

---

# 14. Phase 5 — Isolation Coverage and Verification

Phase 5 may start only after:

```text
APPROVE PHASE 4
```

## Objective

Verify and complete the approved MVP isolation scope across all relevant execution paths.

Phase 5 must follow the entity-isolation matrix approved in Phase 0. Do not silently expand it.

## Isolation surfaces

Audit and test:

* Admin APIs;
* Store APIs;
* custom workflows;
* Medusa services;
* direct repository access;
* MikroORM;
* Knex/raw SQL;
* transactions;
* subscribers;
* scheduled jobs;
* workflow retries;
* webhooks;
* connection-pool reuse.

For any surface outside the approved MVP, document it as a known limitation instead of implementing it automatically.

## Required operation matrix

For approved tenant-owned resources, test:

```text
Create
Read one
Read list
Update
Delete
Filter
Pagination
Direct-ID access
Foreign-key spoofing
Cross-tenant linking
```

Test at least:

* Tenant A;
* Tenant B;
* platform admin;
* missing context;
* invalid context;
* store-scoped user;
* reused database connection.

## Core Medusa entities

Use the Phase 0-approved matrix to determine whether MVP isolation covers entities such as:

* Store;
* Sales Channel;
* Region;
* Product/catalog;
* Customer;
* Cart;
* Order;
* Inventory;
* Pricing;
* Promotion;
* Fulfillment;
* Payment.

Do not claim complete multi-tenancy when these entities remain shared or unprotected.

Clearly distinguish:

```text
DATABASE-ENFORCED
APPLICATION-ENFORCED
LINK-ENFORCED
BLOCKED ROUTE
SHARED BY DESIGN
NOT IMPLEMENTED
```

## Security tests

Include negative tests for:

* read isolation;
* update isolation;
* delete isolation;
* tenant-ID spoofing;
* store-ID spoofing;
* direct resource-ID access;
* missing context;
* pool reuse;
* parallel requests from different tenants;
* background execution;
* platform-admin boundaries.

## Phase 5 acceptance criteria

* All approved isolation paths are tested.
* Test failures are resolved within authorized scope.
* Remaining gaps are accurately documented.
* No untested claim of “complete isolation” remains.
* Report completed.
* Phase marked `IMPLEMENTED_AWAITING_APPROVAL`.
* Agent stops.

---

# 15. Phase 6 — Final Verification and Handoff

Phase 6 may start only after:

```text
APPROVE PHASE 5
```

## Objective

Verify and document the existing implementation. Do not add new features.

## Required work

### Repository reconciliation

Classify each requirement as:

```text
VERIFIED_IMPLEMENTED
PARTIAL
MISSING
OUT_OF_SCOPE
BLOCKED
```

### Full test execution

Run the approved:

* build;
* type check;
* unit tests;
* module tests;
* integration tests;
* RLS tests;
* tenant isolation tests;
* route authorization tests.

Do not hide failed or skipped tests.

### Security verification

Verify:

* runtime role;
* `NOSUPERUSER`;
* `NOBYPASSRLS`;
* RLS enabled;
* RLS forced;
* policies present;
* tenant context fail-closed;
* platform access explicit;
* pool reuse safe;
* no unrestricted bypass route;
* framework patch status, when applicable.

### Operational documentation

Document:

* setup;
* migrations;
* required environment variables without secrets;
* runtime and migration database roles;
* local testing;
* tenant creation;
* store creation;
* rollback considerations;
* framework upgrade checks;
* known limitations;
* production hardening backlog.

### Final repository state

Report:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

## Excluded

Do not implement newly discovered features during finalization.

New findings must be documented as:

* blocker;
* known limitation;
* future phase;
* recommended follow-up.

## Phase 6 acceptance criteria

* Repository reconciled.
* Test evidence recorded.
* Security checks recorded.
* Documentation complete.
* Known limitations explicit.
* No new feature work performed.
* Final report completed.
* Phase marked `IMPLEMENTED_AWAITING_APPROVAL`.
* Agent stops.

---

# 16. Required Chat Response After Every Phase

Use this exact structure:

```markdown
## Phase N completed

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
- `docs/multi-tenant-implementation/...`

### Git state
- Branch:
- Commit:
- Working tree:

### Gate
The next phase has NOT been started.

To approve this phase, the user must explicitly send:

`APPROVE PHASE N`
```

Do not include implementation for the next phase.

---

# 17. Failure and Blocker Handling

When blocked:

1. Stop the phase.
2. Set status to `BLOCKED`.
3. Do not guess.
4. Do not work around security constraints silently.
5. Record:

   * exact blocker;
   * evidence;
   * files affected;
   * safe options;
   * recommended decision.
6. Wait for user instruction.

Examples of blockers:

* incompatible framework version;
* unsafe existing database role;
* unknown database target;
* conflicting migrations;
* existing architecture contradicts approved model;
* unrelated uncommitted changes in required files;
* missing dependency that requires user approval;
* tests would require destructive database operations.

---

# 18. First Execution Instruction

Begin now with:

```text
PHASE 0 — Repository Audit and Architecture Lock
```

Perform Phase 0 only.

Do not modify implementation code.

Create only the Phase 0 documentation files.

At completion, report the results, set Phase 0 to:

```text
IMPLEMENTED_AWAITING_APPROVAL
```

Then stop.
