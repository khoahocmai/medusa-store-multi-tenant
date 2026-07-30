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

**Status:** Proposed (Blocked pending user decision)
**Context:** RLS policies on core Medusa tables (`product`, `order`, etc.) cause core API routes (e.g., `/store/products`) to fail-closed (return 0 rows) because they do not run inside our `withTenantTransaction` wrapper.
**Decision:** We must choose a propagation strategy that preserves core commerce usability without violating the MVP scope.
**Alternatives considered:**
1. **Supported Knex Pool Hooks (Status: REJECTED_BY_ARCHITECTURE_SPIKE):** Tarn.js `acquire` events are not awaited, meaning `set_config` races with application queries. `afterCreate` only runs once and cannot inject per-request tenant context.
2. **Minimal Version-Specific Framework Patch (Status: SELECTED):** Patch Medusa's internal HTTP handler pipeline to globally inject `withTenantTransaction`. This restores core commerce flows without rewriting them.
3. **Expanded RLS + Custom Commerce APIs (Status: REJECTED_OUT_OF_SCOPE):** Reject core routes entirely. Add RLS everywhere and build custom `/store/tenant/...` routes. Enormous maintenance cost, massive scope explosion. Violates MVP.
**Consequences:** Awaiting user approval to apply the minimal framework patch for HTTP transaction propagation.
