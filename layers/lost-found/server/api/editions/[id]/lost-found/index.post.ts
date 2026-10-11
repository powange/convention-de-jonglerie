import { useLostFoundPorts } from '#server/lost-found/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditEditionById } from '#server/utils/permissions/edition-permissions'
import { sanitizeString, validateEditionId } from '#server/utils/validation-helpers'

/** Le même plafond que les autres contenus libres du dépôt. La colonne est un `TEXT`. */
const LONGUEUR_MAX_DESCRIPTION = 2000

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const body = await readBody(event)

    const user = requireAuth(event)
    const userId = user.id

    // Existence + date de début via le port (le layer ne lit pas Edition directement)
    const { found, startDate } = await useLostFoundPorts().event.getEventTiming(editionId)
    if (!found) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    // Nouvelle règle : autoriser l'ajout à partir du début de l'édition (inclus) et après.
    const now = new Date()
    if (startDate && now < new Date(startDate)) {
      throw createError({
        status: 403,
        message: "Les objets trouvés ne peuvent pas être ajoutés avant le début de l'édition",
      })
    }

    // Vérifier que l'utilisateur est un organisateur
    const hasPermission = await canEditEditionById(editionId, userId, event)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: 'Vous devez être organisateur pour ajouter un objet trouvé',
      })
    }

    // Valider les données
    const description = sanitizeString(body.description)
    if (!description) {
      throw createError({
        status: 400,
        message: 'La description est requise',
      })
    }
    /*
     * Une borne de longueur, qui manquait : la colonne est un `TEXT`, donc on pouvait y déposer
     * 64 Ko que chaque chargement de la liste retransportait ensuite. Même famille que la borne
     * posée sur les commentaires de covoiturage.
     *
     * 📍 Elle ne ferme pas le constat A3 pour autant : la validation de l'URL d'image, qu'il
     * demande aussi, reste à faire.
     */
    if (description.length > LONGUEUR_MAX_DESCRIPTION) {
      throw createError({
        status: 400,
        message: `La description ne peut pas dépasser ${LONGUEUR_MAX_DESCRIPTION} caractères`,
      })
    }

    // Créer l'objet trouvé
    const rawItem = await prisma.lostFoundItem.create({
      data: {
        editionId,
        userId,
        /*
         * ⚠️ LA DESCRIPTION EST STOCKÉE TELLE QUELLE — constat B5.
         *
         * Elle passait par `sanitizeUserContent`, qui ÉCHAPPE le HTML avant stockage : « Sac & clés »
         * devenait « Sac &amp; clés » en base. Or l'écran l'affiche par interpolation `{{ }}` — et
         * dans l'attribut `alt` de la photo —, deux endroits que Vue échappe DÉJÀ. Le lecteur
         * voyait donc « Sac &amp; clés » à l'écran.
         *
         * 📍 Un échappement au stockage n'a de sens que pour un rendu `v-html`, et il n'y en a
         * aucun ici : vérifié, les dix `v-html` du dépôt rendent des descriptions MARKDOWN
         * (convention, édition, bio d'artiste), jamais celle-ci.
         *
         * 📍 Et les COMMENTAIRES de ce même écran n'étaient, eux, pas échappés : le même écran
         * appliquait deux règles. Ils font désormais foi.
         */
        description,
        imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
        status: 'LOST',
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
            updatedAt: true,
            emailHash: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                profilePicture: true,
                emailHash: true,
              },
            },
          },
        },
      },
    })
    return createSuccessResponse(rawItem)
  },
  { operationName: 'CreateLostFoundItem' }
)
