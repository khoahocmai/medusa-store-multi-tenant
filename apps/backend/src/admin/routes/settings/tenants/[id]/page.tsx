import { ArrowUturnLeft } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"

const fetchTenant = async (id: string) => {
  const res = await fetch(`/admin/platform/tenants/${id}`)
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = "/app/login"
      return
    }
    if (res.status === 403) throw new Error("403_FORBIDDEN")
    throw new Error("Failed to fetch tenant")
  }
  return res.json()
}

const fetchTenantMembers = async (id: string) => {
  const res = await fetch(`/admin/platform/users?tenant_id=${id}`)
  if (!res.ok) {
    throw new Error("Failed to fetch tenant members")
  }
  return res.json()
}

const createTenantUser = async (data: any) => {
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

const TenantDetailPage = () => {
  const { id } = useParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role: "member"
  })

  const queryClient = useQueryClient()

  const { data: tenantData, isLoading: tenantLoading, error: tenantError } = useQuery({
    queryKey: ["platform_tenant", id],
    queryFn: () => fetchTenant(id as string),
    retry: false,
    enabled: !!id
  })

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["platform_tenant_members", id],
    queryFn: () => fetchTenantMembers(id as string),
    enabled: !!id && !tenantError
  })

  const mutation = useMutation({
    mutationFn: createTenantUser,
    onSuccess: () => {
      toast.success("User created successfully")
      queryClient.invalidateQueries({ queryKey: ["platform_tenant_members", id] })
      setDrawerOpen(false)
      setFormData({ email: "", first_name: "", last_name: "", role: "member" })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ ...formData, tenant_id: id })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  // ROUTE GUARD: Render Access Restricted UI if unauthorized or error
  if (tenantError) {
    return (
      <Container className="p-8 flex flex-col items-center justify-center gap-4">
        <Heading level="h1">Access Restricted</Heading>
        <Text>You do not have platform admin privileges to view this page.</Text>
      </Container>
    )
  }

  if (tenantLoading) {
    return (
      <Container className="p-8 flex items-center justify-center min-h-[400px]">
        <Heading level="h2" className="text-ui-fg-subtle">Loading...</Heading>
      </Container>
    )
  }

  const tenant = tenantData?.tenant

  if (!tenant) {
    return (
      <Container className="p-8">
        <Heading level="h1">Tenant not found</Heading>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Link to="/settings/tenants" className="flex items-center gap-x-2 text-ui-fg-subtle hover:text-ui-fg-base mb-2 w-fit">
        <ArrowUturnLeft className="w-4 h-4" />
        <Text size="small" weight="plus">Back to Tenants</Text>
      </Link>

      <Container className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Heading level="h1">{tenant.name}</Heading>
            <Text className="text-ui-fg-subtle mt-1">Handle: {tenant.handle}</Text>
          </div>
          <Badge color={tenant.status === 'active' ? 'green' : 'grey'} size="large">
            {tenant.status}
          </Badge>
        </div>
      </Container>

      <Container className="p-8">
        <div className="flex justify-between items-center mb-6">
          <Heading level="h2">Members</Heading>
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
              <Table.HeaderCell>Role</Table.HeaderCell>
              <Table.HeaderCell>Created At</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {membersLoading ? (
              <Table.Row>
                <Table.Cell colSpan={4} className="text-center py-4">Loading...</Table.Cell>
              </Table.Row>
            ) : membersData?.users?.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={4} className="text-center py-4">No members found</Table.Cell>
              </Table.Row>
            ) : (
              membersData?.users?.map((user: any) => (
                <Table.Row key={user.id}>
                  <Table.Cell className="font-medium">{user.email}</Table.Cell>
                  <Table.Cell>{[user.first_name, user.last_name].filter(Boolean).join(" ") || "-"}</Table.Cell>
                  <Table.Cell>
                    <Badge color="blue">{user.tenant_role}</Badge>
                  </Table.Cell>
                  <Table.Cell>{new Date(user.created_at).toLocaleDateString()}</Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}

export default TenantDetailPage
