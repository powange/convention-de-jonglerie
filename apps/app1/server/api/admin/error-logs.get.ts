import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { validatePagination } from '#server/utils/validation-helpers'

const DEFAULT_PAGE_SIZE = 20

/**
 * Les champs rendus par la LISTE.
 *
 * Une seule description, et non une par branche de pagination : les deux la recopiaient à
 * l'identique sur trente lignes, et c'est exactement ce qui a coûté `prismaDetails`. Il y était
 * écarté derrière un « TODO: Activer après migration en production » — recopié lui aussi, donc
 * présent deux fois —, et la migration en question est appliquée depuis longtemps. Le champ le
 * plus utile au diagnostic d'un 500 de base de données n'atteignait donc jamais l'écran.
 *
 * `headers` et `stack` restent écartés : trop verbeux pour une liste, et l'écran de détail
 * (`[id].get.ts`) les rend déjà en entier.
 */
const champsDeLaListe = {
  id: true,
  message: true,
  statusCode: true,
  errorType: true,
  method: true,
  path: true,
  userAgent: true,
  ip: true,
  referer: true, // Page d'origine
  origin: true, // Domaine d'origine
  resolved: true,
  resolvedBy: true,
  resolvedAt: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
  // Données utilisateur si disponible
  user: {
    select: {
      id: true,
      pseudo: true,
      email: true,
    },
  },
  // Métadonnées utiles au diagnostic, sans les données sensibles.
  queryParams: true,
  body: true, // sanitisé à l'écriture
  // Le code Prisma et le message MySQL d'origine — et, pour les lignes écrites par
  // `i18n/missing-keys.post.ts`, le décompte des clés manquantes. Deux contenus dans une même
  // colonne : c'est `app/utils/details-techniques-log.ts` qui les démêle à l'affichage.
  prismaDetails: true,
  headers: false,
  stack: false,
} as const

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    const query = getQuery(event)

    // Paramètres de pagination
    // Support pour pagination par curseur (plus performant) ET pagination classique (rétrocompatibilité)
    const cursor = (query.cursor as string) || undefined // ID du dernier log de la page précédente

    // Utiliser validatePagination seulement si on n'utilise pas le curseur
    const pagination = cursor ? null : validatePagination(event)
    const page = pagination?.page
    const pageSize = pagination?.limit || DEFAULT_PAGE_SIZE

    // Les critères viennent de `#server/utils/error-logs/filtres` : la vue groupée lit les mêmes.
    // Un décompte de groupes qui ne correspondrait pas aux lignes obtenues en dépliant serait pire
    // qu'une absence de regroupement.
    const { where, periode } = filtresDuJournal(query as Record<string, unknown>)

    // Paramètres de tri
    const sortField = (query.sortField as string) || 'createdAt'
    const sortDir = (query.sortDir as string) === 'asc' ? 'asc' : 'desc'

    // Comptage total pour la pagination.
    //
    // Quand il échoue — MySQL manque parfois de mémoire de tri sur cette table —, on ne fabrique
    // plus de nombre. L'ancien repli posait `total = 1000`, présenté comme un total réel : la
    // pagination proposait alors des pages qui n'existaient pas, et rien ne disait que le chiffre
    // était inventé.
    //
    // On rend désormais un minorant honnête, complété plus bas par ce qu'on a réellement lu, et un
    // drapeau qui permet à l'écran de le dire.
    let total = 0
    let totalExact = true
    try {
      total = await prisma.apiErrorLog.count({ where })
    } catch (countError) {
      console.warn('Comptage impossible, total marqué comme approximatif :', countError)
      totalExact = false
    }

    // Configuration du tri - limiter aux champs indexés pour éviter les problèmes de mémoire
    const orderBy: any = []
    if (sortField === 'createdAt') {
      orderBy.push({ createdAt: sortDir })
    } else if (sortField === 'statusCode') {
      orderBy.push({ statusCode: sortDir })
    } else if (sortField === 'path') {
      orderBy.push({ path: sortDir })
    } else {
      // Par défaut, tri par createdAt descendant (plus récent en premier) - champ indexé
      orderBy.push({ createdAt: 'desc' })
    }

    // Pagination par curseur (performant) ou offset (rétrocompatibilité)
    let errorLogs
    if (cursor) {
      // Pagination par curseur : beaucoup plus performant, pas de SKIP
      errorLogs = await prisma.apiErrorLog.findMany({
        where,
        orderBy,
        cursor: { id: cursor },
        skip: 1, // Skip le curseur lui-même
        take: pageSize,
        select: champsDeLaListe,
      })
    } else {
      // Pagination classique par offset (rétrocompatibilité)
      // Limiter le skip pour éviter les problèmes de performance
      const maxSkip = 1000
      const safeSkip = Math.min(pagination?.skip || 0, maxSkip)

      errorLogs = await prisma.apiErrorLog.findMany({
        where,
        orderBy,
        skip: safeSkip,
        take: pageSize,
        select: champsDeLaListe,
      })
    }

    // Les statistiques viennent du même module que les filtres : la vue groupée affiche les
    // mêmes cartes, et deux calculs séparés finiraient par décrire deux ensembles différents.
    const statsResponse = await statistiquesDuJournal(where)

    // Comptage impossible : à défaut d'un total, on rend au moins ce qu'on a réellement lu. C'est
    // un minorant, marqué comme tel par `totalExact: false`, et non un nombre inventé.
    if (!totalExact) total = (pagination?.skip ?? 0) + errorLogs.length

    // Calculer le curseur pour la page suivante (si pagination par curseur)
    const nextCursor = errorLogs[errorLogs.length - 1]?.id ?? null
    const hasMore = errorLogs.length === pageSize // Il y a potentiellement plus de résultats

    if (cursor) {
      // Pagination par curseur - structure différente
      return createSuccessResponse({
        logs: errorLogs,
        pagination: {
          cursor: nextCursor,
          hasMore,
          pageSize,
          total,
          totalExact,
        },
        periode,
        stats: statsResponse,
      })
    } else {
      // Pagination classique - utiliser createPaginatedResponse
      const reponse = createPaginatedResponse(errorLogs, total, page!, pageSize)

      return {
        ...reponse,
        pagination: { ...reponse.pagination, totalExact },
        // La période retenue part avec la réponse : l'écran l'affiche au lieu de la déduire, et
        // une valeur par défaut ne peut plus le surprendre en silence.
        periode,
        stats: statsResponse,
      }
    }
  },
  { operationName: 'GetErrorLogs' }
)
