# Risk Register

| ID | Risk | Severity | Phase | Mitigation | Status |
|---|---|---|---|---|---|
| R-01 | Cross-tenant data leakage via missing context | High | 2, 3 | Default to fail-closed RLS policies (NULL context = no access). | Open |
| R-02 | Spoofed tenant ID in HTTP headers | High | 3 | Validate `x-tenant-id` against authenticated actor's membership roles before setting context. | Open |
| R-03 | Connection-pool context leakage | High | 2 | Ensure transaction context is explicitly reset or correctly encapsulated via `set_config(..., true)` so state doesn't persist across pooled connections. | Open |
| R-04 | RLS bypass by database role | Critical | 2 | Introduce a dedicated `runtime_role` without `SUPERUSER` or `BYPASSRLS` privileges for the application connection. | Open |
| R-05 | Unsafe platform-admin bypass | High | 3, 4 | Enforce a distinct, explicit namespace/API and authentication flow for platform-admin access. | Open |
| R-06 | Medusa framework upgrade breaking a patch | Medium | 2 | If patching Medusa is necessary, implement a startup validation check that ensures the patch is applied correctly and fails safely if missing. | Open |
| R-07 | Background job without tenant context | Medium | 5 | Wrap job handlers to extract tenant ID from the signed job payload and set AsyncLocalStorage context. | Open |
| R-08 | Unprotected Medusa core routes | High | 3, 5 | Wrap or override unsafe core routes, or block them entirely if they cannot be safely tenant-scoped. | Open |
| R-09 | Incomplete tenant ownership mapping | Medium | 1 | Strictly define the source of truth for Store ownership (e.g., via a custom `TenantStore` link module) and prevent duplicate mappings. | Open |
