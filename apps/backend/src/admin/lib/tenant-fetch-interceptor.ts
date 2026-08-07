import { getActiveWorkspace, clearActiveWorkspace } from "./workspace-storage"

let isInterceptorInstalled = false

const bypassList = [
  "/admin/auth",
  "/admin/users/me",
  "/admin/tenant/available",
  "/admin/tenant/current",
  "/admin/tenant/workspace"
]

export const installTenantFetchInterceptor = () => {
  if (typeof window === "undefined" || isInterceptorInstalled) return
  isInterceptorInstalled = true

  const originalFetch = window.fetch

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlString = ""
    if (typeof input === "string") {
      urlString = input
    } else if (input instanceof URL) {
      urlString = input.href
    } else if (input instanceof Request) {
      urlString = input.url
    }

    try {
      // Only intercept /admin/* routes
      if (urlString.includes("/admin/")) {
        const urlObj = new URL(urlString, window.location.origin)
        
        // Ensure same-origin
        if (urlObj.origin === window.location.origin) {
          
          // Check bypass list
          const isBypassed = bypassList.some(r => urlObj.pathname.startsWith(r))
          
          if (!isBypassed) {
            const activeWorkspace = getActiveWorkspace()
            
            // If no active workspace and user is not on the select-workspace screen, redirect
            if (!activeWorkspace && window.location.pathname !== "/app/select-workspace") {
              // Wait for the synthetic store shim or missing workspace crash to occur, 
              // but we redirect them away to the selection page immediately.
              document.body.style.display = "none"
              window.location.replace("/app/select-workspace")
            }

            if (activeWorkspace) {
              // Prevent sentinel injection via UI fetch
              if (activeWorkspace.tenant_id === "__workspace_unselected__") {
                console.error("Sentinel detected in sessionStorage. Clearing active workspace.")
                clearActiveWorkspace()
                document.body.style.display = "none"
                window.location.replace("/app/select-workspace")
                return Promise.reject(new Error("Sentinel detected in UI storage."))
              }

              // Apply the x-tenant-id header
              if (input instanceof Request) {
                // For Request objects, we must clone and append the header
                const newHeaders = new Headers(input.headers)
                if (!newHeaders.has("x-tenant-id")) {
                  newHeaders.set("x-tenant-id", activeWorkspace.tenant_id)
                }
                input = new Request(input, { headers: newHeaders })
              } else {
                // For string or URL inputs
                init = init || {}
                init.headers = new Headers(init.headers || {})
                if (!init.headers.has("x-tenant-id")) {
                  init.headers.set("x-tenant-id", activeWorkspace.tenant_id)
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to intercept tenant fetch", e)
    }

    const response = await originalFetch(input, init)

    // Watch for synthetic store shim sent by backend
    if (urlString.includes("/admin/stores")) {
      try {
        const clone = response.clone()
        const data = await clone.json()
        if (data?.stores?.[0]?.id === "__workspace_unselected__") {
          if (window.location.pathname !== "/app/select-workspace") {
            document.body.style.display = "none"
            window.location.replace("/app/select-workspace")
          }
        }
      } catch (e) {
        // Not JSON or failed to read clone
      }
    }

    return response
  }
}
