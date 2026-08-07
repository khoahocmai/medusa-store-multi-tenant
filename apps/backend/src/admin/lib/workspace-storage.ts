export const WORKSPACE_STORAGE_KEY = "medusa:active_workspace"

export type ActiveWorkspace = {
  actor_id: string
  tenant_id: string
  tenant_name: string
}

export const getActiveWorkspace = (): ActiveWorkspace | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(WORKSPACE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export const setActiveWorkspace = (workspace: ActiveWorkspace) => {
  if (typeof window === "undefined") return
  sessionStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
}

export const clearActiveWorkspace = () => {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(WORKSPACE_STORAGE_KEY)
}
