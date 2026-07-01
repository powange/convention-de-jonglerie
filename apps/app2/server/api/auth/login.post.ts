import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { setUserSession } from '#imports'

import prisma from '../../utils/prisma'

const loginSchema = z.object({
  email: z.string().min(1, 'Email requis'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = loginSchema.parse(body)

  const cleanEmail = email.trim().toLowerCase()

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } })
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides' })
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides' })
  }

  await setUserSession(event, {
    user: { id: user.id, email: user.email, name: user.name },
    loggedInAt: new Date().toISOString(),
  })

  return { user: { id: user.id, email: user.email, name: user.name } }
})
