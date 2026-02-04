import type { H3Event, EventHandlerRequest } from 'h3'

/**
 * Type pour les noms de ressources
 */
export type ResourceType =
  | 'convention'
  | 'édition'
  | 'utilisateur'
  | 'organisateur'
  | 'offre'
  | 'demande'
  | 'atelier'
  | 'équipe'
  | 'spectacle'
  | 'artiste'
  | 'bénévole'
  | 'notification'
  | 'tier'
  | 'option'
  | 'commande'
  | 'participant'
  | 'repas'
  | 'objet'
  | 'créneau'
  | 'assignation'

/**
 * Messages d'erreur pour les ressources
 */
const RESOURCE_MESSAGES: Record<ResourceType, string> = {
  convention: 'ID de convention invalide',
  édition: "ID d'édition invalide",
  utilisateur: 'ID utilisateur invalide',
  organisateur: "ID d'organisateur invalide",
  offre: "ID d'offre invalide",
  demande: 'ID de demande invalide',
  atelier: "ID d'atelier invalide",
  équipe: "ID d'équipe invalide",
  spectacle: 'ID de spectacle invalide',
  artiste: "ID d'artiste invalide",
  bénévole: 'ID de bénévole invalide',
  notification: 'ID de notification invalide',
  tier: 'ID de tier invalide',
  option: "ID d'option invalide",
  commande: 'ID de commande invalide',
  participant: 'ID de participant invalide',
  repas: 'ID de repas invalide',
  objet: "ID d'objet invalide",
  créneau: 'ID de créneau invalide',
  assignation: "ID d'assignation invalide",
}

/**
 * Valide et extrait un ID numérique depuis les paramètres de route
 *
 * @param event - L'événement H3
 * @param paramName - Nom du paramètre dans la route (par défaut 'id')
 * @param resourceType - Type de ressource pour le message d'erreur
 * @returns L'ID validé
 * @throws createError 400 si l'ID est invalide
 *
 * @example
 * const offerId = validateResourceId(event, 'id', 'offre')
 * const conventionId = validateResourceId(event, 'conventionId', 'convention')
 */
export function validateResourceId(
  event: H3Event<EventHandlerRequest>,
  paramName: string = 'id',
  resourceType: ResourceType
): number {
  const rawId = getRouterParam(event, paramName)

  if (!rawId) {
    throw createError({
      status: 400,
      message: RESOURCE_MESSAGES[resourceType],
    })
  }

  const id = parseInt(rawId, 10)

  if (isNaN(id) || id <= 0) {
    throw createError({
      status: 400,
      message: RESOURCE_MESSAGES[resourceType],
    })
  }

  return id
}

/**
 * Valide un ID de convention depuis les paramètres de route
 * Alias pour validateResourceId avec type 'convention'
 */
export function validateConventionId(event: H3Event<EventHandlerRequest>): number {
  return validateResourceId(event, 'id', 'convention')
}

/**
 * Valide un ID d'édition depuis les paramètres de route
 * Alias pour validateResourceId avec type 'édition'
 */
export function validateEditionId(event: H3Event<EventHandlerRequest>): number {
  return validateResourceId(event, 'id', 'édition')
}

/**
 * Valide un ID d'utilisateur depuis les paramètres de route
 * Alias pour validateResourceId avec type 'utilisateur'
 */
export function validateUserId(event: H3Event<EventHandlerRequest>): number {
  return validateResourceId(event, 'id', 'utilisateur')
}

/**
 * Valide et extrait un ID de type chaîne (CUID) depuis les paramètres de route
 *
 * @param event - L'événement H3
 * @param paramName - Nom du paramètre dans la route
 * @param resourceType - Type de ressource pour le message d'erreur
 * @returns L'ID validé (chaîne)
 * @throws createError 400 si l'ID est invalide
 *
 * @example
 * const slotId = validateStringId(event, 'slotId', 'créneau')
 */
export function validateStringId(
  event: H3Event<EventHandlerRequest>,
  paramName: string,
  resourceType: ResourceType
): string {
  const id = getRouterParam(event, paramName)

  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw createError({
      status: 400,
      message: RESOURCE_MESSAGES[resourceType],
    })
  }

  return id
}

/**
 * Vérifie l'unicité d'un champ dans une table Prisma
 *
 * @param model - Le modèle Prisma (ex: prisma.user)
 * @param field - Le nom du champ à vérifier
 * @param value - La valeur à vérifier
 * @param excludeId - ID à exclure de la vérification (pour les updates)
 * @param errorMessage - Message d'erreur personnalisé
 * @throws createError 400 si le champ n'est pas unique
 *
 * @example
 * await checkUniqueness(prisma.user, 'email', 'test@example.com', userId, 'Cette adresse email est déjà utilisée')
 */
export async function checkUniqueness<T extends Record<string, any>>(
  model: { findUnique: (args: any) => Promise<T | null> },
  field: string,
  value: string | number,
  excludeId?: number,
  errorMessage?: string
): Promise<void> {
  const existing = await model.findUnique({
    where: { [field]: value } as any,
  })

  if (existing && (!excludeId || (existing as any).id !== excludeId)) {
    throw createError({
      status: 400,
      message: errorMessage || `Ce ${field} est déjà utilisé`,
    })
  }
}

/**
 * Vérifie l'unicité de l'email d'un utilisateur
 */
export async function checkEmailUniqueness(email: string, excludeUserId?: number): Promise<void> {
  await checkUniqueness(
    prisma.user,
    'email',
    email,
    excludeUserId,
    'Cette adresse email est déjà utilisée'
  )
}

/**
 * Vérifie l'unicité du pseudo d'un utilisateur
 */
export async function checkPseudoUniqueness(pseudo: string, excludeUserId?: number): Promise<void> {
  await checkUniqueness(prisma.user, 'pseudo', pseudo, excludeUserId, 'Ce pseudo est déjà utilisé')
}

/**
 * Sanitise une chaîne de caractères (trim + normalisation)
 */
export function sanitizeString(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Sanitise un email (lowercase + trim)
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Sanitise un objet de données en appliquant trim sur tous les champs string
 */
export function sanitizeObject<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data }

  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitized[key].trim() as any
    }
  }

  return sanitized
}

/**
 * Valide qu'une date de début est antérieure ou égale à une date de fin
 */
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string,
  fieldName: string = 'endDate'
): void {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate

  if (start > end) {
    throw createError({
      status: 400,
      message: 'La date de fin doit être postérieure ou égale à la date de début',
      data: { field: fieldName },
    })
  }
}

/**
 * Extrait et valide les paramètres de pagination
 */
export function validatePagination(event: H3Event<EventHandlerRequest>) {
  const query = getQuery(event)
  const page = Math.max(1, parseInt(String(query.page || '1'), 10))
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '10'), 10)))

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  }
}
