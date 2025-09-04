import { requireUserSession } from '#imports'

import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification via la session scellée
  const { user } = await requireUserSession(event)
  const userId = user.id

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Token invalide',
    })
  }

  // Vérifier que l'utilisateur est un super administrateur
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  })

  if (!currentUser?.isGlobalAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Accès refusé - Droits super administrateur requis',
    })
  }

  const logId = getRouterParam(event, 'id')
  if (!logId) {
    throw createError({ statusCode: 400, statusMessage: 'ID du log requis' })
  }

  // Récupération du log avec tous les détails
  const errorLog = await prisma.apiErrorLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      message: true,
      statusCode: true,
      stack: true,
      errorType: true,
      method: true,
      url: true,
      path: true,
      userAgent: true,
      ip: true,
      headers: true,
      body: true,
      queryParams: true,
      resolved: true,
      resolvedBy: true,
      resolvedAt: true,
      adminNotes: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          pseudo: true,
          email: true,
          nom: true,
          prenom: true,
          isGlobalAdmin: true,
        },
      },
    },
  })

  if (!errorLog) {
    throw createError({ statusCode: 404, statusMessage: "Log d'erreur introuvable" })
  }

  return errorLog
})
