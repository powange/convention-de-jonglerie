// Implémentation par défaut des ports du module bénévole (câblage app jonglerie).
// Délègue aux services concrets (cœur). À l'extraction en layer (étape 2), ce fichier
// reste côté app ; le layer ne garde que les interfaces (types.ts) et le registre.
import type { NotifyInput, VolunteerPorts } from './types'
import type { NotificationType } from '@prisma/client'

import { sendEmail } from '#server/utils/emailService'
import {
  ensureVolunteerConversations,
  removeVolunteerFromTeamConversations,
} from '#server/utils/messenger-helpers'
import {
  NotificationService,
  safeNotify,
  type CreateNotificationData,
} from '#server/utils/notification-service'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import {
  requireVolunteerManagementAccess,
  requireVolunteerReadAccess,
} from '#server/utils/permissions/volunteer-permissions'

function toCreateData(input: NotifyInput): CreateNotificationData {
  return { ...input, type: input.type as NotificationType }
}

export function createDefaultVolunteerPorts(): VolunteerPorts {
  return {
    notifications: {
      async notify(input) {
        await safeNotify(() => NotificationService.create(toCreateData(input)), 'volunteer-notify')
      },
    },
    email: {
      send: (input) => sendEmail(input),
    },
    messenger: {
      ensureTeamConversation: ({ eventId, teamId, userId, tx }) =>
        ensureVolunteerConversations(eventId, teamId, userId, tx),
      removeFromTeamConversations: ({ eventId, teamId, userId, tx }) =>
        removeVolunteerFromTeamConversations(eventId, teamId, userId, tx),
    },
    organizers: {
      requireManagementAccess: (event, eventId) => requireVolunteerManagementAccess(event, eventId),
      requireReadAccess: (event, eventId) => requireVolunteerReadAccess(event, eventId),
      canManage: (eventId, userId, event) => canManageEditionVolunteers(eventId, userId, event),
    },
    eventScope: {
      // Jonglerie : les événements « liés » sont les éditions de la même convention.
      async getRelatedEventIds(eventId) {
        const edition = await prisma.edition.findUnique({
          where: { id: eventId },
          select: { conventionId: true },
        })
        if (!edition) return [eventId]
        const editions = await prisma.edition.findMany({
          where: { conventionId: edition.conventionId },
          select: { eventId: true },
        })
        return editions.map((e) => e.eventId)
      },
      // Jonglerie : données d'affichage = champs Edition + logo/nom de la convention.
      async getEventDisplayData(eventIds) {
        if (eventIds.length === 0) return {}
        const editions = await prisma.edition.findMany({
          where: { eventId: { in: eventIds } },
          select: {
            eventId: true,
            city: true,
            country: true,
            imageUrl: true,
            convention: { select: { id: true, name: true, logo: true } },
          },
        })
        const map: Record<number, Record<string, unknown>> = {}
        for (const ed of editions) {
          map[ed.eventId] = {
            city: ed.city,
            country: ed.country,
            imageUrl: ed.imageUrl,
            convention: ed.convention,
          }
        }
        return map
      },
    },
  }
}
