import { Drawer, Input, Label, Button, Text, toast } from "@medusajs/ui"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"

const fetchUser = async (id: string) => {
  const res = await fetch(`/admin/users/${id}`)
  if (!res.ok) throw new Error("Failed to fetch user")
  return res.json()
}

const fetchCurrentUser = async () => {
  const res = await fetch(`/admin/users/me`)
  if (!res.ok) throw new Error("Failed to fetch current user")
  return res.json()
}

const updateUser = async ({ id, data }: { id: string, data: any }) => {
  const res = await fetch(`/admin/users/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.message || "Failed to update user")
  }
  return res.json()
}

const UserEditDrawer = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: ""
  })

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ["admin_user", id],
    queryFn: () => fetchUser(id as string),
    enabled: !!id
  })

  const { data: currentUserData, isLoading: currentUserLoading } = useQuery({
    queryKey: ["admin_current_user"],
    queryFn: fetchCurrentUser
  })

  useEffect(() => {
    if (userData?.user) {
      setFormData({
        first_name: userData.user.first_name || "",
        last_name: userData.user.last_name || ""
      })
    }
  }, [userData])

  const mutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      toast.success("User updated successfully")
      queryClient.invalidateQueries({ queryKey: ["admin_user", id] })
      queryClient.invalidateQueries({ queryKey: ["admin_users"] })
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.message || "You do not have permission to edit this user.")
    }
  })

  const handleClose = () => {
    // Navigate back to the previous page
    navigate("..", { relative: "path" }) // Goes back to /settings/users or /settings/users/[id]
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ id: id as string, data: formData })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const isLoading = userLoading || currentUserLoading
  const targetUser = userData?.user
  const currentUser = currentUserData?.user

  // Check if current user is allowed to edit
  // For safety, only allow if they are editing themselves. 
  // (Platform admins bypass backend restrictions anyway, but on frontend we enforce this UX).
  const isSelf = currentUser && targetUser && currentUser.id === targetUser.id
  const canEdit = isSelf

  return (
    <Drawer open={true} onOpenChange={(open) => !open && handleClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit User</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="p-4">
          {isLoading ? (
            <Text>Loading...</Text>
          ) : !targetUser ? (
            <Text>User not found</Text>
          ) : (
            <form id="edit-user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              {!canEdit && (
                <div className="bg-ui-bg-subtle border border-ui-border-base rounded-md p-3 mb-2">
                  <Text size="small" className="text-ui-fg-subtle">
                    You can only edit your own profile. Inputs are disabled.
                  </Text>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={handleChange}
                  disabled={!canEdit || mutation.isPending}
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
                  disabled={!canEdit || mutation.isPending}
                />
              </div>
            </form>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </Drawer.Close>
          <Button 
            type="submit" 
            form="edit-user-form" 
            isLoading={mutation.isPending}
            disabled={!canEdit || isLoading}
          >
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

export default UserEditDrawer
