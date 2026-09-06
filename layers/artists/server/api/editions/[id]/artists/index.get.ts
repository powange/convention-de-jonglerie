import { createHash } from 'node:crypto'


import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'
import { sanitizeEmail, validateEditionId } from '#server/utils/validation-helpers'
import { fromCents } from '~~/shared/utils/money'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageArtistsById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    const artists = await prisma.editionArtist.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            pseudo: true,
            prenom: true,
            nom: true,
            pronouns: true,
            phone: true,
            authProvider: true,
            profilePicture: true,
            updatedAt: true,
          },
        },
        pickupResponsible: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            prenom: true,
            nom: true,
          },
        },
        dropoffResponsible: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            prenom: true,
            nom: true,
          },
        },
        // distinct : un artiste jouant dans plusieurs numéros d'un cabaret a autant de
        // liens ShowArtist pour le même spectacle, qui apparaîtrait sinon en double
        shows: {
          distinct: ['showId'],
          include: {
            show: {
              select: {
                id: true,
                title: true,
                // Le quand et le où appartiennent aux représentations : un spectacle peut être
                // joué plusieurs fois, à des endroits différents.
                performances: {
                  select: { id: true, startDateTime: true, location: true },
                  orderBy: { startDateTime: 'asc' },
                },
              },
            },
          },
        },
        // Articles à remettre à cet artiste en particulier, pour les afficher en gestion
        // à côté de ceux de ses spectacles.
        handoutItems: {
          include: { handoutItem: { select: { id: true, name: true } } },
        },
        mealSelections: {
          include: {
            meal: {
              select: {
                id: true,
                date: true,
                mealType: true,
                phases: true,
              },
            },
          },
          orderBy: [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Ajouter le hash de l'email pour chaque artiste
    //
    // Les montants repassent en unité courante : la base les stocke en centimes, mais toute
    // l'API des artistes — création comme mise à jour — parle en euros. Renvoyer les centimes
    // bruts ici afficherait des montants multipliés par cent côté gestion.
    const artistsWithEmailHash = artists.map((artist) => ({
      ...artist,
      payment: fromCents(artist.payment),
      reimbursementMax: fromCents(artist.reimbursementMax),
      reimbursementActual: fromCents(artist.reimbursementActual),
      consumablesMax: fromCents(artist.consumablesMax),
      consumablesActual: fromCents(artist.consumablesActual),
      user: {
        ...artist.user,
        emailHash: createHash('md5').update(sanitizeEmail(artist.user.email)).digest('hex'),
        profilePicture: artist.user.profilePicture,
      },
    }))

    return createSuccessResponse({ artists: artistsWithEmailHash })
  },
  { operationName: 'GetArtists' }
)
