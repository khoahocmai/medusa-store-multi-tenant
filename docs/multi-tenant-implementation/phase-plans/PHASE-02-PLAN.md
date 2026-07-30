# Phase 2 Implementation Plan: PostgreSQL RLS and Tenant Context

**Status:** DRAFT_AWAITING_USER_APPROVAL

This plan outlines the database-enforced tenant isolation for the MVP scope approved in Phase 0.

## User Review Required
> [!IMPORTANT]
> Please review the framework patch decision and the proposed RLS policy design. I have determined that a framework patch is **NOT** necessary, provided we use the fail-closed RLS strategy detailed below.

## Proposed Changes

---

### Database Roles

We will provide an idempotent SQL setup script to create two PostgreSQL roles:
1. `migration_role`: Owns the schema and runs migrations.
2. `runtime_role`: Used by the Medusa application, configured with `NOSUPERUSER` and `NOBYPASSRLS`.

> [!CAUTION]
> The default Postgres role has `SUPERUSER` and `BYPASSRLS`. The application MUST connect using the new `runtime_role` after this phase to ensure RLS is enforced.

---

### RLS Policies and `tenant_id` Columns

For the approved MVP tables (`store`, `product`, `order`, `customer`), we will create a raw SQL migration to:
1. Add `tenant_id` column (Type: `text`, since Medusa IDs are text strings).
2. Set a Postgres `DEFAULT` constraint: `DEFAULT NULLIF(current_setting('app.current_tenant_id', true), '')`. This ensures inserts automatically receive the tenant context without patching Medusa's internal repositories.
3. Enable and Force RLS on each table.
4. Apply the following Fail-Closed Policy for ALL operations:
   ```sql
   CREATE POLICY "tenant_isolation_policy" ON "table_name"
   AS PERMISSIVE FOR ALL
   TO runtime_role
   USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
   WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
   ```

*Note: Since standard Medusa core routes do not set the transaction context, any core route invoked without the wrapper will fail to read/write data, providing a fail-closed security posture by default.*

---

### Tenant Context (AsyncLocalStorage)

#### [NEW] [tenant-context.ts](file:///d:/workspace/medusa-store-multi-tenant/apps/backend/src/utils/tenant-context.ts)
Implement the required `AsyncLocalStorage` context:
```typescript
export type TenantContext = {
  tenantId: string
  actorId?: string
  storeIds?: string[]
  accessMode: "tenant" | "platform"
}
```

---

### Transaction Wrapper (No Framework Patch)

#### [NEW] [transaction-wrapper.ts](file:///d:/workspace/medusa-store-multi-tenant/apps/backend/src/utils/transaction-wrapper.ts)
Instead of a risky monkey-patch, we will provide a supported transaction wrapper utilizing MikroORM's EntityManager (which is exposed via Medusa's shared context). This wrapper will explicitly set the PostgreSQL `app.current_tenant_id` parameter transaction-locally:

```typescript
// Wrapper to begin transaction, set context safely via set_config, and execute work.
export async function withTenantTransaction<T>(
  manager: EntityManager,
  work: (txManager: EntityManager) => Promise<T>
): Promise<T> { ... }
```

### Framework Patch Decision
**Decision: NO PATCH REQUIRED.**
Because the RLS policies are strictly fail-closed, any query lacking the transaction context (like unpatched core API routes) will safely return 0 rows or fail the `WITH CHECK` constraint. This meets all Phase 2 criteria without risking framework stability.

## Verification Plan

### Automated Tests
We will write integration tests covering:
- RLS read/write isolation (Tenant A cannot see/modify Tenant B).
- Missing context is denied.
- `runtime_role` cannot bypass RLS.
- Transaction rollback/commit context scoping (Pool-reuse isolation).

### Manual Verification
Review the test results ensuring no data leakage across connections occurs.
