/**
 * patch-helper.ts
 *
 * Injected by the wrap-handler.js patch (ADR-003 / Phase 3) into every
 * Medusa route handler.
 *
 * Responsibilities:
 * 1. Read the tenant context headers and populate AsyncLocalStorage.
 * 2. Delegate immediately to the original route handler — no extra Knex
 *    transaction is opened here.  RLS context is injected at the pg.Client
 *    level by rls-pg-hook.ts, which fires on every BEGIN regardless of whether
 *    the transaction originates from Knex or MikroORM.
 */

import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { tenantContext } from "./tenant-context"

// Install the pg-level RLS hook once at import time so that it is active
// before any request is processed.
import { installRlsPgHook } from "./rls-pg-hook"
installRlsPgHook()

export async function executeInTenantTransaction(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
  fn: (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => Promise<void>
): Promise<void> {
  const path = req.originalUrl || req.path || ""

  // Reject body-level tenant_id override on tenant/store provisioning routes.
  // The tenant_id MUST come from the verified tenantContext only.
  if (
    (path.startsWith("/admin/tenant/stores") ||
      path.startsWith("/admin/tenant/")) &&
    req.method === "POST"
  ) {
    const body = req.body as Record<string, unknown> | undefined
    if (body && "tenant_id" in body) {
      res.status(400).json({
        message: "tenant_id must not be supplied in the request body",
      })
      return
    }
  }

  const headerTenantId = req.headers["x-tenant-id"] as string | undefined

  // If tenantContext is already set (by tenant-resolution middleware), respect it.
  // Otherwise construct a context from headers.
  const existingCtx = tenantContext.getStore()

  if (existingCtx) {
    // Context already established by middleware — just run the handler.
    return fn(req, res, next)
  }

  const contextData = {
    tenantId: headerTenantId ?? null,
    accessMode: (headerTenantId ? "tenant" : "platform") as "tenant" | "platform",
  }

  return tenantContext.run(contextData, () => fn(req, res, next))
}
