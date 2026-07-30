# Architecture Decisions

## ADR-001: Multi-Tenant Architecture Strategy

**Status:** Proposed
**Context:** The system needs to support multiple independent tenants (businesses/franchises) within a single deployment, where each tenant can own multiple Medusa stores. Data isolation and security are paramount.
**Decision:** Adopt a Single-Application / Single-Database multi-tenancy model using PostgreSQL Row Level Security (RLS) and Medusa's module linking, governed by AsyncLocalStorage for request/transaction contexts.
**Reason:** This balances operational complexity (avoiding infrastructure overhead of multi-DB/multi-instance) with strong database-level data isolation guarantees.
**Alternatives considered:** 
- Schema-per-tenant (complex migrations and connection pooling).
- Database-per-tenant (high infrastructure cost and operational overhead).
- Application-level isolation only (high risk of accidental data leakage).
**Consequences:** Requires strict management of the `runtime_role` in PostgreSQL, application patches/hooks for context propagation, and careful review of core Medusa APIs to ensure they respect the RLS context.
**User approval:** Pending (via Phase 0 Approval)
