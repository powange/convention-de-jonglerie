import Stripe from 'stripe'

import { decrypt } from '#server/utils/encryption'

/**
 * Charge la config Stripe active depuis la base (une seule requête)
 */
async function getActiveStripeConfig() {
  const config = await prisma.stripeConfig.findFirst({
    where: { isActive: true },
  })
  if (!config) {
    throw createError({ status: 503, message: 'Stripe non configuré' })
  }
  return config
}

/**
 * Instancie un client Stripe à partir de la configuration chiffrée en base
 */
export async function getStripeClient(): Promise<Stripe> {
  const config = await getActiveStripeConfig()
  const secretKey = decrypt(config.secretKey)
  return new Stripe(secretKey)
}

/**
 * Récupère le client Stripe et le secret webhook en une seule requête DB
 */
export async function getStripeClientWithWebhookSecret(): Promise<{
  stripe: Stripe
  webhookSecret: string
}> {
  const config = await getActiveStripeConfig()
  return {
    stripe: new Stripe(decrypt(config.secretKey)),
    webhookSecret: decrypt(config.webhookSecret),
  }
}
