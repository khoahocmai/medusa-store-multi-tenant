import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as fs from "fs"
import * as path from "path"

export default async function quarantineLegacyProducts({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  
  const confirm = process.env.CONFIRM === "true"

  try {
    await knex.transaction(async (trx: any) => {
      // Find all legacy products
      const products = await trx("product").whereNull("tenant_id")
      
      if (products.length === 0) {
        logger.info("No legacy products with tenant_id IS NULL found.")
        return
      }

      logger.info(`Found ${products.length} legacy products.`)

      // Find related variants
      const productIds = products.map((p: any) => p.id)
      const variants = await trx("product_variant").whereIn("product_id", productIds)
      const variantIds = variants.map((v: any) => v.id)

      // Find related orders through line_items
      let lineItems = []
      if (variantIds.length > 0) {
        lineItems = await trx("order_line_item").whereIn("variant_id", variantIds)
      }

      if (lineItems.length > 0) {
        logger.warn(`Found ${lineItems.length} order line items related to legacy products!`)
      }

      const exportData = {
        timestamp: new Date().toISOString(),
        products,
        variants,
        lineItems
      }

      const exportPath = path.resolve(process.cwd(), "quarantined-legacy-products.json")
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2))
      logger.info(`Exported full JSON dump to ${exportPath}`)

      if (!confirm) {
        logger.warn("Dry-run only. Run with --confirm to actually delete them.")
        // Rollback just in case, though we didn't write anything
        throw new Error("Missing --confirm flag")
      }

      // Delete data. Must respect foreign keys (cascading or manual)
      // Since it's a seed, we will delete product_variant, etc.
      
      logger.info("Deleting product_variant...")
      await trx("product_variant").whereIn("product_id", productIds).del()
      
      logger.info("Deleting product...")
      const deletedCount = await trx("product").whereNull("tenant_id").del()

      logger.info(`Successfully deleted ${deletedCount} legacy products and their variants.`)
    })
  } catch (error: any) {
    if (error.message === "Missing --confirm flag") {
      logger.info("Transaction aborted (dry run).")
      return
    }
    logger.error("Error quarantining legacy products", error)
    throw error
  }
}
