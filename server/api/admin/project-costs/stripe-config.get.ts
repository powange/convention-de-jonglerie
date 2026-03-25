import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { decrypt } from '#server/utils/encryption'

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const config = await prisma.stripeConfig.findFirst()

    if (!config) {
      return createSuccessResponse({ config: null })
    }

    // Masquer les clés : afficher uniquement les 8 derniers caractères
    const maskKey = (encrypted: string): string => {
      try {
        const decrypted = decrypt(encrypted)
        return '••••' + decrypted.slice(-8)
      } catch {
        return '••••(erreur)'
      }
    }

    return createSuccessResponse({
      config: {
        id: config.id,
        publicKey: maskKey(config.publicKey),
        secretKey: maskKey(config.secretKey),
        webhookSecret: maskKey(config.webhookSecret),
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    })
  },
  { operationName: 'GET admin stripe-config' }
)
