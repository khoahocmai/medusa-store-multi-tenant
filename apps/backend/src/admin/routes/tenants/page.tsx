import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingsSolid } from "@medusajs/icons"
import { useState } from "react"
import { 
  Container, 
  Heading, 
  Table, 
  Button, 
  Drawer, 
  Input, 
  Label,
  Badge,
  toast
} from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { RestrictedAccessView } from "../../components/restricted-access-view"

export const config = defineRouteConfig({
  label: "Tenants",
  icon: BuildingsSolid,
})

const fetchTenants = async () => {
  const res = await fetch("/admin/platform/tenants")
  if (!res.ok) {
    throw new Error("Failed to fetch tenants")
  }
  return res.json()
}

const createTenant = async (data: any) => {
  const res = await fetch("/admin/platform/tenants", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
  
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.message || "Failed to create tenant")
  }
  return res.json()
}

const TenantsPage = () => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    handle: "",
    admin_email: "",
    admin_password: ""
  })
  
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["platform_tenants"],
    queryFn: fetchTenants,
    retry: false
  })

  const mutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      toast.success("Tenant created successfully")
      queryClient.invalidateQueries({ queryKey: ["platform_tenants"] })
      setDrawerOpen(false)
      setFormData({ name: "", handle: "", admin_email: "", admin_password: "" })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // EARLY RETURN: Prevent rendering Header/Drawer if there's an error
  if (error) {
    return <RestrictedAccessView />
  }

  return (
    <Container className="p-8">
      <div className="flex justify-between items-center mb-6">
        <Heading level="h1">Tenant Management (Platform Admin)</Heading>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Drawer.Trigger asChild>
            <Button variant="secondary">Create Tenant</Button>
          </Drawer.Trigger>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>Create New Tenant</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="p-4">
              <form id="create-tenant-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Tenant Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="Acme Corp" 
                    required 
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="handle">Handle (Domain slug)</Label>
                  <Input 
                    id="handle" 
                    name="handle" 
                    placeholder="acme-corp" 
                    required 
                    value={formData.handle}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="admin_email">Initial Admin Email</Label>
                  <Input 
                    id="admin_email" 
                    name="admin_email" 
                    type="email" 
                    placeholder="admin@acme.com" 
                    required 
                    value={formData.admin_email}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="admin_password">Initial Admin Password</Label>
                  <Input 
                    id="admin_password" 
                    name="admin_password" 
                    type="password" 
                    required 
                    value={formData.admin_password}
                    onChange={handleChange}
                  />
                </div>
              </form>
            </Drawer.Body>
            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Drawer.Close>
              <Button type="submit" form="create-tenant-form" isLoading={mutation.isPending}>
                Create
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Handle</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Members</Table.HeaderCell>
            <Table.HeaderCell>Stores</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {isLoading ? (
            <Table.Row>
              <Table.Cell colSpan={5} className="text-center py-4">Loading...</Table.Cell>
            </Table.Row>
          ) : data?.tenants?.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={5} className="text-center py-4">No tenants found</Table.Cell>
            </Table.Row>
          ) : (
            data?.tenants?.map((tenant: any) => (
              <Table.Row key={tenant.id}>
                <Table.Cell className="font-medium">{tenant.name}</Table.Cell>
                <Table.Cell>{tenant.handle}</Table.Cell>
                <Table.Cell>
                  <Badge color={tenant.status === 'active' ? 'green' : 'grey'}>
                    {tenant.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{tenant.memberships?.length || 0}</Table.Cell>
                <Table.Cell>{tenant.store_locators?.length || 0}</Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table>
    </Container>
  )
}

export default TenantsPage
