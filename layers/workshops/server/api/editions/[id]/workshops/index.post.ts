import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canCreateWorkshop } from '#server/utils/permissions/workshop-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { workshopSchema, validateAndSanitize } from '#server/utils/validation-schemas'
import { useWorkshopsPorts } from '#server/workshops/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Existence + activation + dates via le port (le layer ne lit pas Edition directement)
    const cfg = await useWorkshopsPorts().event.getConfig(editionId)
    if (!cfg.found) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    if (!cfg.enabled) {
      throw createError({
        status: 403,
        message: 'Les workshops ne sont pas activés pour cette édition',
      })
    }

    // Vérifier les permissions pour créer un workshop
    const hasPermission = await canCreateWorkshop(user.id, editionId)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message:
          'Vous devez être bénévole accepté, artiste, organisateur ou participant pour créer un workshop',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = validateAndSanitize(workshopSchema, {
      ...body,
      editionStartDate: cfg.startDate?.toISOString(),
      editionEndDate: cfg.endDate?.toISOString(),
    })

    /*
     * Le lieu de l'atelier — constat B2.
     *
     * ⚠️ CE BLOC NE CHERCHAIT LE LIEU QU'EN MODE « SAISIE LIBRE ». En mode LIEUX EXCLUSIFS,
     * un `locationName` était donc purement et simplement ignoré, sans un mot : c'est ce que vit
     * l'import depuis une affiche, qui ne connaît que des NOMS — l'IA lit « Salle A » sur l'image,
     * elle n'a aucun identifiant à proposer.
     *
     * Désormais le nom est d'abord RAPPROCHÉ d'un lieu existant de l'édition, dans les deux modes.
     * Ce n'est qu'à défaut que les deux modes divergent, et pour une bonne raison : en mode
     * exclusif, l'organisation a arrêté une liste de lieux, et en inventer un la contredirait.
     *
     * 📍 LA COMPARAISON EST DÉJÀ INSENSIBLE À LA CASSE, et ce n'est pas une supposition : la
     * collation de la table est `utf8mb4_unicode_ci` (relevée en base), donc « salle a » retrouve
     * « Salle A ». Il ne faut SURTOUT PAS ajouter `mode: 'insensitive'` que la fiche suggérait :
     * le connecteur MySQL de Prisma ne l'accepte pas. Corollaire pour les tests : cette
     * insensibilité est une garantie de la BASE, qu'aucun bouchon ne peut éprouver.
     */
    let locationId = validatedData.locationId || null
    /** Un lieu a été demandé, et il n'a pas pu être rattaché. L'appelant doit pouvoir le dire. */
    let locationIgnored = false
    const nomDeLieu = validatedData.locationName?.trim() || null

    if (nomDeLieu && !locationId) {
      const lieuExistant = await prisma.workshopLocation.findFirst({
        where: { editionId, name: nomDeLieu },
        select: { id: true },
      })

      if (lieuExistant) {
        locationId = lieuExistant.id
      } else if (cfg.locationsFreeInput) {
        const lieuCree = await prisma.workshopLocation.create({
          data: { editionId, name: nomDeLieu },
        })
        locationId = lieuCree.id
      } else {
        /*
         * Mode LIEUX EXCLUSIFS et nom inconnu : on ne peut pas créer le lieu, mais on ne jette pas
         * l'atelier pour autant — son titre, son horaire et sa description sont justes, et les
         * perdre pour un lieu absent de la liste coûterait plus que ce que ça protège. En revanche
         * l'appelant est PRÉVENU : l'ancien silence est précisément le défaut de ce constat.
         */
        locationIgnored = true
      }
    }

    // Créer le workshop
    const newWorkshop = await prisma.workshop.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        startDateTime: new Date(validatedData.startDateTime),
        // Facultative : un atelier peut n'annoncer que son heure de début.
        endDateTime: validatedData.endDateTime ? new Date(validatedData.endDateTime) : null,
        maxParticipants: validatedData.maxParticipants || null,
        locationId,
        editionId,
        creatorId: user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    /*
     * `locationIgnored` voyage à côté de l'atelier, toujours présent et non seulement quand il
     * vaut `true` : un appelant qui lit `data.locationIgnored` ne doit pas avoir à distinguer
     * « faux » de « ce serveur ne le dit pas ».
     */
    return createSuccessResponse({ ...newWorkshop, locationIgnored })
  },
  { operationName: 'CreateWorkshop' }
)
