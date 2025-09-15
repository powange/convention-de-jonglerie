import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../../utils/collaborator-management'
import { prisma } from '../../../../../utils/prisma'

// Autorise aussi le retour à PENDING
const bodySchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'PENDING']).optional(),
  teams: z.array(z.string()).optional(), // IDs des équipes pour l'assignation
  note: z.string().optional(), // Note optionnelle pour l'acceptation
  teamPreferences: z.array(z.string()).optional(), // Modification des préférences d'équipes
  modificationNote: z.string().optional(), // Note de modification pour le bénévole
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')
  if (!editionId || !applicationId)
    throw createError({ statusCode: 400, statusMessage: 'Paramètres invalides' })
  const parsed = bodySchema.parse(await readBody(event))

  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      statusMessage: 'Droits insuffisants pour gérer les bénévoles',
    })

  const application = await prisma.editionVolunteerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      editionId: true,
      status: true,
      teamPreferences: true,
      user: {
        select: {
          id: true,
          pseudo: true,
          email: true,
        }
      }
    },
  })
  if (!application || application.editionId !== editionId)
    throw createError({ statusCode: 404, statusMessage: 'Candidature introuvable' })

  // Si on modifie juste les préférences d'équipes (sans changer le statut)
  if (parsed.teamPreferences !== undefined && parsed.status === undefined) {
    // Mise à jour des préférences d'équipes seulement
    const updated = await prisma.editionVolunteerApplication.update({
      where: { id: applicationId },
      data: {
        teamPreferences: parsed.teamPreferences,
      },
      select: {
        id: true,
        status: true,
        teamPreferences: true,
        user: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          }
        }
      },
    })

    // TODO: Envoyer une notification au bénévole
    if (parsed.modificationNote) {
      console.log('Notification à envoyer:', {
        userId: application.user.id,
        message: parsed.modificationNote,
        changes: {
          teamPreferences: {
            old: application.teamPreferences,
            new: parsed.teamPreferences
          }
        }
      })
    }

    return { success: true, application: updated }
  }

  // Sinon, gestion classique du changement de statut
  const target = parsed.status
  if (!target)
    throw createError({ statusCode: 400, statusMessage: 'Statut requis' })

  if (target === application.status)
    throw createError({ statusCode: 400, statusMessage: 'Statut identique' })

  // Règles de transition :
  // PENDING -> ACCEPTED/REJECTED (décision)
  // ACCEPTED/REJECTED -> PENDING (annulation)
  // Pas de passage direct ACCEPTED <-> REJECTED sans repasser par PENDING
  if (
    (application.status === 'PENDING' && (target === 'ACCEPTED' || target === 'REJECTED')) ||
    ((application.status === 'ACCEPTED' || application.status === 'REJECTED') &&
      target === 'PENDING')
  ) {
    // ok
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Transition interdite' })
  }

  // Mettre à jour le statut et la note d'acceptation
  const updateData: any = {
    status: target,
    decidedAt: target === 'ACCEPTED' || target === 'REJECTED' ? new Date() : null,
  }

  // Ajouter la note d'acceptation si fournie et si on accepte
  if (target === 'ACCEPTED' && parsed.note) {
    updateData.acceptanceNote = parsed.note
  }

  const updated = await prisma.editionVolunteerApplication.update({
    where: { id: applicationId },
    data: updateData,
    select: { id: true, status: true, decidedAt: true, acceptanceNote: true },
  })

  return { success: true, application: updated }
})
