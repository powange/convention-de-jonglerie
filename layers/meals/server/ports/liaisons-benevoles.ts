// Câblage des ports du layer bénévoles qui touchent aux modules repas, billetterie et artistes.
// Partagé entre app1 et Flowvent, qui ont les mêmes modèles pour ce qu'il lit (VolunteerMeal et ses
// liaisons aux tarifs et options, TicketingHandoutItem, EditionArtist, ArtistMealSelection, Show) :
// chaque app l'étale dans son propre registre (`#server/volunteers/ports/registry`), à côté de ce
// qui lui est propre (organisateurs, portée de l'événement, messagerie).
import * as mealsService from '../meals/meals-service'

import type { VolunteerMealType } from '#server/types/prisma'
import type {
  ArtistMealParticipant,
  HandoutItemInfo,
  TicketMealParticipant,
  VolunteerPorts,
} from '#volunteers/server/ports/types'

import { infosAlimentaires, infosPersonnellesSelect } from '#core/server/utils/infos-personnelles'
import { isArtistEligibleForMeal } from '#server/utils/volunteer-meals'

export function portsBenevolesDesRepas(): Pick<VolunteerPorts, 'ticketing' | 'artists' | 'meals'> {
  return {
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
          // ⚠️ `customFields` manquait — constat B5. C'est là que vivent le régime et les
          // allergies déclarés à la commande, et la fiche imprimée pour la cuisine les perdait.
          customFields: true,
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
          customFields?: unknown
          order: {
            payerLastName: string | null
            payerFirstName: string | null
            payerEmail: string | null
          }
        }): TicketMealParticipant => {
          /*
           * `customFields` est une colonne JSON : rien ne garantit sa forme. Un tableau, une
           * chaîne ou `null` y sont possibles, et `(valeur as Record)` suivi d'un `?.` rendrait
           * `undefined` sans lever — mais sur un tableau, `cf.allergies` vaudrait `undefined` en
           * silence là où l'on croit lire un objet. Le test de forme est donc explicite, comme
           * ailleurs dans le dépôt pour les champs JSON.
           */
          const champs =
            oi.customFields &&
            typeof oi.customFields === 'object' &&
            !Array.isArray(oi.customFields)
              ? (oi.customFields as Record<string, unknown>)
              : {}
          const texte = (valeur: unknown) => (typeof valeur === 'string' && valeur ? valeur : null)
          return {
            nom: oi.lastName || oi.order.payerLastName || '',
            prenom: oi.firstName || oi.order.payerFirstName || '',
            email: oi.email || oi.order.payerEmail || '',
            dietaryPreference: texte(champs.dietaryPreference),
            allergies: texte(champs.allergies),
            allergySeverity: texte(champs.allergySeverity),
          }
        }
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
              create: { artistId: artist.id, mealId, accepted: true },
              // ⚠️ RIEN à mettre à jour — constat B3 : écrire `accepted: true` ré-inscrivait
              // d'office un artiste qui avait décliné ce repas. L'`upsert` ne sert plus qu'à
              // créer la ligne manquante sans échouer sur celle qui existe déjà.
              update: {},
            })
          )
        )
      },
      /*
       * ⚠️⚠️ NE SUPPRIME PLUS RIEN — constat B3.
       *
       * Cette méthode effaçait toutes les sélections d'artistes du repas, `consumedAt` et
       * `afterShow` compris, dès qu'on désactivait le repas. Un clic malheureux pendant
       * l'événement perdait l'historique de service.
       *
       * Elle est CONSERVÉE mais inerte plutôt que retirée du port : son appelant
       * (`volunteers/meals.put.ts`) la choisit par une ternaire sur la bascule, et la retirer
       * demanderait de réécrire ce chemin pour un gain nul. Le nom reste vrai du point de vue du
       * contrat — « retirer les sélections de ce repas de ce qui est servi » —, et c'est
       * désormais le filtre `enabled: true` des lectures qui l'assure, sans rien détruire.
       *
       * 📍 Ne pas la « réparer » en y remettant un `deleteMany` : c'était le défaut.
       */
      async removeMealSelections(_mealId) {
        // Volontairement vide : voir ci-dessus.
      },
      async getShowSchedule(editionId) {
        const spectacles = await prisma.show.findMany({
          where: { editionId, performances: { some: {} } },
          select: {
            id: true,
            title: true,
            duration: true,
            performances: { select: { startDateTime: true }, orderBy: { startDateTime: 'asc' } },
          },
        })
        return spectacles.map((spectacle) => ({
          id: spectacle.id,
          title: spectacle.title,
          durationMinutes: spectacle.duration,
          performances: spectacle.performances.map((passage) => ({
            startDateTime: passage.startDateTime.toISOString(),
          })),
        }))
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
                user: {
                  select: {
                    ...infosPersonnellesSelect,
                    nom: true,
                    prenom: true,
                    email: true,
                    phone: true,
                  },
                },
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
            // Le profil fait foi ; la fiche artiste ne sert que de repli tant que ses
            // colonnes existent (cf. `infos-personnelles`).
            ...infosAlimentaires(sel.artist.user as never),
            afterShow: sel.afterShow,
          })
        }
        return result
      },
    },
    meals: {
      disponible: true,
      // Délégation au service du module repas (`../meals/meals-service`).
      getEditionMealSchedule: (editionId) => mealsService.getEditionMealSchedule(editionId),
      updateEditionMealsConfig: (editionId, meals) =>
        mealsService.updateEditionMealsConfig(editionId, meals),
      getVolunteerSelfMeals: (editionId, userId) =>
        mealsService.getVolunteerSelfMeals(editionId, userId),
      setVolunteerSelfMealAcceptances: (editionId, userId, selections) =>
        mealsService.setVolunteerSelfMealAcceptances(editionId, userId, selections),
      getVolunteerMeals: (editionId, volunteerId) =>
        mealsService.getVolunteerMeals(editionId, volunteerId),
      setVolunteerMeals: (editionId, volunteerId, selections) =>
        mealsService.setVolunteerMeals(editionId, volunteerId, selections),
      getCateringMealsForDate: (editionId, targetDate) =>
        mealsService.getCateringMealsForDate(editionId, targetDate),
      createVolunteerMealSelections: (volunteerId, editionId) =>
        mealsService.createVolunteerMealSelections(volunteerId, editionId),
      deleteVolunteerMealSelections: (volunteerId) =>
        mealsService.deleteVolunteerMealSelections(volunteerId),
    },
  }
}
