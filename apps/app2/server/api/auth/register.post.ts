import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { setUserSession } from '#imports'

import prisma from '../../utils/prisma'

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  name: z.string().trim().min(1).max(120).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, name } = registerSchema.parse(body)

  const cleanEmail = email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Un compte existe déjà avec cet email' })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      password: hashedPassword,
      name: name ?? null,
    },
  })

  await setUserSession(event, {
    user: { id: user.id, email: user.email, name: user.name },
    loggedInAt: new Date().toISOString(),
  })

  return { user: { id: user.id, email: user.email, name: user.name } }
})
