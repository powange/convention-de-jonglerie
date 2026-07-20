import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

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
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
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
        invoiceRequested: true,
        invoiceProvided: true,
        feeRequested: true,
        feeProvided: true,
        user: {
          select: {
            prenom: true,
            nom: true,
            email: true,
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
                startDateTime: true,
                duration: true,
                location: true,
                type: true,
                technicalNeeds: true,
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
        startDateTime: Date
        duration: number | null
        location: string | null
        type: string
        technicalNeeds: string | null
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
          startDateTime: s.startDateTime,
          duration: s.duration,
          location: s.location,
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
        dietaryPreference: artist.dietaryPreference,
        allergies: artist.allergies,
        allergySeverity: artist.allergySeverity,
        payment: artist.payment ? Number(artist.payment) : null,
        paymentPaid: artist.paymentPaid,
        reimbursementMax: artist.reimbursementMax ? Number(artist.reimbursementMax) : null,
        reimbursementActual: artist.reimbursementActual ? Number(artist.reimbursementActual) : null,
        reimbursementActualPaid: artist.reimbursementActualPaid,
        consumablesMax: artist.consumablesMax ? Number(artist.consumablesMax) : null,
        consumablesActual: artist.consumablesActual ? Number(artist.consumablesActual) : null,
        consumablesActualPaid: artist.consumablesActualPaid,
        accommodationAutonomous: artist.accommodationAutonomous,
        accommodationType: artist.accommodationType,
        accommodationTypeOther: artist.accommodationTypeOther,
        accommodationProposal: artist.accommodationProposal,
        pickupRequired: artist.pickupRequired,
        pickupLocation: artist.pickupLocation,
        dropoffRequired: artist.dropoffRequired,
        dropoffLocation: artist.dropoffLocation,
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
