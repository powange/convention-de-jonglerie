import { useLostFoundPorts } from '#server/lost-found/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { assurerEditionLisible } from '#server/utils/edition-lisible'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Vérifier que l'événement existe (via le port : le layer ne lit pas Edition directement)
    const { found, visibilite } = await useLostFoundPorts().event.getEventTiming(editionId)
    if (!found) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    /*
     * ⚠️⚠️ CETTE GARDE ARRIVE AVEC L'OUVERTURE AU PUBLIC — constat B1, et les deux vont
     * ensemble.
     *
     * Jusqu'ici le middleware répondait 401 à tout anonyme sur cette route : la page publique
     * d'objets trouvés affichait un toast d'erreur puis « aucun objet signalé » alors qu'il y en
     * avait. Déclarer la route publique corrige cela — mais le handler ne vérifiait QUE
     * l'existence de l'édition, pas son statut. Sans cette garde, on remplaçait un état vide
     * trompeur par une FUITE : les objets d'une édition retirée de la vue du public, pseudos et
     * photos des auteurs compris, seraient devenus lisibles à qui connaît son numéro.
     *
     * 📍 C'est le défaut exact que la copie publique des éditions a failli rouvrir : un correctif
     * d'affichage qui ouvre une porte. La règle est partagée (`assurerEditionLisible`), et elle
     * répond 404 — distinguer 403 et 404 dirait à un visiteur qu'il EXISTE quelque chose derrière
     * ce numéro.
     */
    if (visibilite) {
      await assurerEditionLisible(event, editionId, visibilite)
    }

    // Récupérer tous les objets trouvés de l'édition
    const rawItems = await prisma.lostFoundItem.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
            emailHash: true,
            updatedAt: true,
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
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return rawItems
  },
  { operationName: 'GetLostFoundItems' }
)
