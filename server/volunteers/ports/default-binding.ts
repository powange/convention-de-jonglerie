// Implémentation par défaut des ports du module bénévole (câblage app jonglerie).
// Délègue aux services concrets (cœur). À l'extraction en layer (étape 2), ce fichier
// reste côté app ; le layer ne garde que les interfaces (types.ts) et le registre.
import type { NotificationType } from '@prisma/client'
import {
  NotificationService,
  safeNotify,
  type CreateNotificationData,
} from '#server/utils/notification-service'
import { sendEmail } from '#server/utils/emailService'
import {
  ensureVolunteerConversations,
  removeVolunteerFromTeamConversations,
} from '#server/utils/messenger-helpers'
import {
  requireVolunteerManagementAccess,
  requireVolunteerReadAccess,
} from '#server/utils/permissions/volunteer-permissions'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import type { NotifyInput, VolunteerPorts } from './types'

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
      requireManagementAccess: (event, eventId) =>
        requireVolunteerManagementAccess(event, eventId),
      requireReadAccess: (event, eventId) => requireVolunteerReadAccess(event, eventId),
      canManage: (eventId, userId, event) => canManageEditionVolunteers(eventId, userId, event),
    },
  }
}
