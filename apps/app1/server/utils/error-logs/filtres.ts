import { codesDuFiltreDeType } from '~~/shared/utils/types-erreur'

/**
 * Les critères de filtrage du journal d'erreurs, décrits une seule fois.
 *
 * La liste à plat et la vue groupée doivent montrer EXACTEMENT le même ensemble : un décompte de
 * groupes qui ne correspondrait pas aux lignes qu'on obtient en dépliant serait pire qu'une absence
 * de regroupement. Ils lisent donc les mêmes paramètres et construisent le même `where`, ici.
 *
 * Ce dépôt a déjà payé la forme inverse plusieurs fois — des filtres composés une fois pour la liste
 * et une fois pour l'export, ou pour l'impression. À chaque fois les copies ont fini par diverger,
 * et l'écart s'est vu sur un livrable, pas sur l'écran.
 */

/** La fenêtre par défaut, unique. */
export const PERIODE_PAR_DEFAUT = '7d'

/** Les fenêtres admises et leur durée en jours. `all` n'y figure pas : c'est l'absence de borne. */
export const PERIODES: Record<string, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/**
 * La période effectivement appliquée.
 *
 * Une seule valeur par défaut, et c'est un correctif : elle dépendait auparavant du filtre de
 * statut — un jour pour « non résolues », sept sinon. Passer de « toutes » à « non résolues »
 * réduisait donc la fenêtre sans le dire, et la baisse du nombre de résultats se lisait comme une
 * baisse du nombre d'erreurs.
 *
 * Une valeur inconnue retombe sur le défaut plutôt que d'être appliquée de travers.
 */
export function periodeAppliquee(demandee: string | null | undefined): string {
  if (demandee === 'all') return 'all'
  return demandee && demandee in PERIODES ? demandee : PERIODE_PAR_DEFAUT
}

/** Les quatre composantes exactes d'une empreinte, quand on veut les occurrences d'un groupe. */
function conditionDEmpreinte(query: Record<string, unknown>): Record<string, unknown> | null {
  const texte = (cle: string) => (typeof query[cle] === 'string' ? (query[cle] as string) : null)

  const method = texte('fpMethod')
  const path = texte('fpPath')
  const message = texte('fpMessage')
  if (method === null || path === null || message === null) return null

  // Passées séparément et non jointes par un séparateur : un message peut contenir n'importe quel
  // caractère, y compris celui qui servirait à les recoller.
  const errorType = texte('fpErrorType')

  return {
    errorType: errorType === null || errorType === '' ? null : errorType,
    method,
    path,
    message,
  }
}

export interface FiltresDuJournal {
  /** Le `where` Prisma, prêt à l'emploi. */
  where: Record<string, unknown>
  /** La période retenue, pour que l'écran puisse l'afficher au lieu de la deviner. */
  periode: string
}

/**
 * Construit le filtre à partir des paramètres de requête.
 *
 * Chaque critère occupe sa propre entrée du `AND` : plusieurs d'entre eux produisent une clé `OR`
 * — la recherche libre, le filtre utilisateur — et les étaler dans un même objet ferait que le
 * dernier écrase les précédents, en silence.
 */
export function filtresDuJournal(query: Record<string, unknown>): FiltresDuJournal {
  const texte = (cle: string) => {
    const valeur = query[cle]
    return typeof valeur === 'string' ? valeur.trim() : undefined
  }

  const conditions: Record<string, unknown>[] = []

  const periode = periodeAppliquee(texte('timeRange'))
  if (periode !== 'all') {
    const jours = PERIODES[periode] ?? PERIODES[PERIODE_PAR_DEFAUT]!
    conditions.push({ createdAt: { gte: new Date(Date.now() - jours * 24 * 60 * 60 * 1000) } })
  }

  const statut = texte('status')
  if (statut === 'resolved') conditions.push({ resolved: true })
  else if (statut === 'unresolved') conditions.push({ resolved: false })

  // Le type peut désigner une FAMILLE (`famille:base-de-donnees`), qui se résout en plusieurs
  // codes. Une valeur non reconnue ne filtre rien plutôt que de ne rien rendre : un écran vide se
  // lit comme « aucune erreur ».
  const codesDeType = codesDuFiltreDeType(texte('errorType'))
  if (codesDeType) {
    conditions.push(
      codesDeType.length === 1 ? { errorType: codesDeType[0] } : { errorType: { in: codesDeType } }
    )
  }

  const statusCode = texte('statusCode') ? parseInt(texte('statusCode')!, 10) : undefined
  if (statusCode !== undefined && !Number.isNaN(statusCode)) conditions.push({ statusCode })

  const chemin = texte('path')
  if (chemin) conditions.push({ path: { contains: chemin } })

  const ip = texte('ip')
  if (ip) conditions.push({ ip: { contains: ip } })

  const userId = texte('userId') ? parseInt(texte('userId')!, 10) : undefined
  if (userId !== undefined && !Number.isNaN(userId)) conditions.push({ userId })

  const utilisateur = texte('user')
  if (utilisateur) {
    conditions.push({
      user: {
        OR: [{ pseudo: { contains: utilisateur } }, { email: { contains: utilisateur } }],
      },
    })
  }

  const recherche = texte('search')
  if (recherche) {
    conditions.push({
      OR: [
        { message: { contains: recherche } },
        { path: { contains: recherche } },
        { errorType: { contains: recherche } },
      ],
    })
  }

  // Les occurrences d'un groupe précis : quatre égalités exactes, rien de partiel.
  const empreinte = conditionDEmpreinte(query)
  if (empreinte) conditions.push(empreinte)

  return {
    where:
      conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0]! : { AND: conditions },
    periode,
  }
}

export interface StatistiquesDuJournal {
  totalLast24h: number
  unresolvedCount: number
  errorTypes: Array<{ type: string; count: number }>
  statusCodes: Array<{ code: number; count: number }>
}

/**
 * Les statistiques affichées en tête d'écran, calculées pour les DEUX vues.
 *
 * Elles ne vivaient que dans l'endpoint de la liste à plat. La vue groupée étant devenue le défaut,
 * les quatre cartes seraient restées à zéro à l'ouverture de la page — un écran qui annonce « aucune
 * erreur » alors qu'il en affiche est pire qu'un écran sans statistiques.
 *
 * ⚠️ `totalLast24h` ignore les filtres, délibérément : c'est un repère absolu — « que s'est-il passé
 * depuis hier » — et non une lecture de la sélection courante. Les trois autres, eux, suivent les
 * filtres, sans quoi les répartitions par type et par code décriraient un ensemble que l'écran ne
 * montre pas.
 */
export async function statistiquesDuJournal(
  where: Record<string, unknown>
): Promise<StatistiquesDuJournal> {
  const [surVingtQuatreHeures, nonResolues, parType, parCode] = await Promise.all([
    prisma.apiErrorLog.aggregate({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: { id: true },
    }),
    prisma.apiErrorLog.count({ where: { AND: [where, { resolved: false }] } }),
    prisma.apiErrorLog.groupBy({
      by: ['errorType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.apiErrorLog.groupBy({
      by: ['statusCode'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ])

  return {
    totalLast24h: surVingtQuatreHeures._count.id,
    unresolvedCount: nonResolues,
    errorTypes: parType.map((ligne) => ({
      type: ligne.errorType || 'UnknownError',
      count: ligne._count.id,
    })),
    statusCodes: parCode.map((ligne) => ({ code: ligne.statusCode, count: ligne._count.id })),
  }
}
