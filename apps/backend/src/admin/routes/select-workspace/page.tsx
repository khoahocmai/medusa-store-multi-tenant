import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useQuery } from "@tanstack/react-query"
import { Container, Heading, Text, Select, Button } from "@medusajs/ui"
import { useState, useEffect } from "react"
import { setActiveWorkspace, getActiveWorkspace } from "../../lib/workspace-storage"
import { installTenantFetchInterceptor } from "../../lib/tenant-fetch-interceptor"

installTenantFetchInterceptor()

const SelectWorkspaceRoute = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Robustly restore body display in case the interceptor hid it during a soft SPA navigation
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.display = ""
    }
  }, [])

  const { data: availableData, isLoading: isLoadingTenants } = useQuery({
    queryKey: ["tenant_available"],
    queryFn: () => fetch("/admin/tenant/available").then(res => res.json()),
  })

  const tenants = availableData?.tenants || []
  const actorScope = availableData?.actor_scope

  const handleEnterWorkspace = async () => {
    if (!selectedId) return

    setLoading(true)
    const selectedTenant = tenants.find((t: any) => t.id === selectedId)

    try {
      const res = await fetch("/admin/tenant/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspace_id: selectedId })
      })

      if (res.ok) {
        setActiveWorkspace({
          actor_id: availableData?.actor_id,
          tenant_id: selectedId,
          tenant_name: selectedTenant?.name || "Unknown Workspace"
        })
        
        // Navigate to dashboard
        window.location.replace("/app")
      } else {
        const err = await res.json()
        alert(err.message || "Failed to select workspace")
        setLoading(false)
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  if (isLoadingTenants) {
    return (
      <div className="fixed inset-0 z-40 bg-ui-bg-base flex h-screen w-full items-center justify-center p-8">
        <Text>Loading workspaces...</Text>
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-ui-bg-base">
        <Container className="mx-auto max-w-lg mt-24 p-8 flex flex-col gap-y-4">
          <Heading level="h1">No Available Workspace</Heading>
          <Text className="text-ui-fg-subtle">
            You are not currently authorized for any active workspaces. Please contact your administrator.
          </Text>
        </Container>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 bg-ui-bg-subtle flex flex-col">
      {/* Optional: Simple header with branding could go here */}
      <div className="flex-1 overflow-y-auto flex justify-center py-24 px-4">
        <Container className="w-full max-w-lg p-8 flex flex-col gap-y-6 shadow-elevation-card-rest bg-ui-bg-base">
          <div className="flex flex-col gap-y-1">
            <Heading level="h1">Select workspace</Heading>
            <Text className="text-ui-fg-subtle">
              {actorScope === "platform" 
                ? "Choose a tenant you want to manage (Platform Admin)." 
                : "Choose the workspace you want to manage."}
            </Text>
          </div>

          <div className="flex flex-col gap-y-2">
            <label className="text-sm font-medium text-ui-fg-base">Workspace</label>
            <Select value={selectedId || ""} onValueChange={setSelectedId}>
              <Select.Trigger>
                <Select.Value placeholder="Select a workspace" />
              </Select.Trigger>
              <Select.Content className="z-[100]">
                {tenants.map((t: any) => (
                  <Select.Item key={t.id} value={t.id}>
                    {t.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="flex justify-end mt-4">
            <Button 
              variant="primary" 
              disabled={!selectedId || loading} 
              isLoading={loading}
              onClick={handleEnterWorkspace}
            >
              Enter workspace
            </Button>
          </div>
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Select Workspace",
})

export default SelectWorkspaceRoute
