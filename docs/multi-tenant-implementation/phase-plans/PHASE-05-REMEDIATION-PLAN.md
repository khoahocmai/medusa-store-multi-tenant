# Phase 5 Remediation Plan: Tenant Assignment and Context Propagation

This plan addresses the tenant assignment defects and context-propagation weaknesses discovered during Phase 5 isolation verification.

## 1. Exact objective

The remediation objective is to:
- make tenant assignment deterministic for every approved protected entity;
- ensure the tenant context is set on the exact connection executing each query;
- prevent protected rows from being inserted with `tenant_id = NULL`;
- preserve fail-closed behavior;
- remove or harden any unsafe platform-admin database bypass;
- restore Product, Store, Order, and Customer regression coverage.

## 2. Root-cause confirmation stage

Before proposing implementation, the implementation phase must capture evidence for Store, Product, Order, and Customer separately.

The implementation phase must capture:
- actual INSERT SQL;
- bound parameters;
- whether `tenant_id` is omitted or explicitly bound as NULL;
- PostgreSQL connection identity;
- `current_user`;
- backend PID;
- transaction ID;
- `current_setting('app.current_tenant_id', true)`;
- `current_setting('app.is_platform_admin', true)`;
- whether BEGIN or START TRANSACTION occurred;
- whether `set_config` occurred on the same connection before INSERT;
- whether the module uses autocommit;
- whether the module uses the patched `pg.Client`.

The plan must distinguish these possible causes:
A. ORM explicitly binds `tenant_id = NULL`.
B. Column default executes with missing tenant context.
C. Query runs in autocommit and no hook executes.
D. Transaction begins using syntax not matched by the hook.
E. `set_config` runs on a different connection.
F. Context is cleared before the query.
G. Module driver bypasses patched `pg.Client`.
H. Test state pollution or stale fixtures.
I. Model metadata exposes a nullable tenant field incorrectly.
J. Another verified cause.

No remediation should be selected until the exact applicable causes are proven.

## 3. Context-propagation design

Evaluate supported options in this order:

1. **A supported Medusa/MikroORM/Knex transaction or connection hook:**
   - Evaluates whether the framework natively supports injecting connection configuration.
   - Compatibility: Depends on undocumented internals of Medusa 2.18 connection pooling.
   - Failure mode: Could bypass decoupled module connections.
   - Reason selected/rejected: Rejected initially due to high risk of missing independent connection pools.
2. **Explicit transaction-manager propagation into module operations:**
   - Explicitly passing transaction objects to all module operations.
   - Framework-upgrade risk: Low.
   - Reason selected/rejected: Rejected because HTTP endpoints and core Medusa logic abstract the transaction manager; we cannot rewrite Medusa's internal handlers to pass managers everywhere.
3. **A generalized pg connection/query hook:**
   - Covers: `BEGIN`, `START TRANSACTION`, autocommit, and all relevant module pools.
   - Testability: High.
   - Reason selected/rejected: Selected as the primary application-layer mechanism. The current `BEGIN` regex patch is insufficient and must be expanded to cover `START TRANSACTION` and autocommit queries if feasible, ensuring no query executes without context.
4. **Explicit tenant field assignment at application/module boundaries:**
   - Adding `tenant_id` to data models explicitly.
   - Framework-upgrade risk: Medium.
   - Reason selected/rejected: Selected to prevent the ORM from inserting explicit NULLs.
5. **PostgreSQL trigger enforcement as defense in depth:**
   - Evaluated as the ultimate database safety net.
   - Reason selected/rejected: Selected to override any ORM omission and unconditionally enforce the tenant boundary.

## 4. Tenant-assignment database guard

Design a BEFORE INSERT trigger that:
- reads `app.current_tenant_id`;
- rejects insertion when tenant context is missing;
- does not silently write NULL;
- prevents ORM-bound NULL from overriding tenant assignment;
- prevents a tenant from supplying another tenant’s ID;
- preserves approved platform operations only through an explicit safe mechanism;
- is idempotent and migration-safe.

The trigger will:
- **Validate** an explicitly supplied tenant ID against current context, OR **overwrite** `NEW.tenant_id` if missing or explicitly NULL.
- Valid tenant context: Assigns context tenant ID to `NEW.tenant_id`.
- Missing context: Rejects insertion (fail-closed).
- Invalid tenant context: Rejects insertion.
- Tenant mismatch: Rejects insertion.
- Explicit NULL: Overwrites with context tenant ID (or rejects if not platform admin).
- Platform operation: Allows explicit NULL or explicit ID if `app.is_platform_admin = 'true'` (subject to hardening).
- Migration/setup role: Uses `migration_role` which bypasses RLS and triggers if appropriately configured, though triggers fire regardless of RLS unless bypassed.

This trigger acts as defense in depth and does not replace correct connection context propagation.

## 5. Platform-admin GUC audit

Explicitly test whether `runtime_role` can execute:
`SELECT set_config('app.is_platform_admin', 'true', true);`
Then determine whether it can read or mutate another tenant’s protected rows.

If runtime_role can self-enable platform mode, this is a critical RLS bypass.
Proposed safe alternative:
- Remove the GUC bypass (`current_setting('app.is_platform_admin') = 'true'`) from the tenant isolation policies.
- Rely on a separate database role (e.g., `platform_role`) for platform operations, avoiding GUC spoofing entirely.

## 6. Existing NULL-row handling

Differentiate:
- Isolated test data
- Development data
- Production data

Reconciliation procedure:
- Identify every protected row with `tenant_id IS NULL`.
- Determine ownership from approved links or audit evidence.
- Refuse ambiguous backfills.
- Report orphaned or ambiguous rows.
- Run only after database identity and environment are verified.
- **Never executed against production without separate explicit approval.**

For the Phase 5 isolated test database: Rebuild safe fixtures through the approved harness rather than broad updates or truncation.

## 7. Exact entities and tables

Recover the approved Phase 0 matrix and list the exact protected physical tables:
- **Store:** `public.store`
- **Product:** `public.product`
- **Order:** `public.order`
- **Customer:** `public.customer`

Supporting link tables relevant to ownership:
- `public.store_tenant_link` (or equivalent link table)
- `public.product_store_link` (if applicable)

Do not add Cart, Payment, Fulfillment, Pricing, Inventory, Promotion, or other out-of-scope entities.

## 8. Exact production files and migrations

To be created/modified:
- `apps/backend/src/utils/rls-pg-hook.ts`: Enhance interception coverage for `START TRANSACTION` and autocommit.
- `apps/backend/src/modules/tenant/migrations/<timestamp>_RemediateRLS.ts`: Add `BEFORE INSERT` triggers for `store`, `product`, `order`, and `customer`.

Because exact models (whether to extend `Product`, `Order`, `Customer` models in `src/modules/tenant/models/`) depend on the root-cause confirmation step (to determine if the ORM requires the property mapped to stop sending NULL), the exact set of model files is pending root-cause evidence.
Consequently, broad directories are not authorized.
**Status: BLOCKED** (Pending exact root-cause file identification during implementation).

## 9. Exact test remediation

Specify tests for each protected entity (Store, Product, Order, Customer):
- valid tenant create;
- owner read one;
- owner read list;
- Tenant B read denied;
- missing context denied;
- invalid context denied;
- direct-ID denied;
- cross-tenant update denied;
- cross-tenant delete denied;
- explicit foreign tenant ID insert denied;
- explicit NULL tenant ID prevented;
- autocommit path;
- transactional path;
- rollback path;
- pooled connection reuse;
- parallel Tenant A/Tenant B execution.

For Product and Order:
- Distinguish database/module RLS verification from HTTP route verification and known Medusa HTTP dependency limitations.
- Do not use Customer evidence as a substitute for Product or Order evidence.

## 10. Regression commands

Require execution of:
- `npm run build`
- Complete Phase 2 RLS tests: `npx jest apps/backend/src/modules/tenant/__tests__/tenant-rls.spec.ts`
- Phase 4 full regression suite (29 tests): `npx jest apps/backend/integration-tests/http/custom-provisioning.spec.ts`
- Phase 5 isolation suite: `npx jest apps/backend/integration-tests/http/isolation-verification.spec.ts`
- Patch/application verification.
- Clean isolated-database rerun.

## 11. Database safety

Before any migration or database test, report:
- host;
- database name;
- role;
- environment type;
- superuser status;
- BYPASSRLS status;
- table ownership;
- confirmation of isolated non-production target.

Prohibitions:
- database drop;
- schema drop;
- automatic database reset;
- broad truncate;
- destructive cleanup;
- unidentified database use;
- `.env` modification;
- production migration;
- printing secrets or full database URLs.

## 12. Failure handling

If remediation requires a new entity, new business API, dependency upgrade, broad framework rewrite, out-of-scope table isolation, destructive database operation, or unresolved ownership backfill:
- Set the amendment to `BLOCKED`.
- Request user approval.
- Do not silently broaden the remediation.

## 13. Acceptance criteria

The remediation is successful only when:
- every protected insert receives the correct non-null tenant ID;
- missing tenant context fails before or during insert;
- explicit NULL cannot create a hidden row;
- cross-tenant tenant ID injection is denied;
- runtime_role cannot self-enable platform access;
- Store, Product, Order, and Customer owner visibility passes;
- cross-tenant read/update/delete tests pass;
- autocommit and transactional paths pass;
- rollback and pool reuse do not leak context;
- parallel tenant requests remain isolated;
- Phase 2 tests pass;
- Phase 4 regression remains 29/29;
- Phase 5 tests all pass or unsupported HTTP operations are accurately documented as limitations;
- backend build passes;
- no out-of-scope entity was implemented;
- report and Project State are updated;
- Phase 5 returns to `IMPLEMENTED_AWAITING_APPROVAL`;
- Phase 6 remains `NOT_STARTED`.

## 14. Rollback design

- **Migration down behavior:** Drops the `BEFORE INSERT` triggers and drops the associated trigger functions.
- **Trigger removal behavior:** Removed cleanly from `store`, `product`, `order`, `customer`.
- **Policy rollback behavior:** Reverts to the original custom GUC platform branch if replaced.
- **Application-hook rollback behavior:** Reverts `rls-pg-hook.ts` to the Phase 3 implementation.
- **Test rows:** Safe handling of rows created during failed tests through isolated database tear-down or targeted cleanup.
- **Working tree:** Preservation of existing working-tree changes.
- **Git:** Prohibition on automatic Git reset or revert.

## 15. Status and approval gate

- **Phase 5 status:** `BLOCKED`
- **Remediation plan status:** `DRAFT_AWAITING_USER_APPROVAL`
- **Next allowed action:** `APPROVE PHASE 5 REMEDIATION PLAN`
