/**
 * Helpers Prisma (version minimale app2).
 * Seul `fetchResourceByFieldOrFail` est consommé par `layers/auth/`.
 */

/**
 * Options pour fetchResourceByFieldOrFail.
 * Note : le layer passe l'option `status` (pas `statusCode`) ; les deux sont
 * acceptées pour rester robuste.
 */
export interface FetchResourceOptions {
  /** Clause include de Prisma */
  include?: any
  /** Clause select de Prisma */
  select?: any
  /** Message d'erreur personnalisé */
  errorMessage?: string
  /** Code d'erreur HTTP (par défaut : 404) */
  status?: number
  /** Alias legacy de `status` */
  statusCode?: number
}

/**
 * Récupère une ressource par un champ unique ou lance une erreur (404 par défaut).
 *
 * @param model - Le modèle Prisma (ex: prisma.user)
 * @param where - Clause where Prisma
 * @param options - Options de requête et message d'erreur
 * @returns La ressource trouvée
 * @throws createError si la ressource n'existe pas
 *
 * @example
 * const user = await fetchResourceByFieldOrFail(prisma.user, { email }, {
 *   errorMessage: 'Utilisateur non trouvé',
 * })
 */
export async function fetchResourceByFieldOrFail<T>(
  model: { findUnique: (args: any) => Promise<T | null> },
  where: Record<string, any>,
  options: FetchResourceOptions = {}
): Promise<T> {
  const { include, select, errorMessage = 'Ressource introuvable' } = options
  const status = options.status ?? options.statusCode ?? 404

  const resource = await model.findUnique({
    where,
    ...(include && { include }),
    ...(select && { select }),
  } as any)

  if (!resource) {
    throw createError({
      status,
      message: errorMessage,
    })
  }

  return resource
}
