// Implémentation par défaut des ports du module bénévole (câblage app jonglerie).
// Délègue aux services concrets (cœur). À l'extraction en layer (étape 2), ce fichier
// reste côté app ; le layer ne garde que les interfaces (types.ts) et le registre.
import type {
  ArtistMealParticipant,
  HandoutItemInfo,
  NotifyInput,
  TicketMealParticipant,
  VolunteerPorts,
} from './types'
import type { NotificationType, VolunteerMealType } from '@prisma/client'

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
import { isArtistEligibleForMeal } from '#server/utils/volunteer-meals'

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
        // Une seule requête : toutes les éditions dont la convention contient l'édition demandée
        // (= éditions sœurs, l'édition elle-même incluse).
        const editions = await prisma.edition.findMany({
          where: { convention: { editions: { some: { id: eventId } } } },
          select: { eventId: true },
        })
        if (editions.length === 0) return [eventId]
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
    ticketing: {
      // Jonglerie : participants billetterie d'un repas = via les tarifs (TicketingTierMeal) et les
      // options (TicketingOptionMeal) « avec repas », sur les commandes traitées. Dédup par repas.
      async getMealTicketParticipants(mealIds) {
        if (mealIds.length === 0) return {}
        const orderItemSelect = {
          id: true,
          lastName: true,
          firstName: true,
          email: true,
          order: { select: { payerLastName: true, payerFirstName: true, payerEmail: true } },
        }
        const meals = await prisma.volunteerMeal.findMany({
          where: { id: { in: mealIds } },
          select: {
            id: true,
            tiers: {
              select: {
                tier: {
                  select: {
                    orderItems: { where: { state: 'Processed' }, select: orderItemSelect },
                  },
                },
              },
            },
            options: {
              select: {
                option: {
                  select: {
                    orderItemSelections: {
                      where: { orderItem: { state: 'Processed' } },
                      select: { orderItem: { select: orderItemSelect } },
                    },
                  },
                },
              },
            },
          },
        })
        const toParticipant = (oi: {
          lastName: string | null
          firstName: string | null
          email: string | null
          order: {
            payerLastName: string | null
            payerFirstName: string | null
            payerEmail: string | null
          }
        }): TicketMealParticipant => ({
          nom: oi.lastName || oi.order.payerLastName || '',
          prenom: oi.firstName || oi.order.payerFirstName || '',
          email: oi.email || oi.order.payerEmail || '',
        })
        const result: Record<number, TicketMealParticipant[]> = {}
        for (const meal of meals) {
          const seen = new Set<number>()
          const participants: TicketMealParticipant[] = []
          for (const tierMeal of meal.tiers) {
            for (const oi of tierMeal.tier.orderItems) {
              if (seen.has(oi.id)) continue
              seen.add(oi.id)
              participants.push(toParticipant(oi))
            }
          }
          for (const optionMeal of meal.options) {
            for (const sel of optionMeal.option.orderItemSelections) {
              const oi = sel.orderItem
              if (!oi || seen.has(oi.id)) continue
              seen.add(oi.id)
              participants.push(toParticipant(oi))
            }
          }
          result[meal.id] = participants
        }
        return result
      },
      // Jonglerie : catalogue d'articles à remettre = table TicketingHandoutItem.
      async getHandoutItems(handoutItemIds) {
        if (handoutItemIds.length === 0) return {}
        const items = await prisma.ticketingHandoutItem.findMany({
          where: { id: { in: handoutItemIds } },
          select: { id: true, name: true },
        })
        const map: Record<number, HandoutItemInfo> = {}
        for (const it of items) map[it.id] = { id: it.id, name: it.name }
        return map
      },
    },
    artists: {
      // Jonglerie : artistes = EditionArtist ; sélections de repas = ArtistMealSelection.
      async addEligibleMealSelections({ editionId, mealId, date, mealType }) {
        const artists = await prisma.editionArtist.findMany({
          where: { editionId },
          select: { id: true, arrivalDateTime: true, departureDateTime: true },
        })
        const eligible = artists.filter((artist) =>
          isArtistEligibleForMeal({ date, mealType: mealType as VolunteerMealType }, artist)
        )
        await Promise.all(
          eligible.map((artist) =>
            prisma.artistMealSelection.upsert({
              where: { artistId_mealId: { artistId: artist.id, mealId } },
              create: { artistId: artist.id, mealId, selected: true },
              update: { selected: true },
            })
          )
        )
      },
      async removeMealSelections(mealId) {
        await prisma.artistMealSelection.deleteMany({ where: { mealId } })
      },
      async getMealArtistParticipants(mealIds) {
        if (mealIds.length === 0) return {}
        const selections = await prisma.artistMealSelection.findMany({
          where: { mealId: { in: mealIds }, accepted: true },
          select: {
            mealId: true,
            afterShow: true,
            artist: {
              select: {
                dietaryPreference: true,
                allergies: true,
                allergySeverity: true,
                user: { select: { nom: true, prenom: true, email: true, phone: true } },
              },
            },
          },
        })
        const result: Record<number, ArtistMealParticipant[]> = {}
        for (const sel of selections) {
          ;(result[sel.mealId] ??= []).push({
            nom: sel.artist.user.nom,
            prenom: sel.artist.user.prenom,
            email: sel.artist.user.email,
            phone: sel.artist.user.phone,
            dietaryPreference: sel.artist.dietaryPreference,
            allergies: sel.artist.allergies,
            allergySeverity: sel.artist.allergySeverity,
            afterShow: sel.afterShow,
          })
        }
        return result
      },
    },
  }
}
