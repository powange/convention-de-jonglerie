import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { getCountryVariants } from '#server/utils/countries'
import { conventionBasicSelect } from '#server/utils/prisma-select-helpers'

/**
 * Schéma de validation pour la vérification de doublons
 */
const checkDuplicateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/),
  country: z.string().min(1),
})

/**
 * Type de retour pour une édition potentiellement en doublon
 */
interface DuplicateEdition {
  id: number
  name: string | null
  startDate: Date
  endDate: Date
  city: string
  country: string
  convention: {
    id: number
    name: string
    logo: string | null
  }
}

/**
 * POST /api/admin/check-duplicate-editions
 *
 * Vérifie si des éditions existent déjà à la même période dans le même pays.
 * Utile pour éviter les doublons lors de l'import d'éditions.
 *
 * @param body.startDate - Date de début (format ISO)
 * @param body.endDate - Date de fin (format ISO)
 * @param body.country - Pays de l'édition
 * @returns Liste des éditions qui chevauchent la période donnée
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les données
    const body = await readBody(event)
    const validatedData = checkDuplicateSchema.parse(body)

    // Convertir les dates
    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)

    // Obtenir toutes les variantes du pays (ex: "Switzerland" → ["Switzerland", "Suisse"])
    const countryVariants = getCountryVariants(validatedData.country)

    // Rechercher les éditions qui chevauchent la période dans le même pays
    // Un chevauchement existe si :
    // - La date de début existante <= la date de fin nouvelle ET
    // - La date de fin existante >= la date de début nouvelle
    // Note: Recherche dans toutes les variantes du pays (français/anglais)
    const overlappingEditions = await prisma.edition.findMany({
      where: {
        country: { in: countryVariants },
        AND: [
          {
            startDate: {
              lte: endDate,
            },
          },
          {
            endDate: {
              gte: startDate,
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        city: true,
        country: true,
        convention: {
          select: conventionBasicSelect,
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    })

    return createSuccessResponse({
      hasDuplicates: overlappingEditions.length > 0,
      duplicates: overlappingEditions as DuplicateEdition[],
      count: overlappingEditions.length,
    })
  },
  { operationName: 'CheckDuplicateEditions' }
)
