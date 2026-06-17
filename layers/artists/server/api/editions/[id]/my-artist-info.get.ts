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
        shows: {
          select: {
            show: {
              select: {
                id: true,
                title: true,
                description: true,
                startDateTime: true,
                duration: true,
                location: true,
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
        shows: artist.shows.map((sa) => ({
          id: sa.show.id,
          title: sa.show.title,
          description: sa.show.description,
          startDateTime: sa.show.startDateTime,
          duration: sa.show.duration,
          location: sa.show.location,
        })),
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
