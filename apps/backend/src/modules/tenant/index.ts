import TenantModuleService from "./service"
import { Module } from "@medusajs/framework/utils"
import verifyRuntimeRoleLoader from "./loader"

export const TENANT_MODULE = "tenant"

export default Module(TENANT_MODULE, {
  service: TenantModuleService,
  loaders: [verifyRuntimeRoleLoader]
})
