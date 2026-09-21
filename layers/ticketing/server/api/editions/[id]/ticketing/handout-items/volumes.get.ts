import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { billetsQuiComptent } from '#server/utils/ticketing/billets-qui-comptent'
import {
  calculateHandoutItemsForTicket,
  handoutItemsIncludes,
  selectedOptionsIncludes,
} from '#server/utils/ticketing/handout-items'
import { exigerArticlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'
import {
  associationsDunArtiste,
  associationsDunBenevole,
  associationsDunOrganisateur,
  cumulerParArticle,
  personneComptee,
  type PersonneComptee,
} from '#server/utils/ticketing/volumes-des-articles'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Combien d'exemplaires de chaque article prévoir, et combien sont déjà sortis.
 *
 * Un seul point d'API pour deux questions qui sont le même calcul : « combien de tee-shirts
 * commander » six semaines avant, et « qui n'a pas encore récupéré le sien » pendant l'événement.
 * Les séparer aurait fait diverger deux agrégats censés dire la même chose.
 *
 * **Ce qui est sorti se lit sur la validation d'entrée** — décision du 21/09/2026. Rien
 * n'enregistre la remise ailleurs.
 *
 * **Le cumul se fait par personne, jamais par article.** Un article non cumulable n'est remis
 * qu'une fois quel que soit le nombre d'associations : une agrégation SQL directe compterait
 * trop, en silence. Les quatre populations passent donc par `personneComptee`, qui applique
 * `aggregateHandoutItems`.
 *
 * Coût : une dizaine de requêtes, indépendantes du nombre d'articles et de personnes — toutes les
 * associations de l'édition tiennent dans une lecture chacune, le rapprochement se fait en
 * mémoire. C'est le motif que le guichet a adopté après avoir déclenché quatre requêtes par
 * personne.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })
    }

    // Module éteint : un refus explicite plutôt qu'un tableau vide, qui se lirait comme « rien à
    // prévoir ». Appelé APRÈS le contrôle des droits, comme l'exige le commentaire de la garde.
    await exigerArticlesARemettreActifs(editionId)

    const catalogue = await prisma.ticketingHandoutItem.findMany({
      where: { editionId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const personnes: PersonneComptee[] = []

    /* ---------------------------------------------------------------- participants */

    /**
     * Les billets qui comptent : `billetsQuiComptent` écarte les lignes annulées et les commandes
     * remboursées. La règle n'est pas récrite ici — c'est le vocabulaire que le guichet emploie.
     */
    const billets = await prisma.ticketingOrderItem.findMany({
      where: billetsQuiComptent(editionId),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        entryValidated: true,
        customFields: true,
        tier: { select: { id: true, name: true, ...handoutItemsIncludes } },
        ...selectedOptionsIncludes,
      },
    })

    for (const billet of billets) {
      personnes.push(
        personneComptee(
          {
            id: billet.id,
            nom: [billet.firstName, billet.lastName].filter(Boolean).join(' ').trim() || 'Sans nom',
            population: 'participants',
            entreeValidee: billet.entryValidated,
          },
          /**
           * Le billet réunit déjà ses trois sources — tarif, options, champs personnalisés — et
           * les agrège. C'est la fonction que lit le guichet ; elle n'est pas doublée ici.
           *
           * Elle rend des entrées `{ handoutItem, quantity }`, pas des articles plats : elles
           * repassent donc telles quelles par `personneComptee`. L'agrégation est idempotente,
           * puisque cette fonction a déjà dédoublonné par identifiant.
           */
          calculateHandoutItemsForTicket(billet)
        )
      )
    }

    /* ------------------------------------------------------------------ bénévoles */

    /**
     * Toutes les candidatures ACCEPTÉES, sans filtrer sur la disponibilité.
     *
     * Le guichet écarte les bénévoles qui ne sont là qu'au montage, parce qu'il cherche qui peut
     * se présenter pendant l'événement. Une prévision de volumes n'a pas cette raison : un
     * bénévole de montage reçoit son bracelet comme les autres.
     *
     * ⚠️ La candidature est scopée par `eventId`, pas par `editionId`.
     */
    const benevoles = await prisma.editionVolunteerApplication.findMany({
      where: { eventId: editionId, status: 'ACCEPTED' },
      select: {
        id: true,
        entryValidated: true,
        user: { select: { prenom: true, nom: true } },
        teamAssignments: { select: { team: { select: { id: true } } } },
      },
    })

    if (benevoles.length > 0) {
      const associationsBenevoles = await prisma.editionVolunteerHandoutItem.findMany({
        where: { editionId },
        include: { handoutItem: true },
      })
      const globalesBenevoles = associationsBenevoles.filter((a) => a.teamId === null)
      const parEquipe = new Map<string, typeof associationsBenevoles>()
      for (const association of associationsBenevoles) {
        if (association.teamId === null) continue
        const liste = parEquipe.get(association.teamId) ?? []
        liste.push(association)
        parEquipe.set(association.teamId, liste)
      }

      const repasBenevoles = await prisma.volunteerMealSelection.findMany({
        where: {
          volunteerId: { in: benevoles.map((b) => b.id) },
          accepted: true,
          meal: { enabled: true },
        },
        include: { meal: { include: { handoutItems: { include: { handoutItem: true } } } } },
      })
      const repasParBenevole = new Map<number, typeof repasBenevoles>()
      for (const selection of repasBenevoles) {
        const liste = repasParBenevole.get(selection.volunteerId) ?? []
        liste.push(selection)
        repasParBenevole.set(selection.volunteerId, liste)
      }

      for (const benevole of benevoles) {
        personnes.push(
          personneComptee(
            {
              id: benevole.id,
              nom: nomDe(benevole.user),
              population: 'benevoles',
              entreeValidee: benevole.entryValidated,
            },
            associationsDunBenevole({
              globales: globalesBenevoles,
              parEquipe,
              equipes: benevole.teamAssignments.map((a) => a.team.id),
              repas: (repasParBenevole.get(benevole.id) ?? []).flatMap((s) => s.meal.handoutItems),
            })
          )
        )
      }
    }

    /* -------------------------------------------------------------------- artistes */

    const artistes = await prisma.editionArtist.findMany({
      where: { editionId },
      select: {
        id: true,
        entryValidated: true,
        user: { select: { prenom: true, nom: true } },
        handoutItems: { include: { handoutItem: true } },
        shows: {
          select: { show: { select: { handoutItems: { include: { handoutItem: true } } } } },
        },
      },
    })

    if (artistes.length > 0) {
      const globalesArtistes = await prisma.editionArtistHandoutItem.findMany({
        where: { editionId },
        include: { handoutItem: true },
      })

      const repasArtistes = await prisma.artistMealSelection.findMany({
        where: {
          artistId: { in: artistes.map((a) => a.id) },
          accepted: true,
          meal: { enabled: true },
        },
        include: { meal: { include: { handoutItems: { include: { handoutItem: true } } } } },
      })
      const repasParArtiste = new Map<number, typeof repasArtistes>()
      for (const selection of repasArtistes) {
        const liste = repasParArtiste.get(selection.artistId) ?? []
        liste.push(selection)
        repasParArtiste.set(selection.artistId, liste)
      }

      for (const artiste of artistes) {
        personnes.push(
          personneComptee(
            {
              id: artiste.id,
              nom: nomDe(artiste.user),
              population: 'artistes',
              entreeValidee: artiste.entryValidated,
            },
            associationsDunArtiste({
              globales: globalesArtistes,
              nommees: artiste.handoutItems,
              // Un artiste lié deux fois au même spectacle (deux numéros d'un cabaret) en compte
              // les articles deux fois : c'est ce que fait le guichet, et un écart entre les deux
              // se lirait comme une erreur de cet écran.
              spectacles: artiste.shows.flatMap((lien) => lien.show.handoutItems),
              repas: (repasParArtiste.get(artiste.id) ?? []).flatMap((s) => s.meal.handoutItems),
            })
          )
        )
      }
    }

    /* --------------------------------------------------------------- organisateurs */

    const organisateurs = await prisma.editionOrganizer.findMany({
      where: { editionId },
      select: {
        id: true,
        entryValidated: true,
        organizer: { select: { user: { select: { prenom: true, nom: true } } } },
        handoutItems: { include: { handoutItem: true } },
      },
    })

    if (organisateurs.length > 0) {
      /**
       * ⚠️ Pas de `in: [...ids, null]` : en SQL une comparaison avec NULL n'est jamais vraie, et
       * les articles globaux disparaîtraient sans la moindre erreur. Le piège est documenté au
       * même endroit dans le guichet.
       */
      const globalesOrganisateurs = await prisma.editionOrganizerHandoutItem.findMany({
        where: { editionId, organizerId: null },
        include: { handoutItem: true },
      })

      const repasOrganisateurs = await prisma.organizerMealSelection.findMany({
        where: {
          editionOrganizerId: { in: organisateurs.map((o) => o.id) },
          accepted: true,
          meal: { enabled: true },
        },
        include: { meal: { include: { handoutItems: { include: { handoutItem: true } } } } },
      })
      const repasParOrganisateur = new Map<number, typeof repasOrganisateurs>()
      for (const selection of repasOrganisateurs) {
        const liste = repasParOrganisateur.get(selection.editionOrganizerId) ?? []
        liste.push(selection)
        repasParOrganisateur.set(selection.editionOrganizerId, liste)
      }

      for (const organisateur of organisateurs) {
        personnes.push(
          personneComptee(
            {
              id: organisateur.id,
              nom: nomDe(organisateur.organizer?.user),
              population: 'organisateurs',
              entreeValidee: organisateur.entryValidated,
            },
            associationsDunOrganisateur({
              globales: globalesOrganisateurs,
              nommees: organisateur.handoutItems,
              repas: (repasParOrganisateur.get(organisateur.id) ?? []).flatMap(
                (s) => s.meal.handoutItems
              ),
            })
          )
        )
      }
    }

    return createSuccessResponse({
      volumes: cumulerParArticle(personnes, catalogue),
      /**
       * Combien de personnes le calcul a vues, par population. Un total d'articles ne se vérifie
       * pas sans savoir sur combien de têtes il porte — et un zéro inattendu ici désigne aussitôt
       * la population dont le paramétrage manque.
       */
      personnes: {
        participants: billets.length,
        benevoles: benevoles.length,
        artistes: artistes.length,
        organisateurs: organisateurs.length,
      },
      /** L'instant du calcul : ces chiffres bougent à chaque vente et à chaque entrée. */
      calculeLe: new Date().toISOString(),
    })
  },
  { operationName: 'GET ticketing handout item volumes' }
)

/** Le nom affiché d'une personne, ou un repère quand l'utilisateur lié a disparu. */
function nomDe(user?: { prenom?: string | null; nom?: string | null } | null): string {
  return [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || 'Sans nom'
}
