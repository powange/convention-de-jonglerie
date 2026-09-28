import { z } from 'zod'

import type { H3Event } from 'h3'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { schemaUrlExterne } from '~~/shared/utils/url-externe'

/** Comptes artiste notifiés par tranche : le nombre de requêtes simultanées reste borné. */
const TAILLE_DE_TRANCHE = 20

/**
 * Lance un travail sans faire attendre le client.
 *
 * `event.waitUntil` existe bien dans ce Nitro (2.13.4) : il empile la promesse et la transmet à la
 * plate-forme quand celle-ci en propose un — sur un serveur Node, personne ne l'attend, ce qui est
 * exactement l'effet voulu. Le repli `setImmediate` couvre les contextes où il n'existe pas, dont
 * les tests, où l'événement est un objet nu.
 *
 * Les rejets sont rattrapés ici : une promesse orpheline qui échoue remonterait en
 * `unhandledRejection`, et il n'y a plus personne pour lui répondre.
 */
function apresLaReponse(event: H3Event, travail: () => Promise<void>): void {
  const lancer = () =>
    travail().catch((erreur) => {
      console.error('[UpdateShowCall] diffusion après réponse échouée', erreur)
    })

  const { waitUntil } = event as H3Event & { waitUntil?: (p: Promise<unknown>) => void }

  if (typeof waitUntil === 'function') {
    // La VRAIE promesse, pas une enveloppe déjà résolue : là où la plate-forme l'honore, elle
    // maintient le processus en vie le temps de la diffusion.
    waitUntil.call(event, lancer())
    return
  }

  setImmediate(lancer)
}

/**
 * Annonce l'ouverture d'un appel à spectacles à tous les comptes artiste du site.
 *
 * Trois choses la séparent de ce qu'elle remplaçait, une boucle `for` avec un `await` par artiste,
 * exécutée dans la requête :
 *
 * - elle ne fait plus attendre l'organisateur. La base de développement compte 113 comptes
 *   artiste : c'était 113 allers-retours séquentiels avant que la réponse ne parte, et ce nombre ne
 *   fait que croître avec le site ;
 * - elle envoie par tranches de 20 avec `Promise.allSettled`, donc en parallèle mais sans ouvrir
 *   des centaines d'envois d'un coup ;
 * - `allSettled` et non `all` : un destinataire dont l'envoi échoue n'interrompt pas les suivants.
 *   `safeNotify` avale déjà les erreurs une par une, mais la garantie ne doit pas dépendre de lui.
 */
async function diffuserOuvertureAuxArtistes(
  nomDeLAppel: string,
  editionName: string,
  editionId: number
): Promise<void> {
  const artists = await prisma.user.findMany({
    where: { isArtist: true },
    select: { id: true },
  })

  for (let debut = 0; debut < artists.length; debut += TAILLE_DE_TRANCHE) {
    const tranche = artists.slice(debut, debut + TAILLE_DE_TRANCHE)
    await Promise.allSettled(
      tranche.map((artist) =>
        safeNotify(
          () => NotificationHelpers.showCallOpened(artist.id, nomDeLAppel, editionName, editionId),
          'notification appel à spectacles ouvert'
        )
      )
    )
  }
}

const updateShowCallSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long').optional(),
  description: z.string().max(5000).optional().nullable(),
  mode: z.enum(['INTERNAL', 'EXTERNAL']).optional(),
  externalUrl: schemaUrlExterne.optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  visibility: z.enum(['OFFLINE', 'CLOSED', 'PRIVATE', 'PUBLIC']).optional(),
  askPortfolioUrl: z.boolean().optional(),
  askVideoUrl: z.boolean().optional(),
  askTechnicalNeeds: z.boolean().optional(),
  askStageSetup: z.boolean().optional(),
  askAccommodation: z.boolean().optional(),
  askDepartureCity: z.boolean().optional(),
  askSocialLinks: z.boolean().optional(),
  requirePhone: z.boolean().optional(),
})

/**
 * Met à jour un appel à spectacles
 * Accessible par les organisateurs ayant les droits de gestion des artistes
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({
        status: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    // Vérifier les permissions
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour modifier cet appel à spectacles",
      })
    }

    // Vérifier que l'appel existe
    const existingShowCall = await prisma.editionShowCall.findFirst({
      where: {
        id: showCallId,
        editionId,
      },
    })

    if (!existingShowCall) {
      throw createError({
        status: 404,
        message: 'Appel à spectacles non trouvé',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = updateShowCallSchema.parse(body)

    // Déterminer les valeurs finales pour la vérification de cohérence
    const finalMode = validatedData.mode ?? existingShowCall.mode
    const finalVisibility = validatedData.visibility ?? existingShowCall.visibility
    const finalExternalUrl = validatedData.externalUrl ?? existingShowCall.externalUrl

    if (
      finalMode === 'EXTERNAL' &&
      finalVisibility !== 'CLOSED' &&
      finalVisibility !== 'OFFLINE' &&
      !finalExternalUrl
    ) {
      throw createError({
        status: 400,
        message: "L'URL externe est requise lorsque le mode est EXTERNAL et l'appel est ouvert",
      })
    }

    // Vérifier l'unicité du nom si changé
    if (validatedData.name && validatedData.name !== existingShowCall.name) {
      const duplicateName = await prisma.editionShowCall.findUnique({
        where: {
          editionId_name: {
            editionId,
            name: validatedData.name,
          },
        },
      })

      if (duplicateName) {
        throw createError({
          status: 400,
          message: 'Un appel à spectacles avec ce nom existe déjà pour cette édition',
        })
      }
    }

    // Mettre à jour l'appel
    const showCall = await prisma.editionShowCall.update({
      where: { id: showCallId },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.mode !== undefined && { mode: validatedData.mode }),
        ...(validatedData.externalUrl !== undefined && { externalUrl: validatedData.externalUrl }),
        ...(validatedData.deadline !== undefined && {
          deadline: validatedData.deadline ? new Date(validatedData.deadline) : null,
        }),
        ...(validatedData.visibility !== undefined && { visibility: validatedData.visibility }),
        ...(validatedData.askPortfolioUrl !== undefined && {
          askPortfolioUrl: validatedData.askPortfolioUrl,
        }),
        ...(validatedData.askVideoUrl !== undefined && { askVideoUrl: validatedData.askVideoUrl }),
        ...(validatedData.askTechnicalNeeds !== undefined && {
          askTechnicalNeeds: validatedData.askTechnicalNeeds,
        }),
        ...(validatedData.askStageSetup !== undefined && {
          askStageSetup: validatedData.askStageSetup,
        }),
        ...(validatedData.askAccommodation !== undefined && {
          askAccommodation: validatedData.askAccommodation,
        }),
        ...(validatedData.askDepartureCity !== undefined && {
          askDepartureCity: validatedData.askDepartureCity,
        }),
        ...(validatedData.askSocialLinks !== undefined && {
          askSocialLinks: validatedData.askSocialLinks,
        }),
        ...(validatedData.requirePhone !== undefined && {
          requirePhone: validatedData.requirePhone,
        }),
      },
    })

    // Annoncer l'ouverture aux comptes artiste — une seule fois par appel, et sans faire attendre
    // l'organisateur. Voir `diffuserOuvertureAuxArtistes` juste en dessous pour le détail.
    // `!openedNotifiedAt` et non `=== null` : une absence de date se lit `null` depuis la base mais
    // `undefined` partout où l'objet a été construit sans le champ. Les deux disent « pas encore
    // diffusé », et un test strict aurait fait passer le second pour « déjà diffusé ».
    if (
      validatedData.visibility === 'PUBLIC' &&
      existingShowCall.visibility !== 'PUBLIC' &&
      !existingShowCall.openedNotifiedAt
    ) {
      // Posée AVANT la diffusion, et par un update conditionnel : deux bascules simultanées ne
      // doivent pas diffuser deux fois. Celle qui n'écrit rien ne diffuse pas.
      const priseDeMarque = await prisma.editionShowCall.updateMany({
        where: { id: showCallId, openedNotifiedAt: null },
        data: { openedNotifiedAt: new Date() },
      })

      if (priseDeMarque.count > 0) {
        const editionData = await prisma.edition.findUnique({
          where: { id: editionId },
          select: { name: true, convention: { select: { name: true } } },
        })
        const editionName = editionData?.name || editionData?.convention?.name || ''

        apresLaReponse(event, () =>
          diffuserOuvertureAuxArtistes(showCall.name, editionName, editionId)
        )
      }
    }

    return createSuccessResponse({ showCall })
  },
  { operationName: 'UpdateShowCall' }
)
