import {
  droitsDeLaSource,
  personnesEnDoublon,
  type DroitAuRepas,
  type SourceDeRepas,
} from '../../../../utils/doublons-de-repas'

import { useMealsPorts } from '#server/meals/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import {
  canManageArtistsById,
  canManageMealsById,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/** Ce qu'il faut du compte pour reconnaître quelqu'un dans la liste. */
const identiteSelect = {
  id: true,
  nom: true,
  prenom: true,
  pseudo: true,
  email: true,
} as const

interface Identite {
  id: number
  nom: string | null
  prenom: string | null
  pseudo: string | null
  email: string | null
}

/**
 * Les personnes ayant droit au même repas à plusieurs titres, et de quoi y remédier.
 *
 * Gardé par `canManageMeals`, comme les autres écrans repas. Mais **retirer** un droit n'obéit pas
 * au même droit selon la source : côté bénévole il faut `canManageVolunteers`, côté artiste
 * `canManageArtists`, et seul l'organisateur relève de `canManageMeals`. Ces trois autorisations
 * sont indépendantes. Une personne n'ayant que celle des repas verrait donc les doublons et se
 * prendrait un 403 en cliquant — d'où `permissions` dans la réponse : l'écran grise ce qu'il ne
 * peut pas faire et dit à qui le passer, plutôt que de le découvrir au clic.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageMealsById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    const meals = await prisma.volunteerMeal.findMany({
      where: { editionId, enabled: true },
      select: { id: true, date: true, mealType: true },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })
    const mealIds = meals.map((meal) => meal.id)

    const identites = new Map<number, Identite>()
    const droits: DroitAuRepas[] = []

    // Bénévoles : le droit est matérialisé, une ligne par repas accepté.
    //
    // Le filtre sur `status` n'est pas décoratif : une candidature peut porter des sélections puis
    // être refusée. Elles restent en base — la personne n'a plus droit à rien, et la faire
    // apparaître ici enverrait arbitrer un doublon qui n'existe pas.
    const selectionsBenevoles = mealIds.length
      ? await prisma.volunteerMealSelection.findMany({
          where: {
            mealId: { in: mealIds },
            accepted: true,
            volunteer: { eventId: editionId, status: 'ACCEPTED' },
          },
          select: {
            id: true,
            mealId: true,
            volunteerId: true,
            volunteer: { select: { user: { select: identiteSelect } } },
          },
        })
      : []

    for (const selection of selectionsBenevoles) {
      const compte = selection.volunteer.user
      identites.set(compte.id, compte)
      droits.push({
        source: 'volunteer',
        mealId: selection.mealId,
        userId: compte.id,
        roleId: selection.volunteerId,
        selectionId: selection.id,
      })
    }

    // Artistes : via le port, le layer ne lit pas les modèles du module artistes.
    const droitsArtistes = await useMealsPorts().artists.listEditionMealRights(editionId, mealIds)
    for (const droit of droitsArtistes) {
      if (droit.userId === null) continue
      identites.set(droit.userId, {
        id: droit.userId,
        nom: droit.nom,
        prenom: droit.prenom,
        pseudo: droit.pseudo,
        email: droit.email,
      })
      droits.push({
        source: 'artist',
        mealId: droit.mealId,
        userId: droit.userId,
        roleId: droit.artistId,
        selectionId: droit.selectionId,
      })
    }

    // Organisateurs : le droit n'est PAS matérialisé. Ils ont tous les repas de l'édition, et
    // seules les exceptions (`accepted = false`) sont stockées — c'est ce qui fait que quiconque
    // est organisateur ET bénévole se retrouve en doublon sur chacun de ses repas.
    const editionOrganizers = await prisma.editionOrganizer.findMany({
      where: { editionId },
      select: {
        id: true,
        mealSelections: {
          where: { mealId: { in: mealIds } },
          select: { mealId: true, accepted: true },
        },
        organizer: { select: { user: { select: identiteSelect } } },
      },
    })

    for (const editionOrganizer of editionOrganizers) {
      const compte = editionOrganizer.organizer.user
      const refuses = new Set(
        editionOrganizer.mealSelections
          .filter((selection) => !selection.accepted)
          .map((selection) => selection.mealId)
      )
      identites.set(compte.id, compte)

      for (const mealId of mealIds) {
        if (refuses.has(mealId)) continue
        droits.push({
          source: 'organizer',
          mealId,
          userId: compte.id,
          roleId: editionOrganizer.id,
          // Rien à désigner : le droit tient à l'absence de refus, pas à une ligne.
          selectionId: null,
        })
      }
    }

    const [peutGererBenevoles, peutGererArtistes] = await Promise.all([
      canManageEditionVolunteers(editionId, user.id, event),
      canManageArtistsById(editionId, user.id, event),
    ])

    const personnes = personnesEnDoublon(droits, mealIds).map((personne) => {
      const identite = identites.get(personne.userId)
      return {
        userId: personne.userId,
        nom: identite?.nom ?? null,
        prenom: identite?.prenom ?? null,
        pseudo: identite?.pseudo ?? null,
        email: identite?.email ?? null,
        sources: personne.sources.map((source) => ({
          source,
          nbRepas: droitsDeLaSource(personne, source).length,
        })),
        repas: personne.repas,
      }
    })

    // Par ordre alphabétique : sur quinze lignes, on cherche quelqu'un par son nom, pas le plus
    // gros total. Les personnes sans nom saisi passent en dernier plutôt qu'en tête.
    personnes.sort((a, b) => {
      const nomDe = (p: (typeof personnes)[number]) =>
        `${p.nom ?? ''} ${p.prenom ?? ''}`.trim() || p.pseudo || p.email || ''
      const gauche = nomDe(a)
      const droite = nomDe(b)
      if (!gauche) return droite ? 1 : 0
      if (!droite) return -1
      return gauche.localeCompare(droite, 'fr')
    })

    const permissions: Record<SourceDeRepas, boolean> = {
      volunteer: peutGererBenevoles,
      artist: peutGererArtistes,
      // L'écran lui-même exige déjà ce droit : l'avoir atteint suffit à le prouver.
      organizer: true,
    }

    return createSuccessResponse({
      meals,
      personnes,
      permissions,
    })
  },
  { operationName: 'GetEditionMealDuplicates' }
)
