import { defineRouteConfig } from "@medusajs/admin-sdk"
import { UsersSolid, Trash } from "@medusajs/icons"
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
  Badge,
  IconButton
} from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { RestrictedAccessView } from "../../components/restricted-access-view"

export const config = defineRouteConfig({
  label: "Store Team",
  icon: UsersSolid,
})

const fetchStoreUsers = async () => {
  const res = await fetch("/admin/store-users")
  if (!res.ok) {
    if (res.status === 403) throw new Error("403_FORBIDDEN")
    throw new Error("Failed to fetch store users")
  }
  return res.json()
}

const createStoreUser = async (data: any) => {
  const res = await fetch("/admin/store-users", {
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

const removeStoreUser = async (userId: string) => {
  const res = await fetch(`/admin/users/${userId}`, {
    method: "DELETE"
  })
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.message || "Failed to remove user")
  }
  return res.json()
}

const StoreTeamPage = () => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    role: "member"
  })
  
  const queryClient = useQueryClient()

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["store_users"],
    queryFn: fetchStoreUsers,
    retry: false
  })

  const createMutation = useMutation({
    mutationFn: createStoreUser,
    onSuccess: () => {
      toast.success("User created successfully")
      queryClient.invalidateQueries({ queryKey: ["store_users"] })
      setDrawerOpen(false)
      setFormData({ email: "", first_name: "", last_name: "", password: "", role: "member" })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const removeMutation = useMutation({
    mutationFn: removeStoreUser,
    onSuccess: () => {
      toast.success("User removed successfully")
      queryClient.invalidateQueries({ queryKey: ["store_users"] })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const handleRemove = (userId: string) => {
    if (window.confirm("Are you sure you want to remove this user from your store?")) {
      removeMutation.mutate(userId)
    }
  }

  if (usersLoading) {
    return (
      <Container className="p-8 flex items-center justify-center min-h-[400px]">
        <Heading level="h2" className="text-ui-fg-subtle">Loading store team...</Heading>
      </Container>
    )
  }

  if (usersError && usersError.message === "403_FORBIDDEN") {
    return (
      <Container className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
        <ExclamationCircleSolid className="text-ui-fg-error w-12 h-12 mb-4" />
        <Heading level="h1" className="mb-2">Access Denied</Heading>
        <Text className="text-ui-fg-subtle">
          You do not have permission to access the store team page.
        </Text>
      </Container>
    )
  }

  // EARLY RETURN: Prevent Platform Admins from using Store Team page
  const isPlatformAdmin = usersData?.is_platform_admin === true
  if (isPlatformAdmin) {
    return (
      <RestrictedAccessView 
        message="You are currently logged in as a Platform Admin. Please use the Platform Users menu to manage accounts."
      />
    )
  }

  return (
    <Container className="p-8">
      <div className="flex justify-between items-center mb-6">
        <Heading level="h1">Store Team</Heading>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Drawer.Trigger asChild>
            <Button variant="secondary">Create User</Button>
          </Drawer.Trigger>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>Create New User</Drawer.Title>
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
                  <Label htmlFor="password">Password <span className="text-ui-fg-error">*</span></Label>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password"
                    required 
                    value={formData.password}
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
              <Button type="submit" form="create-user-form" isLoading={createMutation.isPending}>
                Create User
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      </div>

      {usersError ? (
        <div className="text-ui-fg-error">
          Failed to load users.
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Role</Table.HeaderCell>
              <Table.HeaderCell>Created At</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {usersData?.users?.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5} className="text-center py-4">No users found</Table.Cell>
              </Table.Row>
            ) : (
              usersData?.users?.map((user: any) => (
                <Table.Row key={user.id}>
                  <Table.Cell className="font-medium">{user.email}</Table.Cell>
                  <Table.Cell>{[user.first_name, user.last_name].filter(Boolean).join(" ") || "-"}</Table.Cell>
                  <Table.Cell>
                    <Badge color="blue">{user.tenant_role}</Badge>
                  </Table.Cell>
                  <Table.Cell>{new Date(user.created_at).toLocaleDateString()}</Table.Cell>
                  <Table.Cell className="text-right">
                    <IconButton 
                      variant="transparent" 
                      onClick={() => handleRemove(user.id)}
                      title="Remove User"
                    >
                      <Trash className="text-ui-fg-subtle hover:text-ui-fg-error" />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export default StoreTeamPage
