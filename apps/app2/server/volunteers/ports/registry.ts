/**
 * Câblage des ports du layer bénévoles pour FLOWVENT (contrat d'hôte, cf. docs/flowvent-benevoles.md
 * et layers/volunteers/server/ports/types.ts).
 *
 * Le layer importe `#server/volunteers/ports/registry` : chaque app fournit le sien. Celui d'app1
 * branche les conventions, les éditions, la billetterie, les repas, les artistes et la messagerie ;
 * Flowvent n'a aucun de ces modules. Ses méthodes sans objet sont NEUTRES (listes vides, no-op),
 * jamais en échec : le layer en appelle certaines au fil d'opérations qui doivent aboutir — accepter
 * une candidature crée les sélections de repas, par exemple.
 */
import type { VolunteerPorts } from '#volunteers/server/ports/types'

import { requireAuth } from '#server/utils/auth-utils'
import { sendEmail } from '#server/utils/emailService'
import { NotificationService } from '#server/utils/notification-service'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'

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
  // Pas de billetterie.
  ticketing: {
    async getMealTicketParticipants() {
      return {}
    },
    async getHandoutItems() {
      return {}
    },
  },
  // Pas d'artistes ni de spectacles.
  artists: {
    async addEligibleMealSelections() {},
    async removeMealSelections() {},
    async getMealArtistParticipants() {
      return {}
    },
    async getShowSchedule() {
      return []
    },
  },
  // Pas de module repas : la liste des candidatures n'inclut pas les repas.
  meals: {
    disponible: false,
    async getEditionMealSchedule() {
      return []
    },
    async updateEditionMealsConfig() {
      return { meals: [], toggles: [] }
    },
    async getVolunteerSelfMeals() {
      return []
    },
    async setVolunteerSelfMealAcceptances() {
      return []
    },
    async getVolunteerMeals() {
      return []
    },
    async setVolunteerMeals() {
      return []
    },
    async getCateringMealsForDate() {
      return []
    },
    async createVolunteerMealSelections() {},
    async deleteVolunteerMealSelections() {},
  },
}

export function useVolunteerPorts(): VolunteerPorts {
  return ports
}
