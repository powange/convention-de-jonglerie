import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { z } from 'zod'

const checkEmailSchema = z.object({
  email: z.string().email(),
  excludeUserIds: z.array(z.number()).optional().default([]),
})

export default wrapApiHandler(
  async (event) => {
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
    return { exists: !!user }
  },
  { operationName: 'CheckEmail' }
)
