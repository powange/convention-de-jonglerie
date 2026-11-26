/**
 * Câblage des ports du layer bénévoles pour FLOWVENT (contrat d'hôte, cf. docs/flowvent-benevoles.md
 * et layers/volunteers/server/ports/types.ts).
 *
 * Le layer importe `#server/volunteers/ports/registry` : chaque app fournit le sien. Repas,
 * billetterie et artistes viennent du câblage partagé du layer repas ; ce qui reste propre à
 * Flowvent est ici. Ses méthodes sans objet (messagerie) sont NEUTRES, jamais en échec : le layer
 * les appelle au fil d'opérations qui doivent aboutir.
 */
import type { VolunteerPorts } from '#volunteers/server/ports/types'

import { portsBenevolesDesRepas } from '#meals/server/ports/liaisons-benevoles'
import { requireAuth } from '#server/utils/auth-utils'
import { sendEmail } from '#server/utils/emailService'
import { NotificationService } from '#server/utils/notification-service'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import { verifierAjout } from '#server/utils/quotas'

/** Fuseau par défaut : celui de Flowvent, tant qu'un événement n'en déclare pas. */
const FUSEAU_PAR_DEFAUT = 'Europe/Paris'

async function exigerGestion(event: any, eventId: number) {
  const user = requireAuth(event)
  const existe = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } })
  if (!existe) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!(await canManageEditionVolunteers(eventId, user.id, event))) {
    throw createError({ status: 403, message: 'Accès réservé aux organisateurs de cet événement' })
  }
  return user
}

const ports: VolunteerPorts = {
  // Le plafond de bénévoles acceptés par événement de la formule du propriétaire (shared/formules.ts).
  quotas: {
    verifierAjoutBenevole: (eventId, userId) => verifierAjout(eventId, 'benevoles', { userId }),
  },
  notifications: {
    async notify(input) {
      await NotificationService.create(input as Parameters<typeof NotificationService.create>[0])
    },
  },
  email: {
    send: (input) => sendEmail(input),
  },
  // Pas de messagerie dans Flowvent : les conversations d'équipe n'existent pas.
  messenger: {
    async ensureTeamConversation() {},
    async removeFromTeamConversations() {},
    async removeFromOrganizersConversation() {},
  },
  organizers: {
    // Gérer et consulter : mêmes personnes (propriétaire, organisateurs, administrateur).
    requireManagementAccess: exigerGestion,
    requireReadAccess: exigerGestion,
    canManage: (eventId, userId, event) => canManageEditionVolunteers(eventId, userId, event),
  },
  eventScope: {
    // Pas d'« éditions sœurs » : chaque événement est seul.
    async getRelatedEventIds(eventId) {
      return [eventId]
    },
    async getEventDisplayData(eventIds) {
      const evenements = await prisma.event.findMany({
        where: { id: { in: eventIds } },
        select: { id: true, location: true },
      })
      return Object.fromEntries(evenements.map((e) => [e.id, { location: e.location }]))
    },
    async getTimezone(eventId) {
      const e = await prisma.event.findUnique({
        where: { id: eventId },
        select: { timezone: true },
      })
      return e ? (e.timezone ?? FUSEAU_PAR_DEFAUT) : null
    },
    async getDisplayName(eventId) {
      const e = await prisma.event.findUnique({ where: { id: eventId }, select: { name: true } })
      return e?.name ?? null
    },
  },
  // Repas, et ce que les repas lisent de la billetterie et des artistes : le câblage d'app1,
  // partagé par le layer repas (mêmes modèles dans les deux apps).
  ...portsBenevolesDesRepas(),
}

export function useVolunteerPorts(): VolunteerPorts {
  return ports
}
