import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { checkEmailRateLimiter } from '#server/utils/rate-limiter'

const checkEmailSchema = z.object({
  email: z.string().email(),
  excludeUserIds: z.array(z.number()).optional().default([]),
})

export default wrapApiHandler(
  async (event) => {
    // Rate limiting : protection enumeration d'emails
    await checkEmailRateLimiter(event)

    const body = await readBody(event).catch(() => ({}))
    const parse = checkEmailSchema.safeParse(body)
    if (!parse.success) {
      throw createError({ status: 400, message: 'Invalid email' })
    }

    const { email, excludeUserIds } = parse.data

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        id: {
          notIn: excludeUserIds,
        },
      },
    })
    return createSuccessResponse({ exists: !!user })
  },
  { operationName: 'CheckEmail' }
)
