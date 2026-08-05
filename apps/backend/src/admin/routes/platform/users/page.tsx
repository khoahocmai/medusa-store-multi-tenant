import { defineRouteConfig } from "@medusajs/admin-sdk"
import { UsersSolid } from "@medusajs/icons"
import { useState } from "react"
import { 
  Container, 
  Heading, 
  Table, 
  Button, 
  Drawer, 
  Input, 
  Label,
  Select,
  toast,
  Badge
} from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { RestrictedAccessView } from "../../../components/restricted-access-view"

export const config = defineRouteConfig({
  label: "Platform Users",
  icon: UsersSolid,
})

const fetchUsers = async () => {
  const res = await fetch("/admin/platform/users")
  if (!res.ok) {
    throw new Error("Failed to fetch platform users")
  }
  return res.json()
}

const fetchTenants = async () => {
  const res = await fetch("/admin/platform/tenants")
  if (!res.ok) {
    throw new Error("Failed to fetch tenants")
  }
  return res.json()
}

const createUser = async (data: any) => {
  const res = await fetch("/admin/platform/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
  
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.message || "Failed to create user")
  }
  return res.json()
}

const PlatformUsersPage = () => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    tenant_id: "",
    role: "member"
  })
  
  const queryClient = useQueryClient()

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["platform_users"],
    queryFn: fetchUsers,
    retry: false
  })

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ["platform_tenants"],
    queryFn: fetchTenants,
    enabled: !usersError
  })

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast.success("User created successfully")
      queryClient.invalidateQueries({ queryKey: ["platform_users"] })
      setDrawerOpen(false)
      setFormData({ email: "", first_name: "", last_name: "", tenant_id: "", role: "member" })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.tenant_id) {
      toast.error("Vui lòng chọn Tenant")
      return
    }
    mutation.mutate(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  // EARLY RETURN: Prevent rendering Header/Drawer if there's an error
  if (usersError) {
    return <RestrictedAccessView />
  }

  return (
    <Container className="p-8">
      <div className="flex justify-between items-center mb-6">
        <Heading level="h1">User Management (Platform)</Heading>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Drawer.Trigger asChild>
            <Button variant="secondary">Create Tenant User</Button>
          </Drawer.Trigger>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>Create New User for Tenant</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="p-4">
              <form id="create-user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email <span className="text-ui-fg-error">*</span></Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email"
                    placeholder="user@example.com" 
                    required 
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input 
                    id="first_name" 
                    name="first_name" 
                    placeholder="John" 
                    value={formData.first_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input 
                    id="last_name" 
                    name="last_name" 
                    placeholder="Doe" 
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tenant_id">Tenant (Cửa hàng) <span className="text-ui-fg-error">*</span></Label>
                  <Select onValueChange={(val) => handleSelectChange('tenant_id', val)} value={formData.tenant_id}>
                    <Select.Trigger>
                      <Select.Value placeholder="Select a Tenant" />
                    </Select.Trigger>
                    <Select.Content>
                      {tenantsLoading ? (
                        <Select.Item value="loading" disabled>Loading tenants...</Select.Item>
                      ) : tenantsData?.tenants?.length > 0 ? (
                        tenantsData.tenants.map((tenant: any) => (
                          <Select.Item key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </Select.Item>
                        ))
                      ) : (
                        <Select.Item value="empty" disabled>No active tenants</Select.Item>
                      )}
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="role">Role (Vai trò)</Label>
                  <Select onValueChange={(val) => handleSelectChange('role', val)} value={formData.role}>
                    <Select.Trigger>
                      <Select.Value placeholder="Select a Role" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="member">Member</Select.Item>
                      <Select.Item value="admin">Admin</Select.Item>
                      <Select.Item value="owner">Owner</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </form>
            </Drawer.Body>
            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Drawer.Close>
              <Button type="submit" form="create-user-form" isLoading={mutation.isPending}>
                Create User
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Tenant (Cửa hàng)</Table.HeaderCell>
            <Table.HeaderCell>Role</Table.HeaderCell>
            <Table.HeaderCell>Created At</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {usersLoading ? (
            <Table.Row>
              <Table.Cell colSpan={5} className="text-center py-4">Loading...</Table.Cell>
            </Table.Row>
          ) : usersData?.users?.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={5} className="text-center py-4">No users found</Table.Cell>
            </Table.Row>
          ) : (
            usersData?.users?.map((user: any) => (
              <Table.Row key={user.id}>
                <Table.Cell className="font-medium">{user.email}</Table.Cell>
                <Table.Cell>{[user.first_name, user.last_name].filter(Boolean).join(" ") || "-"}</Table.Cell>
                <Table.Cell>
                  {user.is_platform ? (
                    <Badge color="purple">Platform</Badge>
                  ) : (
                    <span className="font-semibold text-ui-fg-base">{user.tenant_name || user.tenant_id}</span>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {user.is_platform ? "-" : (
                    <Badge color="blue">{user.tenant_role}</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>{new Date(user.created_at).toLocaleDateString()}</Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table>
    </Container>
  )
}

export default PlatformUsersPage

