import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { infosAlimentaires, infosPersonnellesSelect } from '#server/utils/infos-personnelles'
import { validateEditionId } from '#server/utils/validation-helpers'
import { fromCents } from '~~/shared/utils/money'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Récupérer l'artiste de l'utilisateur pour cette édition
    const artist = await prisma.editionArtist.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: user.id,
        },
      },
      select: {
        id: true,
        arrivalDateTime: true,
        departureDateTime: true,
        payment: true,
        paymentPaid: true,
        reimbursementMax: true,
        reimbursementActual: true,
        reimbursementActualPaid: true,
        consumablesMax: true,
        consumablesActual: true,
        consumablesActualPaid: true,
        accommodationAutonomous: true,
        accommodationType: true,
        accommodationTypeOther: true,
        accommodationProposal: true,
        pickupRequired: true,
        pickupLocation: true,
        dropoffRequired: true,
        dropoffLocation: true,
        // L'artiste doit savoir qui vient le chercher, pas seulement où et quand.
        pickupResponsible: { select: { prenom: true, nom: true, pseudo: true, phone: true } },
        dropoffResponsible: { select: { prenom: true, nom: true, pseudo: true, phone: true } },
        invoiceRequested: true,
        invoiceProvided: true,
        feeRequested: true,
        feeProvided: true,
        user: {
          select: {
            prenom: true,
            nom: true,
            email: true,
            ...infosPersonnellesSelect,
          },
        },
        // distinct : un artiste jouant dans plusieurs numéros d'un cabaret a autant de
        // liens ShowArtist pour le même spectacle, qui apparaîtrait sinon en double
        // Pas de `distinct` : un artiste peut jouer dans plusieurs numéros d'un même cabaret ;
        // on regroupe ensuite par spectacle en collectant ses numéros (voir mapping plus bas).
        shows: {
          select: {
            actId: true,
            show: {
              select: {
                id: true,
                title: true,
                description: true,
                duration: true,
                type: true,
                technicalNeeds: true,
                // Un spectacle peut être joué plusieurs fois : l'artiste doit voir tous ses
                // passages, pas seulement le premier.
                performances: {
                  select: { id: true, startDateTime: true, location: true },
                  orderBy: { startDateTime: 'asc' },
                },
              },
            },
            act: {
              select: {
                id: true,
                title: true,
                technicalNeeds: true,
                stageSetup: true,
              },
            },
          },
        },
        mealSelections: {
          where: { accepted: true },
          select: {
            id: true,
            afterShow: true,
            meal: {
              select: {
                id: true,
                date: true,
                mealType: true,
              },
            },
          },
          orderBy: {
            meal: { date: 'asc' },
          },
        },
      },
    })

    if (!artist) {
      return {
        artist: null,
      }
    }

    // Regrouper les liens ShowArtist par spectacle. Pour un cabaret, on collecte les numéros où
    // l'artiste joue (chacun éditable : besoins techniques + mise en place). Pour un standard,
    // le champ éditable est le `technicalNeeds` du spectacle lui-même.
    type EditableAct = {
      id: number
      title: string
      technicalNeeds: string | null
      stageSetup: string | null
    }
    const showsById = new Map<
      number,
      {
        id: number
        title: string
        description: string | null
        duration: number | null
        type: string
        technicalNeeds: string | null
        performances: { id: number; startDateTime: Date; location: string | null }[]
        acts: EditableAct[]
      }
    >()
    for (const sa of artist.shows) {
      const s = sa.show
      let entry = showsById.get(s.id)
      if (!entry) {
        entry = {
          id: s.id,
          title: s.title,
          description: s.description,
          duration: s.duration,
          performances: s.performances,
          type: s.type,
          // Éditable par l'artiste seulement pour un STANDARD (un cabaret édite ses numéros).
          technicalNeeds: s.type === 'STANDARD' ? s.technicalNeeds : null,
          acts: [],
        }
        showsById.set(s.id, entry)
      }
      if (sa.act) {
        entry.acts.push({
          id: sa.act.id,
          title: sa.act.title,
          technicalNeeds: sa.act.technicalNeeds,
          stageSetup: sa.act.stageSetup,
        })
      }
    }
    const groupedShows = [...showsById.values()]

    return {
      artist: {
        id: artist.id,
        firstName: artist.user.prenom,
        lastName: artist.user.nom,
        email: artist.user.email,
        qrCode: `artist-${artist.id}`, // Format compatible avec le contrôle d'accès
        arrivalDateTime: artist.arrivalDateTime,
        departureDateTime: artist.departureDateTime,
        // Le profil fait foi, ici comme dans les listes de repas. Sans cette résolution,
        // l'artiste relirait la copie figée sur sa fiche pendant que les organisateurs
        // verraient son profil — deux vérités pour la même personne.
        ...infosAlimentaires(artist.user as never),
        // La base est en centimes, l'API expose des unités courantes : `Number()` seul rendrait
        // désormais des centimes bruts, soit des montants multipliés par cent.
        payment: fromCents(artist.payment),
        paymentPaid: artist.paymentPaid,
        reimbursementMax: fromCents(artist.reimbursementMax),
        reimbursementActual: fromCents(artist.reimbursementActual),
        reimbursementActualPaid: artist.reimbursementActualPaid,
        consumablesMax: fromCents(artist.consumablesMax),
        consumablesActual: fromCents(artist.consumablesActual),
        consumablesActualPaid: artist.consumablesActualPaid,
        accommodationAutonomous: artist.accommodationAutonomous,
        accommodationType: artist.accommodationType,
        accommodationTypeOther: artist.accommodationTypeOther,
        accommodationProposal: artist.accommodationProposal,
        pickupRequired: artist.pickupRequired,
        pickupLocation: artist.pickupLocation,
        pickupResponsible: artist.pickupResponsible,
        dropoffRequired: artist.dropoffRequired,
        dropoffLocation: artist.dropoffLocation,
        dropoffResponsible: artist.dropoffResponsible,
        invoiceRequested: artist.invoiceRequested,
        invoiceProvided: artist.invoiceProvided,
        feeRequested: artist.feeRequested,
        feeProvided: artist.feeProvided,
        shows: groupedShows,
        mealSelections: artist.mealSelections.map((ms) => ({
          id: ms.id,
          afterShow: ms.afterShow,
          meal: {
            id: ms.meal.id,
            date: ms.meal.date,
            mealType: ms.meal.mealType,
          },
        })),
      },
    }
  },
  { operationName: 'GetMyArtistInfo' }
)
