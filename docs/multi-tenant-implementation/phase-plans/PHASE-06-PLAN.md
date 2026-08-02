# Phase 6 Plan: Final Verification and Handoff

## Mandatory Medusa Skill Review

Before inspecting or executing Phase 6, the agent must read:

- `.agents/skills/building-with-medusa/SKILL.md`;
- all applicable files under `.agents/skills/building-with-medusa/reference/`.

At minimum, inspect references related to:

- data models;
- module links;
- querying data;
- workflows;
- workflow hooks;
- subscribers and events;
- scheduled jobs;
- error handling;
- troubleshooting.

The Phase 6 report must include a section named:

```markdown
## Medusa skills consulted
```

For every skill or reference used, record:

- the exact file path;
- why it was relevant to Phase 6;
- which verification, test, or documentation decision it informed.

Do not install additional skills.
Do not upgrade Medusa or any dependency.
Do not rely on remembered Medusa patterns when the installed skill or the current repository can provide direct evidence.

---

## Status

- **Phase 6 status:** `NOT_STARTED`
- **Phase 6 plan status:** `DRAFT_AWAITING_USER_APPROVAL`
- **Next allowed action:** `APPROVE PHASE 6 PLAN`

---

## 1. Objective

Verify and document the existing implementation of the Multi-Tenant + Multi-Store MVP.

Phase 6 is the final verification and handoff phase. It strictly prohibits:

- adding new features;
- expanding the approved Phase 0 entity-isolation scope;
- altering the approved architecture;
- silently fixing newly discovered production defects;
- beginning any Phase 7.

The goals are to:

1. reconcile the repository against the approved work from Phases 0–5;
2. execute the existing approved build and test suites;
3. verify the recorded security guarantees with actual evidence;
4. finalize operational and upgrade documentation;
5. record unresolved risks, limitations, and production-hardening work;
6. produce the final Phase 6 handoff report.

---

## 2. Authoritative Phase Definition

The authoritative Phase 6 is:

```text
Phase 6 — Final Verification and Handoff
```

Its objective is:

```text
Verify and document the existing implementation. Do not add new features.
```

The authoritative governing documents are:

- `docs/multi-tenant-implementation/MASTER_CONTRACT.md`;
- `docs/multi-tenant-implementation/PHASE_MANIFEST.md`.

The label `Sales Channel Boundary`, if present in `PROJECT_STATE.md`, is a documentation inconsistency and must not be treated as authorization to implement a new feature.

Before correcting the Phase 6 label, the agent must verify that:

- no approved contract amendment redefined Phase 6;
- no approved ADR redefined Phase 6;
- no approval-log entry explicitly authorized a new phase definition.

If no such approved change exists, update `PROJECT_STATE.md` so Phase 6 is recorded as:

```text
Final Verification and Handoff
```

Record the original inconsistency and the correction in the final Phase 6 report.

---

## 3. Phase-Gate Validation

Before performing any Phase 6 verification, test execution, or documentation update, the agent must:

### 3.1 Read governing documents

Read, in this order:

1. `.agents/skills/building-with-medusa/SKILL.md`;
2. all applicable Medusa skill references;
3. `docs/multi-tenant-implementation/MASTER_CONTRACT.md`;
4. `docs/multi-tenant-implementation/PHASE_MANIFEST.md`;
5. `docs/multi-tenant-implementation/PROJECT_STATE.md`;
6. `docs/multi-tenant-implementation/APPROVAL_LOG.md`;
7. `docs/multi-tenant-implementation/ARCHITECTURE_DECISIONS.md`;
8. `docs/multi-tenant-implementation/RISK_REGISTER.md`;
9. `docs/multi-tenant-implementation/README.md`;
10. all Phase 0–5 reports;
11. `docs/multi-tenant-implementation/phase-plans/PHASE-05-PLAN.md`;
12. `docs/multi-tenant-implementation/phase-plans/PHASE-05-REMEDIATION-PLAN.md`;
13. this approved Phase 6 plan.

At minimum, the Phase 0–5 reports include:

- `phase-reports/PHASE-00-AUDIT.md`;
- `phase-reports/PHASE-01-FOUNDATION.md`;
- `phase-reports/PHASE-02-RLS-CONTEXT.md`;
- `phase-reports/PHASE-03-AUTH-MIDDLEWARE.md`;
- `phase-reports/PHASE-04-PROVISIONING-API.md`;
- `phase-reports/PHASE-05-ISOLATION-VERIFICATION.md`.

### 3.2 Verify phase approval and sequencing

Verify all of the following:

- Phase 5 is explicitly recorded as `APPROVED_BY_USER`;
- `APPROVAL_LOG.md` contains valid Phase 5 approval evidence;
- Phase 6 is the next sequential phase;
- Phase 6 is not already completed;
- this Phase 6 plan is explicitly recorded as approved before implementation begins;
- the approved Phase 6 plan has not changed after approval;
- no unresolved Phase 5 blocker exists;
- the approved Phase 5 remediation is present;
- the repository matches the recorded Phase 5 end state for Phase 5-related files;
- no approved document was silently altered after approval.

### 3.3 Record repository state

Execute and record:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
```

Do not require an absolutely clean working tree.

Instead:

- inventory all modified and untracked files;
- classify each file as:
  - `REQUIRED_PHASE_ARTIFACT`;
  - `REUSABLE_DIAGNOSTIC`;
  - `TEMPORARY_DIAGNOSTIC`;
  - `GENERATED_TEST_OUTPUT`;
  - `UNRELATED_PREEXISTING`;
  - `UNKNOWN`;
- leave unrelated and pre-existing files untouched;
- do not delete, restore, overwrite, commit, push, merge, rebase, reset, clean, or change branches.

### 3.4 Blocker handling

If any phase approval, documentation, Git, repository, database, or plan-integrity inconsistency exists:

- set Phase 6 to `BLOCKED`;
- record the exact evidence;
- do not modify production code;
- do not execute unsafe tests;
- stop and wait for user instruction.

---

## 4. Exact Authorized Phase 6 Scope

Phase 6 may:

- perform repository reconciliation against Phases 0–5;
- inspect the existing implementation;
- discover and execute existing approved build and test suites;
- verify the database-role model;
- verify RLS configuration on Phase 0-approved protected tables;
- verify tenant-context fail-closed behavior;
- verify connection-pool isolation and concurrency behavior;
- verify framework patch presence and compatibility;
- verify documented provisioning flows;
- inspect existing subscribers, scheduled jobs, workflows, and webhooks;
- consolidate and finalize operational documentation;
- correct the Phase 6 naming inconsistency in `PROJECT_STATE.md`;
- update evidence-based risks and limitations;
- create the final Phase 6 report;
- record a production-hardening backlog without implementing it.

Phase 6 may not expand the approved entity-isolation matrix.

---

## 5. Explicitly Excluded Scope

Phase 6 must not:

- implement new features;
- implement `Sales Channel Boundary`;
- add RLS to an entity not approved in Phase 0;
- add or modify production models;
- add or modify production services;
- add or modify workflows;
- add or modify API routes;
- add or modify middleware;
- add or modify migrations;
- add or modify PostgreSQL policies or triggers;
- add or modify the `pg.Client` hook;
- add or modify instrumentation;
- add or modify framework patches;
- modify test behavior to force a passing result;
- add missing test suites merely to satisfy this plan;
- upgrade or install dependencies;
- modify `.env`;
- perform production migration or deployment;
- create Phase 7;
- commit, push, merge, rebase, reset, clean, restore, or switch branches.

A failed test or security check is evidence, not authorization to fix production code.

New findings must be classified as:

- `VERIFIED_IMPLEMENTED`;
- `PARTIAL`;
- `MISSING`;
- `OUT_OF_SCOPE`;
- `BLOCKED`.

---

## 6. Exact Files Authorized

### 6.1 File to create

```text
docs/multi-tenant-implementation/phase-reports/PHASE-06-FINAL-HANDOFF.md
```

### 6.2 Files that may be updated when supported by evidence

```text
docs/multi-tenant-implementation/PROJECT_STATE.md
docs/multi-tenant-implementation/RISK_REGISTER.md
docs/multi-tenant-implementation/README.md
docs/multi-tenant-implementation/APPROVAL_LOG.md
```

`APPROVAL_LOG.md` may only record actual user approvals and Phase 6 status transitions. The agent must not invent user approval.

### 6.3 Files that must not be modified

```text
docs/multi-tenant-implementation/MASTER_CONTRACT.md
docs/multi-tenant-implementation/PHASE_MANIFEST.md
all approved Phase 0–5 plans
all approved Phase 0–5 reports
all production source files
all migrations
all test implementations
all dependency manifests and lockfiles
```

Historical inconsistencies must be documented rather than silently rewriting approved historical records.

---

## 7. Required Repository Reconciliation

Classify every relevant requirement using exactly one of:

```text
VERIFIED_IMPLEMENTED
PARTIAL
MISSING
OUT_OF_SCOPE
BLOCKED
```

Use a reconciliation table with at least these columns:

| Requirement | Classification | Implementation evidence | Database evidence | Test evidence | Known limitation | Recommended follow-up |
|---|---|---|---|---|---|---|

At minimum reconcile the following areas.

### 7.1 Domain foundation and ownership

- Tenant model;
- Tenant Store ownership;
- Tenant Store Locator;
- Tenant Membership;
- Platform Membership;
- Store link;
- Sales Channel link;
- Region link;
- ownership source of truth;
- uniqueness and anti-cross-tenant constraints.

### 7.2 Authentication and authorization

- JWT or authenticated actor resolution;
- membership validation;
- active membership enforcement;
- tenant-admin enforcement;
- platform membership enforcement;
- explicit platform route separation;
- `x-tenant-id` spoofing prevention;
- missing-context behavior;
- Store locator trust boundary;
- protected core-route blocking or wrapping.

### 7.3 Database isolation

For each Phase 0-approved protected physical table, verify:

- exact table name;
- `tenant_id` column;
- index;
- `ENABLE ROW LEVEL SECURITY`;
- `FORCE ROW LEVEL SECURITY`;
- SELECT policy;
- INSERT policy or tenant-assignment guard;
- UPDATE policy;
- DELETE policy;
- fail-closed behavior;
- direct-ID isolation;
- foreign-tenant insertion prevention.

At minimum inspect:

- `public.store`;
- `public.product`;
- `public.order`;
- `public.customer`.

Do not claim RLS coverage for entities outside the approved matrix unless actual approved evidence exists.

### 7.4 Tenant context and connection propagation

Verify:

- AsyncLocalStorage context;
- transaction wrapper behavior;
- global `pg.Client` interception;
- per-client `WeakMap` serialization;
- exact `set → business query → reset` sequencing;
- explicit missing-context reset;
- reset-failure invalidation;
- dirty-client destruction;
- sequential connection reuse;
- rollback behavior;
- autocommit behavior;
- parallel Tenant A/Tenant B execution.

### 7.5 Medusa compatibility and framework patches

Verify:

- exact `@medusajs/framework` version;
- exact `@medusajs/medusa` version;
- exact Node.js version;
- package-manager version;
- all patch-package files;
- target package and version of every patch;
- ADR-003 handler/transaction propagation patch;
- ADR-004 core-default bootstrap patch;
- patch application behavior;
- startup failure behavior if a patch no longer applies;
- `MEDUSA_SKIP_CORE_DEFAULTS=true` behavior;
- documented Medusa upgrade procedure.

### 7.6 Provisioning and execution surfaces

Verify:

- create-tenant workflow;
- create-tenant-store workflow;
- retry behavior;
- idempotency;
- compensation;
- tenant-store links;
- locator creation;
- cross-tenant linking prevention;
- Admin API behavior;
- Store API behavior;
- MikroORM access;
- Knex/raw SQL access;
- workflows;
- subscribers;
- scheduled jobs;
- webhooks;
- background execution.

An absent or out-of-scope path must not be marked implemented. Record it as:

- `MISSING`;
- `OUT_OF_SCOPE`;
- or a known limitation.

---

## 8. Full Test Discovery and Execution

Before selecting commands, inspect:

- backend `package.json`;
- workspace `package.json`;
- Jest configuration;
- TypeScript configuration;
- existing Phase 1–5 test files;
- previous phase reports;
- patch-package configuration;
- startup and test-harness scripts.

Do not invent script names or paths.

### 8.1 Required test categories

Locate and execute all existing approved tests covering:

- backend build;
- type checking;
- unit tests;
- tenant module tests;
- integration tests;
- Phase 2 RLS;
- Phase 3 route authorization;
- Phase 4 provisioning;
- Phase 5 isolation;
- connection-pool reuse;
- concurrency and race behavior;
- rollback behavior;
- reset-failure invalidation;
- framework patch application;
- backend startup with `MEDUSA_SKIP_CORE_DEFAULTS=true`.

Known suites that must be located and verified include:

- `tenant-rls.spec.ts`;
- `custom-provisioning.spec.ts`;
- `isolation-verification.spec.ts`;
- any dedicated pool, race, or reset-failure tests referenced in Phase 5;
- patch-package verification;
- backend startup verification.

Expected commands may include the following only after confirming the exact scripts and paths:

```bash
cd apps/backend
npm run build
```

```bash
cd apps/backend
npx jest src/modules/tenant/__tests__/tenant-rls.spec.ts --runInBand
```

```bash
cd apps/backend
npx jest integration-tests/http/custom-provisioning.spec.ts --runInBand
```

```bash
cd apps/backend
npx jest integration-tests/http/isolation-verification.spec.ts --runInBand
```

### 8.2 Test reporting

For every command, report:

- working directory;
- exact command;
- database environment, when applicable;
- `PASS`, `FAIL`, or `NOT RUN`;
- passed count;
- failed count;
- skipped count;
- concise output evidence;
- whether the command was rerun;
- whether the result was stable.

Do not hide failed, flaky, or skipped tests.

The critical Phase 5 isolation suite should be executed at least twice when safe and supported by the approved harness, to confirm that pool/race behavior remains stable.

### 8.3 Failure handling

If a required test fails:

- do not modify production code;
- classify the affected requirement as `PARTIAL`, `MISSING`, or `BLOCKED`;
- record the exact failure;
- record the affected files and security guarantee;
- document safe remediation options;
- stop if the failure invalidates a required security guarantee.

---

## 9. Database Safety

Before every database command, migration verification, or database-backed test, report:

- database host;
- database port;
- database name;
- database role;
- environment type;
- whether the role is a superuser;
- whether the role has `BYPASSRLS`;
- whether the role owns protected tables;
- whether the target is an isolated non-production database.

Never print passwords or full database URLs.

Never execute:

- `DROP DATABASE`;
- `DROP SCHEMA`;
- broad `TRUNCATE`;
- automatic database reset;
- destructive cleanup;
- production migration;
- migration against an unidentified database;
- privilege escalation;
- role creation outside an existing approved isolated-test harness;
- `.env` modification.

If an existing test harness internally creates or removes an isolated database, inspect and document its behavior before running it.

Do not assume a harness is safe solely because a previous report says it ran successfully.

---

## 10. Security Verification

Verify and record exact evidence for the following.

### 10.1 Database roles

- `runtime_role` exists;
- `runtime_role` is `NOSUPERUSER`;
- `runtime_role` is `NOBYPASSRLS`;
- `runtime_role` is not the owner of protected tables;
- `migration_role` and runtime responsibilities remain separated;
- no application runtime path uses a privileged setup or migration role.

### 10.2 RLS

- RLS is enabled on every Phase 0-approved protected table;
- RLS is forced;
- required policies exist;
- policies are fail-closed;
- missing tenant context cannot inherit a previous tenant;
- invalid tenant context is denied;
- Tenant A cannot read Tenant B rows;
- Tenant A cannot update Tenant B rows;
- Tenant A cannot delete Tenant B rows;
- explicit foreign `tenant_id` insertion is denied;
- protected inserts cannot leave `tenant_id` as `NULL`.

### 10.3 Platform boundary

- platform access is explicit;
- active `PlatformMembership` is required;
- missing tenant context does not imply platform mode;
- the runtime role cannot self-enable an unrestricted database bypass;
- no unsafe platform GUC bypass remains in RLS policies;
- platform actors do not receive unrestricted PostgreSQL privileges.

### 10.4 Connection and concurrency

- `set_config` executes on the same client as the business query;
- per-client queries are serialized;
- reset is awaited before connection reuse;
- reset failure invalidates or destroys the client;
- parallel Tenant A/Tenant B requests do not interleave context;
- rollback does not leak context;
- autocommit reads and writes remain protected;
- missing context is explicitly set to an empty value before protected queries.

### 10.5 Routes and context resolution

- authentication occurs before tenant authorization;
- a supplied tenant ID is only a requested context;
- tenant membership is validated;
- spoofed tenant and Store identifiers fail closed;
- direct-ID access preserves tenant isolation;
- filters and pagination cannot widen tenant scope;
- protected core routes are wrapped, blocked, or verified safe;
- no unrestricted bypass route exists.

### 10.6 Framework patches

For every patch, record:

- patch file;
- target package;
- exact package version;
- reason for the patch;
- whether it applies successfully;
- fail-safe behavior if it no longer applies;
- upgrade verification procedure.

Also verify:

- `MEDUSA_SKIP_CORE_DEFAULTS=true` behavior;
- expected behavior when the variable is absent;
- backend startup under the runtime role.

---

## 11. Evidence-Based Limitation Handling

Do not pre-classify Sales Channel isolation or background-job context propagation as failures.

Instead, verify actual implementation and evidence, then classify each as one of:

```text
VERIFIED_IMPLEMENTED
PARTIAL
MISSING
OUT_OF_SCOPE
BLOCKED
```

Sales Channel may be `LINK-ENFORCED` rather than RLS-enforced if that matches the approved Phase 0 architecture.

For background jobs, subscribers, and webhooks:

1. verify whether the execution path exists;
2. verify whether it accesses a Phase 0-approved protected entity;
3. identify the tenant ID source;
4. verify whether the tenant source is trusted;
5. verify ALS propagation;
6. verify database context propagation;
7. record an evidence-based classification.

Do not create missing background paths solely to test them.

---

## 12. Operational Documentation

The final handoff report must document:

- architecture summary;
- exact Medusa versions;
- exact Node.js and package-manager versions;
- repository structure;
- required framework patches;
- patch-package verification;
- database provisioning;
- setup, migration, and runtime role separation;
- migration execution order;
- environment variable names without values or secrets;
- `MEDUSA_SKIP_CORE_DEFAULTS` behavior;
- application startup;
- local development setup;
- isolated test database setup;
- tenant creation;
- tenant membership creation;
- platform membership requirements;
- Store creation;
- locator configuration;
- Sales Channel and Region linking as currently implemented;
- tenant-context propagation;
- RLS verification;
- connection-pool and race verification;
- rollback considerations;
- migration rollback limitations;
- pg hook failure behavior;
- framework upgrade checklist;
- troubleshooting;
- known limitations;
- production-hardening backlog;
- monitoring and alerting recommendations;
- disaster-recovery considerations;
- temporary diagnostic artifact cleanup recommendations.

Do not claim a production guarantee that was not directly verified.

---

## 13. Temporary and Untracked Artifact Inventory

Inventory every modified and untracked artifact.

Classify each as:

- `REQUIRED_PHASE_ARTIFACT`;
- `REUSABLE_DIAGNOSTIC`;
- `TEMPORARY_DIAGNOSTIC`;
- `GENERATED_TEST_OUTPUT`;
- `UNRELATED_PREEXISTING`;
- `UNKNOWN`.

Do not delete any artifact.

For temporary files, provide a recommended cleanup list that requires separate user approval.

The final report must include the complete Git status after Phase 6 documentation changes.

---

## 14. Required Final Report

Create:

```text
docs/multi-tenant-implementation/phase-reports/PHASE-06-FINAL-HANDOFF.md
```

The report must include:

```markdown
# Phase 6 — Final Verification and Handoff

## Status

## Objective

## Authorized scope

## Explicitly excluded scope

## Medusa skills consulted

## Phase-gate verification

## Repository state before work

## Documentation consistency audit

## Audit or implementation performed

## Repository reconciliation matrix

## Final entity-isolation map

## Files and components verified

## Files created

## Files modified

## Files deleted

## Database changes

## Commands executed

## Build and type-check results

## Unit and module test results

## Integration test results

## RLS and isolation test results

## Failed, flaky, skipped, or not-run tests

## Database role verification

## RLS verification

## Authentication and authorization verification

## Tenant-context verification

## Connection-pool and concurrency verification

## Framework patch verification

## Operational setup

## Environment variables

## Migration procedure

## Tenant creation procedure

## Store creation procedure

## Local testing procedure

## Rollback considerations

## Framework upgrade checklist

## Temporary artifact inventory

## Acceptance criteria

## Deviations from plan

## Security observations

## Known limitations

## Production hardening backlog

## Risks and blockers

## Repository state after work

## Summary

## Next phase readiness

## Approval required
```

Every claim must include exact supporting evidence where available, such as:

- file path and line;
- migration name;
- policy name;
- test ID;
- executed command;
- concise output;
- Git state.

Do not claim complete multi-tenancy beyond the approved entity matrix and actual executed evidence.

---

## 15. Acceptance Criteria

Phase 6 is complete only when:

- the repository has been reconciled;
- every relevant requirement has an evidence-based classification;
- all existing approved build and test suites have actual recorded results;
- failed, skipped, flaky, and not-run tests are disclosed;
- database-role evidence is recorded;
- RLS status and policies are recorded;
- tenant-context fail-closed behavior is verified;
- platform access boundaries are verified;
- connection-pool isolation is verified;
- framework patch status is verified;
- operational documentation is complete;
- known limitations are explicit;
- production-hardening work is documented but not implemented;
- no new feature work was performed;
- no unrelated file was modified;
- database safety rules were followed;
- final Git status is reported;
- `PHASE-06-FINAL-HANDOFF.md` is complete;
- Phase 6 is set to `IMPLEMENTED_AWAITING_APPROVAL`.

Passing tests does not authorize any later work.

---

## 16. End-of-Phase Gate

At completion:

1. complete `PHASE-06-FINAL-HANDOFF.md`;
2. update `PROJECT_STATE.md`;
3. update `RISK_REGISTER.md` only from verified evidence;
4. update `README.md` only when necessary for final operational handoff;
5. record the final Git state;
6. set Phase 6 to `IMPLEMENTED_AWAITING_APPROVAL`;
7. do not set `APPROVED_BY_USER`;
8. do not create Phase 7;
9. state that the approved manifest contains no phase after Phase 6;
10. stop.

---

## 17. Required Final Chat Response

Use the exact structure required by the Master Contract:

```markdown
## Phase 6 completed

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
- `docs/multi-tenant-implementation/phase-reports/PHASE-06-FINAL-HANDOFF.md`

### Git state
- Branch:
- Commit:
- Working tree:

### Gate
The next phase has NOT been started.
The approved Phase Manifest contains no phase after Phase 6.

To approve this phase, the user must explicitly send:

`APPROVE PHASE 6`
```

Stop after this response.

---

## 18. Plan Approval Gate

This plan authorizes no Phase 6 implementation until the user explicitly sends:

```text
APPROVE PHASE 6 PLAN
```

Approval of this plan only authorizes execution of the approved Phase 6 plan.

It does not approve the completed Phase 6 result.

After Phase 6 is completed, only the user may approve it by sending:

```text
APPROVE PHASE 6
```
