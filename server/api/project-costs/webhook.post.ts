import type Stripe from 'stripe'

import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { getStripeClientWithWebhookSecret } from '#server/utils/stripe'

export default wrapApiHandler(
  async (event) => {
    const rawBody = await readRawBody(event)
    if (!rawBody) {
      throw createError({ status: 400, message: 'Corps de la requête manquant' })
    }

    const signature = getHeader(event, 'stripe-signature')
    if (!signature) {
      throw createError({ status: 400, message: 'Signature Stripe manquante' })
    }

    const { stripe, webhookSecret } = await getStripeClientWithWebhookSecret()

    let stripeEvent: Stripe.Event
    try {
      stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch {
      throw createError({ status: 400, message: 'Signature Stripe invalide' })
    }

    // Paiement checkout terminé → enregistrer le don
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session
      const quantity = parseInt(session.metadata?.quantity || '0')

      if (quantity > 0) {
        // Tenter de récupérer les frais Stripe (peut ne pas être disponible immédiatement)
        let feeCents: number | null = null
        let netCents: number | null = null

        if (session.payment_intent) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
              session.payment_intent as string,
              { expand: ['latest_charge.balance_transaction'] }
            )
            const charge = paymentIntent.latest_charge as Stripe.Charge
            if (charge?.balance_transaction && typeof charge.balance_transaction === 'object') {
              const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction
              feeCents = balanceTx.fee
              netCents = balanceTx.net
            }
          } catch {
            // Les frais seront récupérés via l'événement charge.succeeded
          }
        }

        await prisma.coffeeDonation.upsert({
          where: { stripeSessionId: session.id },
          create: {
            stripeSessionId: session.id,
            quantity,
            totalCents: session.amount_total || quantity * 100,
            feeCents,
            netCents,
            email: session.customer_details?.email || null,
            customerName: session.customer_details?.name || null,
          },
          update: {
            // Mettre à jour les frais s'ils étaient null
            ...(feeCents !== null && { feeCents }),
            ...(netCents !== null && { netCents }),
          },
        })

        // Notifier les administrateurs
        await safeNotify(
          () =>
            NotificationHelpers.coffeeDonationReceived(
              quantity,
              session.amount_total || quantity * 100,
              session.customer_details?.name || null
            ),
          'notification don café reçu'
        )
      }
    }

    // Charge réussie → mettre à jour les frais (même si déjà présents, pour gérer la race condition)
    if (stripeEvent.type === 'charge.succeeded') {
      const charge = stripeEvent.data.object as Stripe.Charge

      if (charge.payment_intent && charge.balance_transaction) {
        try {
          const balanceTx =
            typeof charge.balance_transaction === 'object'
              ? (charge.balance_transaction as Stripe.BalanceTransaction)
              : await stripe.balanceTransactions.retrieve(charge.balance_transaction)

          // Retrouver la session checkout associée
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: charge.payment_intent as string,
            limit: 1,
          })

          if (sessions.data.length > 0) {
            const sessionId = sessions.data[0].id

            // Tenter la mise à jour — si le don n'existe pas encore (race condition),
            // réessayer après un court délai pour laisser le temps au checkout.session.completed
            const updated = await prisma.coffeeDonation.updateMany({
              where: { stripeSessionId: sessionId },
              data: {
                feeCents: balanceTx.fee,
                netCents: balanceTx.net,
              },
            })

            if (updated.count === 0) {
              await new Promise((resolve) => setTimeout(resolve, 3000))
              await prisma.coffeeDonation.updateMany({
                where: { stripeSessionId: sessionId },
                data: {
                  feeCents: balanceTx.fee,
                  netCents: balanceTx.net,
                },
              })
            }
          }
        } catch {
          // Pas critique
        }
      }
    }

    return { received: true }
  },
  { operationName: 'POST project-costs webhook' }
)
