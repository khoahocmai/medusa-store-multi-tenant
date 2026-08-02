import { getHeaders, tenant1, tenant1AdminId } from "./setup"

async function testProduct() {
  const { api } = require("../../setup")
  const spRes = await api.post("/admin/shipping-profiles", { name: "Default", type: "default" }, {
    headers: getHeaders(tenant1AdminId, { "x-tenant-id": tenant1.id })
  })
  const spId = spRes.data.shipping_profile.id

  try {
    const prodPayload = { 
      title: "T1 Product", 
      options: [{ title: "Size", values: ["One Size"] }],
      shipping_profile_id: spId,
      sales_channels: []
    }
    const createRes = await api.post("/admin/products", prodPayload, {
      headers: getHeaders(tenant1AdminId, { "x-tenant-id": tenant1.id })
    })
    console.log("Status:", createRes.status)
    if (createRes.status !== 200) {
      console.log(createRes.data)
    }
  } catch (e: any) {
    console.error(e?.response?.data || e.message)
  }
}
