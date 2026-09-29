import { createHash } from 'node:crypto'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'
import { sanitizeEmail, validateEditionId } from '#server/utils/validation-helpers'
import { fromCents } from '~~/shared/utils/money'

/** Au-delà, la liste complète redevient plus économique qu'une requête `IN` géante. */
const MAX_ADRESSES = 50

/**
 * Les adresses demandées par `emails=`, ou `null` si le paramètre est absent.
 *
 * `null` et non un tableau vide : l'absence de paramètre doit rendre la réponse COMPLÈTE, alors
 * qu'un `emails=` vide ne demande personne. Les confondre ferait basculer tous les appels
 * existants — la page de gestion des artistes comprise — en mode allégé, et ses colonnes se
 * videraient sans qu'aucune erreur ne le dise.
 */
const adressesDemandees = (brut: unknown): string[] | null => {
  if (typeof brut !== 'string') return null
  /*
   * `sanitizeEmail` plutôt qu'un `toLowerCase` en ligne : c'est le helper du dépôt pour cela, et la
   * comparaison qui suit s'appuie — comme la connexion, qui interroge `email` sans normaliser — sur
   * la collation insensible à la casse de MySQL. Normaliser ici rend la requête juste quelle que
   * soit la casse reçue, sans dépendre de ce que le client a envoyé.
   */
  const adresses = brut
    .split(',')
    .map((adresse) => sanitizeEmail(adresse))
    .filter((adresse) => adresse.length > 0)
  // Dédoublonnées : la même personne peut être citée deux fois dans une candidature.
  return [...new Set(adresses)].slice(0, MAX_ADRESSES)
}

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

    /*
     * Mode ALLÉGÉ, quand `emails=` est fourni.
     *
     * La fiche d'une candidature ne cherche qu'une chose : parmi les personnes citées comme
     * co-équipiers, lesquelles sont déjà artistes de l'édition, et sur quels spectacles. Elle
     * chargeait pour cela TOUS les artistes avec leurs comptes, leurs responsables de transport,
     * leurs représentations, leurs articles à remettre et leurs repas — pour n'en garder qu'une
     * correspondance adresse → identifiants de spectacles.
     *
     * Le paramètre est OPTIONNEL : sans lui, la réponse est exactement celle d'avant, que la page de
     * gestion des artistes consomme en entier. Un plafond de 50 adresses borne la requête ; au-delà,
     * c'est la liste complète qui redevient le bon outil.
     */
    const emailsDemandes = adressesDemandees(getQuery(event).emails)

    if (emailsDemandes) {
      const artistesCibles = await prisma.editionArtist.findMany({
        where: { editionId, user: { email: { in: emailsDemandes } } },
        select: {
          id: true,
          user: { select: { email: true } },
          // `distinct` comme dans la requête complète : un artiste jouant plusieurs numéros d'un
          // cabaret porte autant de liens vers le même spectacle.
          shows: { distinct: ['showId'], select: { show: { select: { id: true } } } },
        },
      })

      return createSuccessResponse({ artists: artistesCibles })
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
