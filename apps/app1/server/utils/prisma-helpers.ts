/**
 * Options pour fetchResourceOrFail
 */
export interface FetchResourceOptions<T = any> {
  /**
   * Clause include de Prisma
   */
  include?: T

  /**
   * Clause select de Prisma
   */
  select?: T

  /**
   * Message d'erreur personnalisé
   */
  errorMessage?: string

  /**
   * Code d'erreur HTTP (par défaut: 404)
   */
  statusCode?: number
}

/**
 * Récupère une ressource par son ID ou lance une erreur 404 si non trouvée
 *
 * Élimine le pattern répétitif :
 * ```
 * const resource = await prisma.xxx.findUnique({ where: { id } })
 * if (!resource) throw createError({ status: 404, message: '...' })
 * ```
 *
 * @param model - Le modèle Prisma (ex: prisma.user, prisma.convention)
 * @param id - L'ID de la ressource
 * @param options - Options de requête et message d'erreur
 * @returns La ressource trouvée
 * @throws createError 404 si la ressource n'existe pas
 *
 * @example
 * const user = await fetchResourceOrFail(prisma.user, userId, {
 *   select: { id: true, email: true },
 *   errorMessage: 'Utilisateur introuvable'
 * })
 */
export async function fetchResourceOrFail<T>(
  model: { findUnique: (args: any) => Promise<T | null> },
  id: number,
  options: FetchResourceOptions = {}
): Promise<T> {
  const { include, select, errorMessage = 'Ressource introuvable', statusCode = 404 } = options

  const resource = await model.findUnique({
    where: { id },
    ...(include && { include }),
    ...(select && { select }),
  } as any)

  if (!resource) {
    throw createError({
      statusCode,
      message: errorMessage,
    })
  }

  return resource
}

/**
 * Récupère une ressource par un champ unique ou lance une erreur 404
 *
 * @param model - Le modèle Prisma
 * @param where - Clause where Prisma
 * @param options - Options de requête
 * @returns La ressource trouvée
 *
 * @example
 * const user = await fetchResourceByFieldOrFail(prisma.user, { email: 'test@example.com' })
 */
export async function fetchResourceByFieldOrFail<T>(
  model: { findUnique: (args: any) => Promise<T | null> },
  where: Record<string, any>,
  options: FetchResourceOptions = {}
): Promise<T> {
  const { include, select, errorMessage = 'Ressource introuvable', statusCode = 404 } = options

  const resource = await model.findUnique({
    where,
    ...(include && { include }),
    ...(select && { select }),
  } as any)

  if (!resource) {
    throw createError({
      statusCode,
      message: errorMessage,
    })
  }

  return resource
}

/**
 * Construit un objet de mise à jour Prisma en ne gardant que les champs définis
 *
 * Élimine le pattern répétitif :
 * ```
 * const updateData: any = {}
 * if (data.field1 !== undefined) updateData.field1 = data.field1
 * if (data.field2 !== undefined) updateData.field2 = data.field2
 * ```
 *
 * @param data - Données validées à partir desquelles construire l'update
 * @param options - Options de transformation
 * @returns Objet contenant uniquement les champs définis
 *
 * @example
 * const updateData = buildUpdateData(validatedData, {
 *   exclude: ['id', 'createdAt'],
 *   transform: {
 *     startDate: (val) => new Date(val),
 *     email: (val) => val.toLowerCase()
 *   }
 * })
 */
export function buildUpdateData<T extends Record<string, any>>(
  data: T,
  options: {
    /**
     * Champs à exclure
     */
    exclude?: string[]

    /**
     * Transformations à appliquer sur certains champs
     */
    transform?: Record<string, (value: any) => any>

    /**
     * Inclure les champs null (par défaut: true)
     */
    includeNull?: boolean

    /**
     * Appliquer trim sur tous les strings (par défaut: false)
     */
    trimStrings?: boolean
  } = {}
): Partial<T> {
  const { exclude = [], transform = {}, includeNull = true, trimStrings = false } = options

  const updateData: Partial<T> = {}

  for (const [key, value] of Object.entries(data)) {
    // Ignorer les champs exclus
    if (exclude.includes(key)) {
      continue
    }

    // Ignorer les champs undefined
    if (value === undefined) {
      continue
    }

    // Ignorer les champs null si demandé
    if (value === null && !includeNull) {
      continue
    }

    // Appliquer la transformation si définie
    if (key in transform) {
      updateData[key as keyof T] = transform[key](value)
      continue
    }

    // Appliquer trim si demandé et si c'est une string
    if (trimStrings && typeof value === 'string') {
      updateData[key as keyof T] = value.trim() as any
      continue
    }

    // Sinon, garder la valeur telle quelle
    updateData[key as keyof T] = value
  }

  return updateData
}

/**
 * Compte le nombre total de ressources pour la pagination
 *
 * @param model - Le modèle Prisma
 * @param where - Clause where Prisma
 * @returns Le nombre total de ressources
 *
 * @example
 * const total = await countResources(prisma.user, { isGlobalAdmin: true })
 */
export async function countResources<T>(
  model: { count: (args?: any) => Promise<number> },
  where?: T
): Promise<number> {
  return await model.count({
    ...(where && { where }),
  } as any)
}

/**
 * Récupère une liste paginée de ressources
 *
 * @param model - Le modèle Prisma
 * @param options - Options de pagination et filtres
 * @returns Objet contenant les items et les métadonnées de pagination
 *
 * @example
 * const result = await fetchPaginated(prisma.user, {
 *   page: 1,
 *   limit: 10,
 *   where: { isEmailVerified: true },
 *   orderBy: { createdAt: 'desc' }
 * })
 */
export async function fetchPaginated<T, W = any, O = any>(
  model: {
    findMany: (args: any) => Promise<T[]>
    count: (args?: any) => Promise<number>
  },
  options: {
    page: number
    limit: number
    where?: W
    orderBy?: O
    include?: any
    select?: any
  }
): Promise<{
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}> {
  const { page, limit, where, orderBy, include, select } = options

  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    model.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      ...(include && { include }),
      ...(select && { select }),
    } as any),
    model.count({ where } as any),
  ])

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  }
}

/**
 * Vérifie qu'une ressource existe sans la récupérer
 *
 * @param model - Le modèle Prisma
 * @param id - L'ID de la ressource
 * @param errorMessage - Message d'erreur si non trouvée
 * @throws createError 404 si la ressource n'existe pas
 *
 * @example
 * await assertResourceExists(prisma.edition, editionId, 'Édition introuvable')
 */
export async function assertResourceExists(
  model: { findUnique: (args: any) => Promise<any> },
  id: number,
  errorMessage: string = 'Ressource introuvable'
): Promise<void> {
  const exists = await model.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!exists) {
    throw createError({
      status: 404,
      message: errorMessage,
    })
  }
}

/**
 * Vérifie que plusieurs ressources existent
 *
 * @param model - Le modèle Prisma
 * @param ids - Liste des IDs à vérifier
 * @param errorMessage - Message d'erreur
 * @throws createError 404 si au moins une ressource n'existe pas
 *
 * @example
 * await assertResourcesExist(prisma.workshop, workshopIds, 'Certains ateliers sont introuvables')
 */
export async function assertResourcesExist(
  model: { findMany: (args: any) => Promise<any[]> },
  ids: number[],
  errorMessage: string = 'Certaines ressources sont introuvables'
): Promise<void> {
  const found = await model.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })

  if (found.length !== ids.length) {
    throw createError({
      status: 404,
      message: errorMessage,
    })
  }
}
