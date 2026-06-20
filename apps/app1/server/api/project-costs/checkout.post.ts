import { z } from 'zod'

import { checkoutRateLimiter } from '#server/utils/api-rate-limiter'
import { getStripeClient } from '#server/utils/stripe'

const bodySchema = z.object({
  quantity: z.number().int().min(1).max(50),
})

export default wrapApiHandler(
  async (event) => {
    await checkoutRateLimiter(event)
    const body = bodySchema.parse(await readBody(event))

    const stripe = await getStripeClient()
    const siteUrl = useRuntimeConfig().public.siteUrl || 'https://juggling-convention.com'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: useRuntimeConfig().stripeCoffeeProductName || 'Un café pour le projet',
              description: `${body.quantity} café(s)`,
            },
            unit_amount: 100, // 1€ en centimes
          },
          quantity: body.quantity,
        },
      ],
      mode: 'payment',
      success_url: `${siteUrl}/project-costs/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/project-costs/cancel`,
      metadata: {
        quantity: body.quantity.toString(),
      },
    })

    return { url: session.url }
  },
  { operationName: 'POST project-costs checkout' }
)
