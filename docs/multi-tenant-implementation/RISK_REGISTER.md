# Risk Register

| ID | Risk | Severity | Phase | Mitigation | Status |
|---|---|---|---|---|---|
| R-01 | Cross-tenant data leakage via missing context | High | 2, 3 | Default to fail-closed RLS policies (NULL context = no access). | Open |
| R-02 | Spoofed tenant ID in HTTP headers | High | 3, 4 | Validate `x-tenant-id` against authenticated actor's membership roles before setting context. | Mitigated |
| R-03 | Connection-pool context leakage | High | 2 | Ensure transaction context is explicitly reset or correctly encapsulated via `set_config(..., true)` so state doesn't persist across pooled connections. | Mitigated |
| R-04 | RLS bypass by database role | Critical | 2 | Introduce a dedicated `runtime_role` without `SUPERUSER` or `BYPASSRLS` privileges for the application connection. | Mitigated |
| R-05 | Unsafe platform-admin bypass | High | 3, 4 | Enforce a distinct, explicit namespace/API and authentication flow for platform-admin access. | Mitigated |
| R-06 | Medusa framework upgrade breaking a patch | Medium | 2, 4 | If patching Medusa is necessary, implement a startup validation check that ensures the patch is applied correctly and fails safely if missing. | Mitigated |
| R-07 | Background job without tenant context | Medium | 5 | Wrap job handlers to extract tenant ID from the signed job payload and set AsyncLocalStorage context. | Open |
| R-08 | Unprotected Medusa core routes leak data and protected routes fail-closed | Critical | 3 | Implement and verify a minimal Medusa 2.18.0 framework patch for HTTP transaction propagation. Keep routes with unprotected entity dependencies blocked until their isolation mechanism is approved and implemented. | Open |
| R-09 | Incomplete tenant ownership mapping | Medium | 1 | Strictly define the source of truth for Store ownership (e.g., via a custom `TenantStore` link module) and prevent duplicate mappings. | Mitigated |
| R-10 | Express middleware cannot propagate transactions to nested workflows | Critical | 3 | Explicitly pass the resolved transaction manager into workflow executions (`context: { manager: txManager }`) and prove propagation via integration tests. | Mitigated |
