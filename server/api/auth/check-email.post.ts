import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const schema = z.object({
    email: z.string().email(),
    excludeUserIds: z.array(z.number()).optional().default([]),
  })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }

  const { email, excludeUserIds } = parse.data
  const { prisma } = await import('@@/server/utils/prisma')

  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      id: {
        notIn: excludeUserIds,
      },
    },
  })
  return { exists: !!user }
})
