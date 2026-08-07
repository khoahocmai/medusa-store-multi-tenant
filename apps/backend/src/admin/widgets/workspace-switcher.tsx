import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useQuery } from "@tanstack/react-query"
import { DropdownMenu, Button, Heading, Text, Container } from "@medusajs/ui"
import { BuildingStorefront, Buildings } from "@medusajs/icons"
import { getActiveWorkspace, clearActiveWorkspace } from "../lib/workspace-storage"
import { installTenantFetchInterceptor } from "../lib/tenant-fetch-interceptor"
import { useMemo } from "react"

// Ensure interceptor is installed when the widget loads
installTenantFetchInterceptor()

const WorkspaceSwitcherWidget = () => {
  const activeWorkspace = getActiveWorkspace()

  const { data: tenantContext } = useQuery({
    queryKey: ["tenant_current"],
    queryFn: () => fetch("/admin/tenant/current").then(res => res.json()),
  })

  const { data: availableData } = useQuery({
    queryKey: ["tenant_available"],
    queryFn: () => fetch("/admin/tenant/available").then(res => res.json()),
  })

  const isPlatformAdmin = tenantContext?.is_platform_admin

  if (!activeWorkspace) {
    return null
  }

  const handleClearWorkspace = () => {
    clearActiveWorkspace()
    window.location.replace("/app/select-workspace")
  }

  const handleSwitchWorkspace = async (tenantId: string, tenantName: string) => {
    try {
      const res = await fetch("/admin/tenant/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspace_id: tenantId })
      })

      if (res.ok) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("medusa:active_workspace", JSON.stringify({
            actor_id: activeWorkspace.actor_id,
            tenant_id: tenantId,
            tenant_name: tenantName
          }))
          window.location.reload()
        }
      }
    } catch (e) {
      console.error("Failed to switch workspace", e)
    }
  }

  const availableTenants = availableData?.tenants || []

  return (
    <div className="flex items-center gap-x-2 mr-2">
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button variant="secondary" size="small" className="gap-x-2">
            {isPlatformAdmin ? <Buildings className="text-ui-fg-subtle" /> : <BuildingStorefront className="text-ui-fg-subtle" />}
            <span className="truncate max-w-[150px]">
              {isPlatformAdmin ? `Platform | ${activeWorkspace.tenant_name}` : activeWorkspace.tenant_name}
            </span>
          </Button>
        </DropdownMenu.Trigger>
        
        <DropdownMenu.Content align="end" className="w-64 max-h-96 overflow-y-auto">
          <DropdownMenu.Group>
            <DropdownMenu.Label>Switch Workspace</DropdownMenu.Label>
            {availableTenants.map((t: any) => (
              <DropdownMenu.Item 
                key={t.id} 
                onClick={() => handleSwitchWorkspace(t.id, t.name)}
                className={t.id === activeWorkspace.tenant_id ? "bg-ui-bg-base-pressed" : ""}
              >
                <div className="flex flex-col">
                  <span className="text-ui-fg-base">{t.name}</span>
                  {t.id === activeWorkspace.tenant_id && (
                    <span className="text-xs text-ui-fg-subtle">Current workspace</span>
                  )}
                </div>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>

          <DropdownMenu.Separator />
          
          <DropdownMenu.Group>
            <DropdownMenu.Item onClick={handleClearWorkspace}>
              <span className="text-ui-fg-error">Exit Workspace</span>
            </DropdownMenu.Item>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "topbar"
})

export default WorkspaceSwitcherWidget
