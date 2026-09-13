import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { filtresDuJournal, statistiquesDuJournal } from '#server/utils/error-logs/filtres'
import { validatePagination } from '#server/utils/validation-helpers'
import { empreinteDErreur } from '~~/shared/utils/empreinte-erreur'

const TAILLE_PAR_DEFAUT = 20

/**
 * Les entrées du journal regroupées par empreinte : un problème par ligne, pas un événement.
 *
 * La liste à plat rendait une ligne par occurrence. Cinquante fois la même erreur, c'était cinquante
 * lignes à faire défiler pour comprendre qu'il n'y avait qu'UN problème — et rien à l'écran ne
 * disait combien de fois il s'était produit, ni depuis quand.
 *
 * Le regroupement existait pourtant déjà, en creux : « résoudre les identiques » le présuppose
 * entièrement. C'est la même notion, rendue visible.
 *
 * Le regroupement se fait en BASE (`groupBy`) et non en mémoire : la table peut être grosse, et une
 * pagination qui porterait sur les lignes avant de les regrouper rendrait des groupes tronqués —
 * un compteur faux étant pire qu'un compteur absent.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const query = getQuery(event)
    const { skip, limit } = validatePagination(event)
    const pageSize = limit || TAILLE_PAR_DEFAUT

    // Exactement les mêmes critères que la liste à plat : sans quoi le nombre annoncé par un groupe
    // ne correspondrait pas aux lignes qu'on obtient en le dépliant.
    const { where, periode } = filtresDuJournal(query as Record<string, unknown>)

    // Une ligne de plus que demandé : elle ne sert qu'à savoir s'il y a une suite, et n'est pas
    // rendue. Compter les groupes exactement supposerait de tous les calculer, ce qui coûte
    // précisément ce que la pagination cherche à éviter.
    const groupes = await prisma.apiErrorLog.groupBy({
      by: ['errorType', 'method', 'path', 'message'],
      where,
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      skip,
      take: pageSize + 1,
    })

    const hasMore = groupes.length > pageSize
    const page = groupes.slice(0, pageSize)

    // Les mêmes cartes de statistiques qu'en vue à plat : cet écran est le même, seule la façon
    // de lister change.
    const stats = await statistiquesDuJournal(where)

    return createSuccessResponse({
      groupes: page.map((groupe) => ({
        // L'empreinte textuelle sert de clé d'affichage et se confronte telle quelle aux empreintes
        // écartées de `.claude/error-logs-monitor.json`.
        empreinte: empreinteDErreur(groupe),
        errorType: groupe.errorType,
        method: groupe.method,
        path: groupe.path,
        message: groupe.message,
        occurrences: groupe._count._all,
        premiereVue: groupe._min.createdAt,
        derniereVue: groupe._max.createdAt,
      })),
      pagination: {
        pageSize,
        hasMore,
        // Pas de total : le nombre exact de groupes exigerait de tous les parcourir. Mieux vaut
        // l'absence qu'un chiffre approximatif pris pour argent comptant.
        total: null,
      },
      periode,
      stats,
    })
  },
  { operationName: 'GetErrorLogGroups' }
)
