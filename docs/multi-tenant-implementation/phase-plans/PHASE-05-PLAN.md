# Phase 5 Plan: Isolation Coverage and Verification

## Status
Phase 5 status: NOT_STARTED  
Phase 5 plan status: DRAFT_AWAITING_USER_APPROVAL  
Next allowed action: APPROVE PHASE 5 PLAN  

## Objective
Verify and complete the approved MVP isolation scope across all relevant execution paths, specifically ensuring that background jobs, subscribers, webhooks, and Medusa core services respect the PostgreSQL RLS context, and conduct rigorous security and negative testing.

## User Review Required

> [!IMPORTANT]  
> Please review this plan to ensure it strictly follows the boundaries set by the Master Contract for Phase 5. Approval is required before execution begins.

---

## 1. Phase-Gate & Database Safety Validation

Before implementing any Phase 5 production code, the following validations will be performed:
1. Verify `PROJECT_STATE.md` lists Phase 4 as `APPROVED_BY_USER`.
2. Verify Phase 5 is the next sequential phase.
3. Record Git state before modifying any files.
4. Compare repository with the end state of Phase 4 and halt if unrelated uncommitted files block execution.

---

## 2. Planned Scope

### 2.1 Audit Background Execution Contexts
- Inspect how Medusa 2.18.0 dispatches background jobs (e.g., Scheduled Jobs) and Subscribers.
- Determine the injection point where asynchronous/background contexts run outside of the HTTP request lifecycle.
- **Risk Mitigation (R-07):** Formulate a strategy to wrap job handlers and subscribers so they extract the `tenant_id` from their payload (if tenant-owned) and execute within the `withTenantTransaction` wrapper or an equivalent RLS boundary.

### 2.2 Security and Negative Testing
- **Spoofed Headers (R-02 verification):** Guarantee that `x-tenant-id` passing an unauthorized tenant ID is rejected and does not bypass the JWT membership verification.
- **Connection Pool Leakage (R-03 verification):** Conduct high-concurrency simulation or consecutive query tests across different tenants to ensure `set_config` states do not bleed into subsequent queries on the same connection.
- **Direct ORM Leakage:** Attempt direct queries via `MikroORM` or `Knex` outside of standard Medusa services to confirm that, without the tenant context, the queries fail-closed (return 0 rows for tenant-owned tables).
- **Global / Platform Admin Access:** Ensure that missing tenant context defaults to no access, rather than granting global access, protecting core tables.

### 2.3 Verify Isolation Matrix
Verify the isolation rules against the Entity Isolation Matrix established in Phase 0/1:
- Tenant: Platform-owned
- Store: Tenant-owned
- TenantMembership: Platform-owned/Tenant-associated
- StoreLocator: Platform-owned (public resolution)

Confirm that isolation holds at the database level for all of the above, preventing any cross-tenant data mingling.

---

## 3. Required Deliverables

1. **Subscribers/Jobs RLS Wrapper:** Implement a safe context wrapper for background tasks (if applicable).
2. **Comprehensive Isolation Test Suite:** Adding negative tests for connection pool leakage, spoofed headers, and ORM bypass attempts.
3. **Phase 5 Implementation Report:** `docs/multi-tenant-implementation/phase-reports/PHASE-05-ISOLATION-VERIFICATION.md` documenting test results and execution traces.
4. **Updated Documentation:** Update `PROJECT_STATE.md` and `RISK_REGISTER.md` indicating closure of risks R-07, R-08, etc.

---

## 4. Excluded Scope

- No new features outside of isolation logic and test coverage.
- Expanding the entity-isolation matrix outside Phase 0 approval.
- Custom APIs or routes unrelated to multi-tenancy testing.
