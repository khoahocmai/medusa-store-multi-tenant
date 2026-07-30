import TenantModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const TENANT_MODULE = "tenant"

export default Module(TENANT_MODULE, {
  service: TenantModuleService,
})
