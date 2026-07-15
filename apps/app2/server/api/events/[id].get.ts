import { requireUserSession } from '#imports'

import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  }

  const found = await prisma.event.findUnique({ where: { id } })
  if (!found || found.ownerId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable' })
  }

  return { event: found }
})
