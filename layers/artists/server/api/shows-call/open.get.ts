import { editionAccueilleDesCandidatures } from '#core/shared/utils/candidature-spectacle'
import { STATUTS_VISIBLES_PUBLIQUEMENT } from '#core/shared/utils/visibilite-edition'
import { useArtistsPorts } from '#server/artists/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * Les statuts d'édition que cette liste publique peut annoncer.
 *
 * C'est l'INTERSECTION de deux règles qui existaient déjà, et qu'il n'y a pas lieu de réécrire :
 * ce qu'un visiteur a le droit de voir (`visibilite-edition.ts`, tout sauf `OFFLINE`) et ce qui
 * accueille des candidatures (`candidature-spectacle.ts`, tout sauf `CANCELLED`). L'intersection
 * est calculée plutôt qu'écrite à la main, pour qu'un statut ajouté demain à l'enum suive les
 * deux règles sans qu'on ait à y penser ici.
 *
 * ⚠️ CE QUI N'ALLAIT PAS : `status: 'PUBLISHED'` en dur. Les appels d'une édition `PLANNED`
 * étaient donc ABSENTS de cette liste, alors que leur page reste atteignable par son adresse et
 * que le serveur accepte d'y candidater — une édition annoncée mais pas encore publiée est
 * exactement celle qui cherche des artistes.
 */
const STATUTS_ANNONCABLES = STATUTS_VISIBLES_PUBLIQUEMENT.filter(editionAccueilleDesCandidatures)

/**
 * Liste tous les appels à spectacles ouverts sur toutes les éditions visibles
 * Accessible par tout le monde (pas besoin d'authentification)
 * Utilisé pour la page centralisée des candidatures artistes
 */
export default wrapApiHandler(
  async () => {
    const now = new Date()

    const showCalls = await prisma.editionShowCall.findMany({
      where: {
        visibility: 'PUBLIC',
        /*
         * ⚠️ LA DATE LIMITE ÉTAIT IGNORÉE. Un appel dont l'échéance était passée restait listé
         * avec son bouton « Postuler maintenant », et c'est la page de candidature qui annonçait
         * ensuite que c'était trop tard. Une liste qui s'intitule « appels ouverts » ne doit pas
         * compter sur l'écran suivant pour dire non.
         *
         * Un appel SANS date limite reste ouvert : c'est un cas normal, et non une donnée
         * manquante.
         */
        OR: [{ deadline: null }, { deadline: { gte: now } }],
        edition: {
          status: { in: STATUTS_ANNONCABLES },
          // « Pas encore terminée » : chaque app le dit à sa façon (date de fin facultative dans
          // Flowvent).
          ...useArtistsPorts().event.filtreEditionsPasTerminees(now),
        },
      },
      select: {
        id: true,
        name: true,
        visibility: true,
        mode: true,
        externalUrl: true,
        description: true,
        deadline: true,
        askPortfolioUrl: true,
        askVideoUrl: true,
        askTechnicalNeeds: true,
        askStageSetup: true,
        askAccommodation: true,
        edition: { select: useArtistsPorts().event.selectionEditionAffichee },
      },
      orderBy: [
        { deadline: 'asc' }, // Par date limite croissante
        { edition: { startDate: 'asc' } }, // Puis par date de début d'édition
      ],
    })

    /*
     * ⚠️ LES APPELS SANS DATE LIMITE PASSENT EN DERNIER, et ce tri ne peut pas se faire en base.
     * MySQL place les NULL EN TÊTE d'un `ORDER BY ... ASC` : les appels sans échéance arrivaient
     * donc avant les plus urgents, soit l'inverse de ce que la page promet. L'option `nulls` de
     * Prisma n'est pas disponible ici — elle relève du drapeau d'aperçu `orderByNulls`, que le
     * schéma de ce dépôt n'active pas (vérifié dans `prisma/schema/schema.prisma`).
     *
     * Le tri de JavaScript est STABLE depuis ES2019 : ne comparer que « a-t-il une échéance ? »
     * conserve donc, à l'intérieur de chaque groupe, l'ordre que la base vient d'établir. Rien
     * n'est trié deux fois.
     */
    const classes = [...showCalls].sort(
      (a, b) => Number(a.deadline === null) - Number(b.deadline === null)
    )

    // L'édition sous la forme commune affichée (app1 : édition + convention ; Flowvent : événement).
    const { editionAffichee } = useArtistsPorts().event
    return {
      showCalls: classes.map((appel) => ({ ...appel, edition: editionAffichee(appel.edition) })),
      count: classes.length,
    }
  },
  { operationName: 'GetAllOpenShowCalls' }
)
