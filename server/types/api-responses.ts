/**
 * Types de réponse API côté serveur
 *
 * Ce fichier :
 * - Réexporte les types partagés depuis shared/types/api.ts
 * - Définit les types Prisma-dépendants (non accessibles côté client)
 *
 * Utilisation côté serveur :
 * ```typescript
 * import type { LoginResponse } from '#server/types/api-responses'
 * export default wrapApiHandler<LoginResponse>(async (event) => { ... })
 * ```
 */

import type { ApiPaginatedResponse, ApiSuccessResponse } from '#server/types/api'
import type {
  conventionBasicSelect,
  editionListSelect,
  userBasicSelect,
} from '#server/utils/prisma-select-helpers'
import type { Prisma } from '@prisma/client'

// Réexporter les types partagés pour que le serveur puisse tout importer
// depuis un seul endroit
export type {
  DeleteResponse,
  LoginResponse,
  ProfileStats as ProfileStatsResponse,
  SessionMeResponse,
  SessionMeUser,
  SessionUser,
} from '#shared/types/api'

// ============================================================================
// TYPES PRISMA-DÉPENDANTS (serveur uniquement)
// ============================================================================

/**
 * Item d'une liste d'éditions (GET /api/editions)
 * Correspond à editionListSelect + creator + convention
 */
export type EditionListItem = Prisma.EditionGetPayload<{
  select: typeof editionListSelect & {
    creator: { select: typeof userBasicSelect }
    convention: { select: typeof conventionBasicSelect }
  }
}>

/**
 * GET /api/editions (paginée)
 */
export type GetEditionsResponse = ApiPaginatedResponse<EditionListItem>

/**
 * Réponse de succès avec données
 */
export type SuccessDataResponse<T> = ApiSuccessResponse<T>
