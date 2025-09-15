import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../../utils/collaborator-management'
import { NotificationService } from '../../../../../utils/notification-service'
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
        },
      },
      edition: {
        select: {
          name: true,
          convention: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })
  if (!application || application.editionId !== editionId)
    throw createError({ statusCode: 404, statusMessage: 'Candidature introuvable' })

  // Si on modifie juste les préférences d'équipes (sans changer le statut)
  if (parsed.teamPreferences !== undefined && parsed.status === undefined) {
    // Comparer les données avant/après pour détecter les modifications
    const changes: string[] = []

    // Comparer les préférences d'équipes
    const oldTeamPrefs = (application.teamPreferences as string[]) || []
    const newTeamPrefs = parsed.teamPreferences || []

    if (JSON.stringify(oldTeamPrefs.sort()) !== JSON.stringify(newTeamPrefs.sort())) {
      if (oldTeamPrefs.length === 0 && newTeamPrefs.length > 0) {
        changes.push(`Équipes préférées ajoutées : ${newTeamPrefs.join(', ')}`)
      } else if (oldTeamPrefs.length > 0 && newTeamPrefs.length === 0) {
        changes.push(`Équipes préférées supprimées : ${oldTeamPrefs.join(', ')}`)
      } else {
        const added = newTeamPrefs.filter((team) => !oldTeamPrefs.includes(team))
        const removed = oldTeamPrefs.filter((team) => !newTeamPrefs.includes(team))

        if (added.length > 0) {
          changes.push(`Équipes ajoutées : ${added.join(', ')}`)
        }
        if (removed.length > 0) {
          changes.push(`Équipes supprimées : ${removed.join(', ')}`)
        }
      }
    }

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
          },
        },
      },
    })

    // Envoyer une notification au bénévole s'il y a des modifications ou une note
    if (changes.length > 0 || (parsed.modificationNote && parsed.modificationNote.trim())) {
      try {
        const displayName = application.edition.name || application.edition.convention.name
        let message = `Votre candidature pour "${displayName}" a été modifiée par les organisateurs`

        if (changes.length > 0) {
          message += `.\n\nModifications :\n• ${changes.join('\n• ')}`
        }

        if (parsed.modificationNote.trim()) {
          message += `\n\nNote : ${parsed.modificationNote.trim()}`
        }

        await NotificationService.create({
          userId: application.user.id,
          type: 'INFO',
          title: `Modification de votre candidature bénévole`,
          message,
          category: 'volunteer',
          entityType: 'Edition',
          entityId: editionId.toString(),
          actionUrl: `/my-volunteer-applications`,
          actionText: 'Voir ma candidature',
        })
      } catch (error) {
        console.error("Erreur lors de l'envoi de la notification:", error)
        // Ne pas faire échouer la mise à jour si la notification échoue
      }
    }

    return { success: true, application: updated }
  }

  // Sinon, gestion classique du changement de statut
  const target = parsed.status
  if (!target) throw createError({ statusCode: 400, statusMessage: 'Statut requis' })

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
