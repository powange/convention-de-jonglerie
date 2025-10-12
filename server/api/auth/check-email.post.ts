import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const schema = z.object({ email: z.string().email() })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }

  const { email } = parse.data
  const { prisma } = await import('@@/server/utils/prisma')

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  return { exists: !!user }
})
