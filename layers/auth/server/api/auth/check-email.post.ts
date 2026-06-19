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
      select: { authProvider: true, isEmailVerified: true },
    })

    // canActivate : l'email correspond à un compte MANUAL non vérifié (créé par
    // un organisateur). Le formulaire de login peut alors basculer vers
    // l'inscription pour permettre le claim via /register.
    const canActivate = !!user && user.authProvider === 'MANUAL' && !user.isEmailVerified

    return createSuccessResponse({ exists: !!user, canActivate })
  },
  { operationName: 'CheckEmail' }
)
