import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { handle } = req.params

  const { data: tenants } = await query.graph({
    entity: "tenant",
    fields: [
      "id",
      "name",
      "handle",
      "status",
      "metadata"
    ],
    filters: {
      handle,
      status: "active"
    }
  })

  if (!tenants || tenants.length === 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Tenant with handle ${handle} was not found`
    )
  }

  res.json({ tenant: tenants[0] })
}
