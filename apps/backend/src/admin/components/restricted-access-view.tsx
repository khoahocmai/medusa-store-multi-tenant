import { Container, Heading, Text } from "@medusajs/ui"
import { ExclamationCircleSolid } from "@medusajs/icons"

export const RestrictedAccessView = ({ 
  message = "Ensure you have platform admin privileges." 
}: { 
  message?: string 
}) => {
  return (
    <Container className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
      <ExclamationCircleSolid className="text-ui-fg-error w-12 h-12 mb-4" />
      <Heading level="h1" className="mb-2">Access Restricted</Heading>
      <Text className="text-ui-fg-subtle">
        {message}
      </Text>
    </Container>
  )
}
